import supabase from '../lib/supabaseClient';
import { Profile, ProjectStatusConfig } from '../types';

const TABLE = 'profiles';
const TEMPLATE_ENVELOPE_KEYS = [
  'bookingFormTemplate',
  'chatTemplates',
  'billingTemplates',
  'invoiceShareTemplate',
  'receiptShareTemplate',
  'expenseShareTemplate',
  'portalShareTemplate',
  'checklistTemplates',
] as const;

function asJsonObject<T = any>(value: any): T | null {
  if (!value) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return null; }
  }
  return null;
}

function getTemplateEnvelope(value: any): Record<string, any> | null {
  const parsed = asJsonObject<Record<string, any>>(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return TEMPLATE_ENVELOPE_KEYS.some(key => key in parsed) ? parsed : null;
}

function fromRow(row: any): Profile {
  const templateEnvelope = getTemplateEnvelope(row.booking_form_template);
  return {
    id: row.id,
    adminUserId: row.admin_user_id || '',
    fullName: row.full_name || '',
    email: row.email || '',
    phone: row.phone || '',
    companyName: row.company_name || '',
    website: row.website || '',
    instagram: row.public_page_config?.socialMedia?.instagram || row.instagram || undefined,
    tiktok: row.public_page_config?.socialMedia?.tiktok || row.tiktok || undefined,
    facebook: row.public_page_config?.socialMedia?.facebook || row.facebook || undefined,
    youtube: row.public_page_config?.socialMedia?.youtube || row.youtube || undefined,
    secondaryPhone: row.public_page_config?.secondaryPhone || row.secondary_phone || undefined,
    address: row.address || '',
    bankAccount: row.bank_account || '',
    authorizedSigner: row.authorized_signer || '',
    idNumber: row.id_number || undefined,
    bio: row.bio || '',
    incomeCategories: row.income_categories || [],
    expenseCategories: row.expense_categories || [],
    projectTypes: row.project_types || [],
    eventTypes: row.event_types || [],
    assetCategories: row.asset_categories || [],
    sopCategories: row.sop_categories || [],
    packageCategories: row.package_categories || [],
    projectStatusConfig: (row.project_status_config || []) as ProjectStatusConfig[],
    notificationSettings: row.notification_settings && typeof row.notification_settings === 'object'
      ? { newProject: !!row.notification_settings.newProject, paymentConfirmation: !!row.notification_settings.paymentConfirmation, deadlineReminder: !!row.notification_settings.deadlineReminder }
      : { newProject: true, paymentConfirmation: true, deadlineReminder: true },
    securitySettings: row.security_settings && typeof row.security_settings === 'object'
      ? { twoFactorEnabled: !!row.security_settings.twoFactorEnabled }
      : { twoFactorEnabled: false },
    briefingTemplate: row.briefing_template || '',
    termsAndConditions: row.terms_and_conditions || undefined,
    logoBase64: row.logo_base64 || undefined,
    signatureBase64: row.signature_base64 || undefined,
    brandColor: row.brand_color || undefined,
    publicPageConfig: row.public_page_config ? {
      template: row.public_page_config.template || 'classic',
      title: row.public_page_config.title || 'Vena Pictures',
      introduction: row.public_page_config.introduction || '',
      galleryImages: row.public_page_config.galleryImages || [],
      backgroundImages: row.public_page_config.backgroundImages || {},
      pricelistPdfUrl: row.public_page_config.pricelistPdfUrl || undefined,
      regionPricelists: row.public_page_config.regionPricelists || undefined,
      weddingWorkflow: row.public_page_config.weddingWorkflow || undefined,
      smallEventWorkflow: row.public_page_config.smallEventWorkflow || undefined,
      workflows: row.public_page_config.workflows || undefined,
      packageTerms: row.public_page_config.packageTerms || undefined,
      packageOrder: row.public_page_config.packageOrder || undefined,
      addOnOrder: row.public_page_config.addOnOrder || undefined,
      socialMedia: row.public_page_config.socialMedia || undefined,
      secondaryPhone: row.public_page_config.secondaryPhone || undefined,
    } : {
      template: (row.public_page_template || 'classic') as any,
      title: row.public_page_title || 'Vena Pictures',
      introduction: row.public_page_introduction || '',
      galleryImages: [],
      backgroundImages: {},
      pricelistPdfUrl: undefined,
      regionPricelists: undefined,
      weddingWorkflow: undefined,
      smallEventWorkflow: undefined,
      workflows: undefined,
      packageTerms: undefined,
      packageOrder: undefined,
      addOnOrder: undefined,
      socialMedia: undefined,
      secondaryPhone: undefined,
    },
    packageShareTemplate: row.package_share_template || undefined,
    bookingFormTemplate: templateEnvelope
      ? (typeof templateEnvelope.bookingFormTemplate === 'string' ? templateEnvelope.bookingFormTemplate : undefined)
      : (row.booking_form_template || undefined),
    // Prefer dedicated column; else, fallback to booking_form_template JSON envelope { chatTemplates: [...] }
    chatTemplates: row.chat_templates || (templateEnvelope?.chatTemplates ?? []),
    billingTemplates: templateEnvelope?.billingTemplates ?? undefined,
    invoiceShareTemplate: templateEnvelope?.invoiceShareTemplate ?? undefined,
    receiptShareTemplate: templateEnvelope?.receiptShareTemplate ?? undefined,
    expenseShareTemplate: templateEnvelope?.expenseShareTemplate ?? undefined,
    portalShareTemplate: templateEnvelope?.portalShareTemplate ?? undefined,
    checklistTemplates: templateEnvelope?.checklistTemplates ?? undefined,
  } as Profile;
}

function toRow(p: Partial<Profile>): any {
  return {
    ...(p.adminUserId !== undefined ? { admin_user_id: p.adminUserId } : {}),
    ...(p.fullName !== undefined ? { full_name: p.fullName } : {}),
    ...(p.email !== undefined ? { email: p.email } : {}),
    ...(p.phone !== undefined ? { phone: p.phone } : {}),
    ...(p.companyName !== undefined ? { company_name: p.companyName } : {}),
    ...(p.website !== undefined ? { website: p.website } : {}),
    ...(p.address !== undefined ? { address: p.address } : {}),
    ...(p.bankAccount !== undefined ? { bank_account: p.bankAccount } : {}),
    ...(p.authorizedSigner !== undefined ? { authorized_signer: p.authorizedSigner } : {}),
    ...(p.idNumber !== undefined ? { id_number: p.idNumber } : {}),
    ...(p.bio !== undefined ? { bio: p.bio } : {}),
    ...(p.incomeCategories !== undefined ? { income_categories: p.incomeCategories } : {}),
    ...(p.expenseCategories !== undefined ? { expense_categories: p.expenseCategories } : {}),
    ...(p.projectTypes !== undefined ? { project_types: p.projectTypes } : {}),
    ...(p.eventTypes !== undefined ? { event_types: p.eventTypes } : {}),
    ...(p.assetCategories !== undefined ? { asset_categories: p.assetCategories } : {}),
    ...(p.sopCategories !== undefined ? { sop_categories: p.sopCategories } : {}),
    ...(p.packageCategories !== undefined ? { package_categories: p.packageCategories } : {}),
    ...(p.termsAndConditions !== undefined ? { terms_and_conditions: p.termsAndConditions } : {}),
    ...(p.logoBase64 !== undefined ? { logo_base64: p.logoBase64 || null } : {}),
    ...(p.signatureBase64 !== undefined ? { signature_base64: p.signatureBase64 || null } : {}),
    ...(p.brandColor !== undefined ? { brand_color: p.brandColor } : {}),
    ...(p.publicPageConfig !== undefined ? {
      // Only write to JSONB column that actually exists in the current schema
      public_page_config: p.publicPageConfig,
    } : {}),
    ...(p.projectStatusConfig !== undefined ? { project_status_config: p.projectStatusConfig } : {}),
    ...(p.packageShareTemplate !== undefined ? { package_share_template: p.packageShareTemplate } : {}),
    ...(p.bookingFormTemplate !== undefined ? { booking_form_template: p.bookingFormTemplate } : {}),
    ...(p.briefingTemplate !== undefined ? { briefing_template: p.briefingTemplate } : {}),
    ...(p.notificationSettings !== undefined ? { notification_settings: p.notificationSettings } : {}),
    ...(p.securitySettings !== undefined ? { security_settings: p.securitySettings } : {}),
    ...(p.chatTemplates !== undefined ? { chat_templates: p.chatTemplates } : {}),
  };
}

export async function getProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from(TABLE).select('*').limit(1).maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? fromRow(data) : null;
}

