import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const escapeIcs = (value: unknown) => String(value ?? "")
  .replace(/\\/g, "\\\\")
  .replace(/\r\n?/g, "\n")
  .replace(/\n/g, "\\n")
  .replace(/,/g, "\\,")
  .replace(/;/g, "\\;");

const foldLine = (line: string) => {
  const chunks: string[] = [];
  let chunk = "";
  let maxBytes = 75;
  for (const character of line) {
    if (new TextEncoder().encode(chunk + character).length > maxBytes) {
      chunks.push(chunk);
      chunk = character;
      maxBytes = 74;
    } else {
      chunk += character;
    }
  }
  chunks.push(chunk);
  return chunks.join("\r\n ");
};

const dateOnly = (value: unknown) => typeof value === "string" ? value.slice(0, 10).replace(/-/g, "") : "";
const timeOnly = (value: unknown) => typeof value === "string" ? value.match(/(\d{2}:\d{2})/)?.[1] : undefined;
const toUtcDateTime = (date: string, time: string) => {
  const utc = new Date(`${date.slice(0, 10)}T${time}:00+07:00`);
  return Number.isNaN(utc.getTime()) ? "" : utc.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
};

const nextDate = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
};

type IcsEvent = {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  allDay?: boolean;
};

const eventLines = (event: IcsEvent, timestamp: string) => {
  const start = dateOnly(event.date);
  if (!start) return [];
  const timed = !event.allDay && Boolean(event.startTime);
  const startDateTime = timed ? toUtcDateTime(event.date, timeOnly(event.startTime) || "00:00") : "";
  const startAt = timed ? startDateTime : start;
  if (!startAt) return [];

  let endAt = "";
  if (timed) {
    const parsedStart = new Date(`${event.date.slice(0, 10)}T${timeOnly(event.startTime)}:00+07:00`);
    const endTime = timeOnly(event.endTime);
    const parsedEnd = endTime
      ? new Date(`${event.date.slice(0, 10)}T${endTime}:00+07:00`)
      : new Date(parsedStart.getTime() + 60 * 60 * 1000);
    endAt = parsedEnd.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  const description = [event.description].filter(Boolean).join("\n");
  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcs(event.id)}@vena-pindah-calendar`,
    `DTSTAMP:${timestamp}`,
    timed ? `DTSTART:${startAt}` : `DTSTART;VALUE=DATE:${startAt}`,
    timed ? `DTEND:${endAt}` : `DTEND;VALUE=DATE:${nextDate(event.date)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    ...(event.location ? [`LOCATION:${escapeIcs(event.location)}`] : []),
    ...(description ? [`DESCRIPTION:${escapeIcs(description)}`] : []),
    "END:VEVENT",
  ];
};

async function loadAllRows(client: any, table: string) {
  const rows: Record<string, any>[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from(table).select("*").range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

serve(async req => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!supabaseUrl || !serviceRoleKey) return new Response("Calendar feed is not configured", { status: 500 });
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response("Not found", { status: 404 });

  try {
    const tokenDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(tokenDigest), byte => byte.toString(16).padStart(2, "0")).join("");
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: feed, error: feedError } = await client
      .from("google_calendar_feed_tokens").select("token_hash").eq("token_hash", tokenHash).maybeSingle();
    if (feedError) throw feedError;
    if (!feed) return new Response("Not found", { status: 404 });

    const [projects, calendarEvents, assignments, teamMembers] = await Promise.all([
      loadAllRows(client, "projects"),
      loadAllRows(client, "calendar_events"),
      loadAllRows(client, "project_team_assignments"),
      loadAllRows(client, "team_members"),
    ]);
    const assignmentsByProject = new Map<string, string[]>();
    assignments.forEach(assignment => {
      const list = assignmentsByProject.get(assignment.project_id) || [];
      const name = [assignment.member_name, assignment.member_role].filter(Boolean).join(" - ");
      if (name) list.push(name);
      assignmentsByProject.set(assignment.project_id, list);
    });
    const memberById = new Map(teamMembers.map(member => [member.id, member]));

    const events: IcsEvent[] = [];
    projects.forEach(project => {
      const team = assignmentsByProject.get(project.id) || [];
      const details = [
        project.client_name ? `[PENGANTIN]\n${project.client_name}` : "",
        [
          project.project_type ? `Jenis acara: ${project.project_type}` : "",
          project.status ? `Status: ${project.status}` : "",
        ].filter(Boolean).length
          ? `[DETAIL ACARA]\n${[
            project.project_type ? `Jenis acara: ${project.project_type}` : "",
            project.status ? `Status: ${project.status}` : "",
          ].filter(Boolean).join("\n")}`
          : "",
        team.length ? `[TIM BERTUGAS]\n${team.map(name => `- ${name}`).join("\n")}` : "",
        project.notes ? `[CATATAN]\n${project.notes}` : "",
      ].filter(Boolean).join("\n\n");
      events.push({
        id: project.id,
        title: project.project_name || "Acara",
        date: project.date,
        startTime: project.start_time,
        endTime: project.end_time,
        location: project.address || project.location,
        description: details,
      });
      if (project.deadline_date && project.deadline_date.slice(0, 10) !== project.date?.slice(0, 10)) {
        events.push({
          id: `${project.id}-deadline`,
          title: `Deadline: ${project.project_name || "Acara"}`,
          date: project.deadline_date,
          allDay: true,
          location: project.location,
          description: details,
        });
      }
    });

    calendarEvents.forEach(event => {
      const assignedIds = Array.isArray(event.team)
        ? event.team.map((member: any) => member.memberId || member.member_id).filter(Boolean)
        : event.team_member_id ? [event.team_member_id] : [];
      const team = assignedIds.map((id: string) => memberById.get(id)?.name).filter(Boolean);
      const details = [
        [
          event.event_type ? `Jenis: ${event.event_type}` : "",
          event.status ? `Status: ${event.status}` : "",
        ].filter(Boolean).length
          ? `[DETAIL AGENDA]\n${[
            event.event_type ? `Jenis: ${event.event_type}` : "",
            event.status ? `Status: ${event.status}` : "",
          ].filter(Boolean).join("\n")}`
          : "",
        team.length ? `[TIM BERTUGAS]\n${team.map((name: string) => `- ${name}`).join("\n")}` : "",
        Array.isArray(event.tasks) && event.tasks.length
          ? `[DAFTAR TUGAS]\n${event.tasks.map((task: any) => `- ${task.completed ? "[x]" : "[ ]"} ${task.name}`).join("\n")}`
          : "",
        event.notes ? `[CATATAN]\n${event.notes}` : "",
      ].filter(Boolean).join("\n\n");
      events.push({
        id: event.id,
        title: event.title || "Agenda",
        date: event.date,
        startTime: event.start_time,
        endTime: event.end_time,
        allDay: !event.start_time && !event.end_time
          || timeOnly(event.start_time) === "00:00" && timeOnly(event.end_time) === "23:59",
        location: event.location,
        description: details,
      });
    });

    const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Vena Pindah//Google Calendar Feed//ID",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...events.flatMap(event => eventLines(event, timestamp)),
      "END:VCALENDAR",
    ].map(foldLine);
    return new Response(`${lines.join("\r\n")}\r\n`, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "inline; filename=vena-pindah-calendar.ics",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[google-calendar-feed] Feed generation failed:", error);
    return new Response("Unable to generate calendar feed", { status: 500 });
  }
});