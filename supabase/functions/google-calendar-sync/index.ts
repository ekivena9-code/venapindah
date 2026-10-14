import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
};

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return respond({ error: "Calendar feed is not configured." }, 500);
  if (!authorization) return respond({ error: "Unauthorized." }, 401);

  try {
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user?.email) return respond({ error: "Unauthorized." }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userById, error: userByIdError } = await adminClient
      .from("users").select("id,email,role").eq("id", authData.user.id).maybeSingle();
    if (userByIdError) throw userByIdError;
    let appUser = userById?.email?.toLowerCase() === authData.user.email.toLowerCase() ? userById : null;
    if (!appUser) {
      const { data: matches, error: lookupError } = await adminClient
        .from("users").select("id,email,role").ilike("email", authData.user.email).limit(2);
      if (lookupError) throw lookupError;
      appUser = matches?.length === 1 && matches[0].email.toLowerCase() === authData.user.email.toLowerCase()
        ? matches[0]
        : null;
    }
    if (appUser?.role !== "Admin") return respond({ error: "Admin access is required." }, 403);

    const body = await req.json().catch(() => null);
    const action = body?.action;
    if (action === "status") {
      const { count, error } = await adminClient
        .from("google_calendar_feed_tokens").select("token_hash", { count: "exact", head: true });
      if (error) throw error;
      return respond({ active: (count || 0) > 0 });
    }

    if (action === "revoke") {
      const { error } = await adminClient.from("google_calendar_feed_tokens").delete().not("token_hash", "is", null);
      if (error) throw error;
      return respond({ active: false });
    }

    if (action === "create") {
      const randomToken = new Uint8Array(32);
      crypto.getRandomValues(randomToken);
      const token = Array.from(randomToken, byte => byte.toString(16).padStart(2, "0")).join("");
      const tokenHash = await sha256(token);
      const { error: deleteError } = await adminClient
        .from("google_calendar_feed_tokens").delete().not("token_hash", "is", null);
      if (deleteError) throw deleteError;
      const { error: insertError } = await adminClient.from("google_calendar_feed_tokens").insert({
        token_hash: tokenHash,
        created_by: authData.user.id,
      });
      if (insertError) throw insertError;

      const baseUrl = supabaseUrl.replace(/\/+$/, "");
      return respond({ active: true, url: `${baseUrl}/functions/v1/google-calendar-feed?token=${token}` });
    }

    return respond({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("[google-calendar-sync] Request failed:", error);
    return respond({ error: error instanceof Error ? error.message : "Request failed." }, 500);
  }
});