export async function upsertProfile(input: Partial<Profile> & { id?: string }): Promise<Profile> {
  // Declare payload variable at function scope
  let bookingFormTemplatePayload: string | undefined = undefined;

  // If any of the templates are provided, merge into booking_form_template JSON envelope
  if (
    input.chatTemplates !== undefined ||
    input.bookingFormTemplate !== undefined ||
    input.billingTemplates !== undefined ||
    input.invoiceShareTemplate !== undefined ||
    input.receiptShareTemplate !== undefined ||
    input.expenseShareTemplate !== undefined ||
    input.portalShareTemplate !== undefined ||
    input.checklistTemplates !== undefined
  ) {
    let existingEnvelope: any = {};
    const hasCompleteEnvelope = TEMPLATE_ENVELOPE_KEYS.every(key =>
      Object.prototype.hasOwnProperty.call(input, key),
    );
    if (hasCompleteEnvelope) {
      existingEnvelope = Object.fromEntries(
        TEMPLATE_ENVELOPE_KEYS
          .filter(key => input[key] !== undefined)
          .map(key => [key, input[key]]),
      );
    } else if (input.id) {
      const { data: current, error: readError } = await supabase
        .from(TABLE)
        .select('booking_form_template')
        .eq('id', input.id)
        .maybeSingle();
      if (readError) throw readError;
      const parsed = getTemplateEnvelope(current?.booking_form_template);
      if (parsed) {
        existingEnvelope = parsed;
      } else if (typeof current?.booking_form_template === 'string' && current.booking_form_template) {
        existingEnvelope = { bookingFormTemplate: current.booking_form_template };
      }
    }
    const merged: any = { ...existingEnvelope };
    if (input.bookingFormTemplate !== undefined) merged.bookingFormTemplate = input.bookingFormTemplate;
    if (input.chatTemplates !== undefined) merged.chatTemplates = input.chatTemplates;
    if (input.billingTemplates !== undefined) merged.billingTemplates = input.billingTemplates;
    if (input.invoiceShareTemplate !== undefined) merged.invoiceShareTemplate = input.invoiceShareTemplate;
    if (input.receiptShareTemplate !== undefined) merged.receiptShareTemplate = input.receiptShareTemplate;
    if (input.expenseShareTemplate !== undefined) merged.expenseShareTemplate = input.expenseShareTemplate;
    if (input.portalShareTemplate !== undefined) merged.portalShareTemplate = input.portalShareTemplate;
    if (input.checklistTemplates !== undefined) merged.checklistTemplates = input.checklistTemplates;

    bookingFormTemplatePayload = JSON.stringify(merged);
  }

  let publicPageConfigPayload = input.publicPageConfig;
  const hasSocialOrExtra = (
    input.instagram !== undefined ||
    input.tiktok !== undefined ||
    input.facebook !== undefined ||
    input.youtube !== undefined ||
    input.secondaryPhone !== undefined
  );

  if (hasSocialOrExtra) {
    let existingConfig: any = input.publicPageConfig ? { ...input.publicPageConfig } : {};
    if (!input.publicPageConfig && input.id) {
      try {
        const { data: current } = await supabase
          .from(TABLE)
          .select('public_page_config')
          .eq('id', input.id)
          .maybeSingle();
        if (current?.public_page_config && typeof current.public_page_config === 'object') {
          existingConfig = { ...current.public_page_config };
        }
      } catch (err) {
        console.warn('[ProfileService] Failed to fetch existing public_page_config:', err);
      }
    }
    const existingSocial = existingConfig.socialMedia || {};
    publicPageConfigPayload = {
      ...existingConfig,
      socialMedia: {
        ...existingSocial,
        ...(input.instagram !== undefined ? { instagram: input.instagram } : {}),
        ...(input.tiktok !== undefined ? { tiktok: input.tiktok } : {}),
        ...(input.facebook !== undefined ? { facebook: input.facebook } : {}),
        ...(input.youtube !== undefined ? { youtube: input.youtube } : {}),
      },
      ...(input.secondaryPhone !== undefined ? { secondaryPhone: input.secondaryPhone } : (existingConfig.secondaryPhone !== undefined ? { secondaryPhone: existingConfig.secondaryPhone } : {})),
    };
  }

  const row = toRow({
    ...input,
    bookingFormTemplate: bookingFormTemplatePayload ?? input.bookingFormTemplate,
    ...(publicPageConfigPayload !== undefined ? { publicPageConfig: publicPageConfigPayload } : {}),
  } as any);
  if (!input.id && !row.admin_user_id) {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Sesi autentikasi tidak ditemukan.');
    row.admin_user_id = data.user.id;
  }
  if (input.id) {
    const { data, error } = await supabase
      .from(TABLE)
      .update(row)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw error;
    return fromRow(data);
  } else {
    const { data, error } = await supabase.from(TABLE).insert(row).select('*').single();
    if (error) throw error;
    return fromRow(data);
  }
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) throw new Error('Profile tidak ditemukan');

  return upsertProfile({ ...profile, ...patch });
}
