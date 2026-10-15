import React from 'react';

export type NavigationAction = {
  type: string;
  id?: string;
  tab?: 'info' | 'project' | 'payment' | 'invoice';
};

export interface ChatMessage {
  id: string;
  sender: 'vendor' | 'client';
  text: string;
  timestamp: string; // ISO date string
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string; // ISO date string
  isRead: boolean;
  icon: 'lead' | 'deadline' | 'feedback' | 'payment' | 'completed' | 'comment';
  link?: {
    view: ViewType;
    action?: NavigationAction;
  };
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  isActive: boolean;
  usageCount: number;
  maxUsage?: number | null;
  expiryDate?: string | null;
  createdAt: string;
}



export interface ChatTemplate {
  id: string;
  title: string;
  template: string;
}

export enum ViewType {
  HOMEPAGE = 'Homepage',
  DASHBOARD = 'Dashboard',
  "Calon Pengantin" = 'Calon Pengantin',
  BOOKING = 'Booking',
  CLIENTS = 'Manajemen Pengantin',
  PROJECTS = 'Proyek',
  TEAM = 'Tim / Vendor',
  FINANCE = 'Keuangan',
  CALENDAR = 'Kalender',
  CLIENT_REPORTS = 'Laporan Pengantin',
  PACKAGES = 'Input Package',
  PROMO_CODES = 'Kode Promo',
  ASSETS = 'Manajemen Aset',
  SOCIAL_MEDIA_PLANNER = 'Perencana Media Sosial',
  MARKETING = 'Marketing',
  GALLERY = 'Pricelist Upload',
  SETTINGS = 'Pengaturan',
  CONTRACTS = 'Kontrak',
  VENDOR_PROFILE = 'Profil Vendor',
  BIO_LINKS = 'Link Publik',
  INVOICES = 'Daftar Invoice',
  MIGRATION = 'Migrasi & Import Data',
}

export interface SubStatusConfig {
  name: string;
  note: string;
}

export interface ProjectStatusConfig {
  id: string;
  name: string;
  color: string; // hex color
  // Optional default progress (0-100) for this status. Used when no sub-status progress is computed.
  defaultProgress?: number;
  subStatuses: SubStatusConfig[];
  note: string;
}

export enum PaymentStatus {
  LUNAS = 'Lunas',
  DP_TERBAYAR = 'DP Terbayar',
  BELUM_BAYAR = 'Belum Bayar'
}

export interface GalleryImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  uploadedAt: string;
}

export interface Gallery {
  id: string;
  user_id: string;
  title: string;
  region: string;
  description?: string;
  is_public: boolean;
  public_id: string;
  // Optional: custom booking link to be shown on the public gallery page
  booking_link?: string;
  cover_image_url?: string;
  pdf_url?: string;
  pdf_name?: string;
  images: GalleryImage[];
  created_at: string;
  updated_at?: string;
}

export interface PortfolioImage {
  id: string;
  url: string;
  uploadedAt: string;
}

export interface VendorPortfolio {
  id: string;
  user_id: string;
  title: string;
  category: string;
  cover_image_url?: string;
  youtube_url?: string;
  images: PortfolioImage[];
  created_at: string;
  updated_at?: string;
}

export enum ClientStatus {
  LEAD = 'Calon Pengantin',
  ACTIVE = 'Aktif',
  INACTIVE = 'Tidak Aktif',
  LOST = 'Hilang'
}

export enum ClientType {
  DIRECT = 'Langsung',
  VENDOR = 'Vendor',
}

export enum LeadStatus {
  DISCUSSION = 'Sedang Diskusi',
  FOLLOW_UP = 'Menunggu Follow Up',
  CONVERTED = 'Dikonversi',
  REJECTED = 'Ditolak',
}

export enum ContactChannel {
  WHATSAPP = 'WhatsApp',
  INSTAGRAM = 'Instagram',
  WEBSITE = 'Website',
  PHONE = 'Telepon',
  REFERRAL = 'Referensi',
  SUGGESTION_FORM = 'Form Saran',
  OTHER = 'Lainnya',
}

export enum CardType {
  PRABAYAR = 'Prabayar',
  KREDIT = 'Kredit',
  DEBIT = 'Debit',
  TUNAI = 'Tunai'
}

export enum PerformanceNoteType {
  PRAISE = 'Pujian',
  CONCERN = 'Perhatian',
  LATE_DEADLINE = 'Keterlambatan Deadline',
  GENERAL = 'Umum',
}

export enum SatisfactionLevel {
  VERY_SATISFIED = 'Sangat Puas',
  SATISFIED = 'Puas',
  NEUTRAL = 'Biasa Saja',
  UNSATISFIED = 'Tidak Puas',
}



export enum PostType {
  INSTAGRAM_FEED = 'Instagram Feed',
  INSTAGRAM_STORY = 'Instagram Story',
  INSTAGRAM_REELS = 'Instagram Reels',
  TIKTOK = 'TikTok Video',
  BLOG = 'Artikel Blog',
}

export enum PostStatus {
  DRAFT = 'Draf',
  SCHEDULED = 'Terjadwal',
  POSTED = 'Diposting',
  CANCELED = 'Dibatalkan',
}



export interface PerformanceNote {
  id: string;
  date: string; // ISO date string
  note: string;
  type: PerformanceNoteType;
}

export interface User {
  id: string;
  email: string;
  password: string;
  fullName: string;
  companyName?: string;
  role: 'Admin' | 'Member' | 'Kasir';
  permissions?: ViewType[];
  restrictedCards?: string[]; // IDs of cards that user cannot access
}

export interface Lead {
  id: string;
  name: string;
  contactChannel: ContactChannel;
  location: string;
  status: LeadStatus;
  date: string; // ISO date string of contact
  notes?: string;
  whatsapp?: string;
  address?: string;
  eventDate?: string; // Planned wedding event date
  createdAt?: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  name: string;
  avatarUrl?: string;
  email: string;
  phone: string;
  whatsapp?: string;
  since: string;
  instagram?: string;
  status: ClientStatus;
  clientType: ClientType;
  lastContact: string; // ISO Date String
  portalAccessId: string;
  address?: string;
  homeAddress?: string; // Alamat rumah pengantin untuk pengiriman cetakan
  createdAt?: string;
  updatedAt?: string;
}

export interface PhysicalItem {
  name: string;
  price: number;
}

// Optional per-duration pricing for packages
export interface DurationOption {
  label: string; // e.g., '2 Jam', '4 Jam', '8 Jam', 'Full Day'
  price: number;
  default?: boolean; // optional flag for default selection/display
  // Optional: per-option details (overrides package-level when set)
  photographers?: string;
  videographers?: string;
  processingTime?: string;
  digitalItems?: string[];
  physicalItems?: PhysicalItem[];
}

export interface Package {
  id: string;
  name: string;
  price: number;
  category: string;
  // Optional: operational region for this package
  region?: Region;
  physicalItems: PhysicalItem[];
  digitalItems: string[];
  processingTime: string;
  defaultPrintingCost?: number;
  defaultTransportCost?: number;
  photographers?: string;
  videographers?: string;
  coverImage?: string; // base64 image string
  // Optional: flexible duration-based pricing options
  durationOptions?: DurationOption[];
}

// Supported regions for packages and public booking links
export type Region = string; // allow custom region values; REGIONS below are suggestions
export const REGIONS: { value: Region; label: string }[] = [
  { value: 'vendor', label: 'Vendor' },
  { value: 'jabodetabek', label: 'Jabodetabek' },
  { value: 'banten', label: 'Banten' },
];

export interface AddOn {
  id: string;
  name: string;
  price: number;
  region?: Region; // optional region scoping for add-ons
}

export interface TeamMember {
  id: string;
  name: string;
  role: string; // Fotografer, Videografer, Editor etc.
  email: string;
  phone: string;
  avatarUrl?: string;
  standardFee: number;
  noRek?: string;
  bankName?: string;
  specialization?: string;
  location?: string;
  emergencyContact?: string;

  rating: number; // 1-5 star rating
  performanceNotes: PerformanceNote[];
  portalAccessId: string;
  category: 'Tim' | 'Vendor';
  createdAt?: string;
  updatedAt?: string;
}

export interface AssignedTeamMember {
  id?: string;
  memberId: string;
  name: string;
  role: string;
  fee: number; // The fee for THIS project

  subJob?: string;
}

export interface PrintingItem {
  id: string;
  type: 'Cetak Album' | 'Cetak Foto' | 'Flashdisk' | 'Custom';
  customName?: string;
  details: string;
  cost: number;
  paid?: boolean;
  // Optional granular payment flag used by UI; preferred over boolean 'paid'
  paymentStatus?: 'Paid' | 'Unpaid';
}

export interface TransportItem {
  id: string;
  description: string; // e.g., 'Transport ke Bandung', 'Parkir', 'Tol'
  cost: number;
  paymentStatus?: 'Paid' | 'Unpaid';
  paymentType?: 'card' | 'pocket'; // Tipe pembayaran: kartu atau kantong
  cardId?: string; // Kartu yang digunakan untuk pembayaran
  pocketId?: string; // Kantong yang digunakan untuk pembayaran
  paidAt?: string; // Tanggal pembayaran
  notes?: string; // Catatan tambahan
}

export enum BookingStatus {
  BARU = 'Baru',
  TERKONFIRMASI = 'Terkonfirmasi',
  DITOLAK = 'Ditolak',
}

export interface StatusHistoryEntry {
  type: 'status' | 'sub-status';
  name: string;
  value: string | boolean;
  timestamp: string;
}

export interface WeddingDayChecklist {
  id: string;
  projectId: string;
  category: string;
  itemName: string;
  isCompleted: boolean;
  assignedTo?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChecklistTemplate {
  category: string;
  items: string[];
}

export interface Project {
  id: string;
  projectName: string;
  clientName: string;
  clientId: string;
  projectType: string;
  packageName: string;
  packageId: string;
  addOns: AddOn[];
  additionalPackages?: AddOn[];
  date: string;
  deadlineDate?: string;
  location: string;
  progress: number; // 0-100
  status: string;
  activeSubStatuses?: string[];
  totalCost: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  team: AssignedTeamMember[];
  notes?: string;
  accommodation?: string;
  driveLink?: string;
  clientDriveLink?: string;
  finalDriveLink?: string;
  startTime?: string;
  endTime?: string;
  image?: string; // Optional cover image URL
  color?: string; // Custom defined color for the event
  statusHistory?: StatusHistoryEntry[];
  tasks?: { id: string; name: string; completed: boolean }[];

  promoCodeId?: string;
  discountAmount?: number;
  shippingDetails?: string;
  dpProofUrl?: string;
  printingDetails?: PrintingItem[];
  printingCost?: number;
  transportCost?: number;
  transportPaid?: boolean;
  transportNote?: string;
  printingCardId?: string;
  transportCardId?: string;
  // New: Detailed transport items tracking
  transportDetails?: TransportItem[];
  transportUsed?: boolean; // Apakah transport digunakan atau tidak
  // Additional operational costs captured per project (JSONB in DB)
  customCosts?: CustomCost[];
  isEditingConfirmedByClient?: boolean;
  isPrintingConfirmedByClient?: boolean;
  isDeliveryConfirmedByClient?: boolean;
  confirmedSubStatuses?: string[];
  clientSubStatusNotes?: Record<string, string>;
  subStatusConfirmationSentAt?: Record<string, string>; // e.g. { 'Seleksi Foto': '2023-10-27T10:00:00Z' }
  completedDigitalItems?: string[];
  invoiceSignature?: string;
  customSubStatuses?: SubStatusConfig[];
  bookingStatus?: BookingStatus;
  rejectionReason?: string;
  chatHistory?: ChatMessage[];
  // Explicit duration selection and per-unit price persisted at project level
  durationSelection?: string; // e.g., '4 Jam' - label from Package.durationOptions
  unitPrice?: number; // unit price used for package at time of booking
  address?: string; // specific venue address
  googleMapsLink?: string;
  weddingDayChecklist?: WeddingDayChecklist[];
  createdAt?: string;
  updatedAt?: string;
}

// Custom operational cost item
export interface CustomCost {
  id: string;
  description: string;
  amount: number;
}

export interface Contract {
  id: string;
  contractNumber: string;
  clientId: string;
  projectId: string;
  signingDate: string;
  signingLocation: string;
  serviceTitle?: string; // e.g. "JASA CORPORATE / EVENT"
  clientName1: string;
  clientAddress1: string;
  clientPhone1: string;
  clientName2?: string;
  clientAddress2?: string;
  clientPhone2?: string;
  shootingDuration: string;
  guaranteedPhotos: string;
  albumDetails: string;
  digitalFilesFormat: string;
  otherItems: string;
  personnelCount: string;
  deliveryTimeframe: string;
  dpDate: string;
  finalPaymentDate: string;
  cancellationPolicy: string;
  jurisdiction: string;
  pasal1Content?: string;
  pasal2Content?: string;
  pasal3Content?: string;
  pasal4Content?: string;
  pasal5Content?: string;
  closingText?: string;
  vendorSignature?: string;
  clientSignature?: string;
  includeMeterai?: boolean;
  meteraiPlacement?: 'client' | 'both';
  createdAt: string;
}

export enum TransactionType {
  INCOME = 'Pemasukan',
  EXPENSE = 'Pengeluaran'
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  projectId?: string;
  category: string;
  method: 'Transfer Bank' | 'Tunai' | 'E-Wallet' | 'Sistem' | 'Kartu';
  pocketId?: string;
  cardId?: string;
  printingItemId?: string;
  vendorSignature?: string;
  createdAt?: string;
  updatedAt?: string;
}

export enum PocketType {
  SAVING = 'Nabung & Bayar',
  LOCKED = 'Terkunci',
  SHARED = 'Bersama',
  EXPENSE = 'Anggaran Pengeluaran'

}

export interface FinancialPocket {
  id: string;
  name: string;
  description: string;
  icon: 'piggy-bank' | 'lock' | 'users' | 'clipboard-list' | 'star';
  type: PocketType;
  amount: number;
  goalAmount?: number; // for SAVING and EXPENSE type
  lockEndDate?: string; // for LOCKED type
  members?: TeamMember[]; // for SHARED type
  sourceCardId?: string; // Links this pocket to a physical card
}

export interface Card {
  id: string;
  cardHolderName: string;
  bankName: string; // e.g., 'WBank', 'VISA'
  cardType: CardType;
  lastFourDigits: string; // e.g., "3090"
  expiryDate?: string; // MM/YY e.g., "09/24"
  balance: number;
  colorGradient: string; // tailwind gradient class e.g. 'from-blue-500 to-sky-400'
}

export interface NotificationSettings {
  newProject: boolean;
  paymentConfirmation: boolean;
  deadlineReminder: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
}

export interface WorkflowItem {
  id: string;
  title: string;
  timeline: string[];
  description?: string;
}

export interface PackageTermItem {
  id: string;
  title: string;
  items: string[];
}

export interface RegionPricelistPdf {
  id: string;
  region: string; // e.g. 'banten', 'jabodetabek', 'vendor'
  regionLabel?: string;
  title: string; // e.g. 'Pricelist Wilayah Banten 2025'
  pdfUrl: string; // base64 or URL
  fileName?: string;
  fileSize?: string;
  buttonLabel?: string; // Teks khusus untuk tombol download PDF di halaman publik
  updatedAt?: string;
}

export interface PublicPageConfig {
  template: 'classic' | 'modern' | 'gallery';
  title: string;
  introduction: string;
  galleryImages: string[]; // Array of base64 image strings or Supabase Storage URLs
  backgroundImages?: {
    clientDetail?: string;
    eventDetail?: string;
    bookingForm?: string;
    portalPengantin?: string;
    leadForm?: string;
  };
  pricelistPdfUrl?: string; // URL untuk PDF pricelist yang di-upload (legacy single)
  regionPricelists?: RegionPricelistPdf[]; // CRUD Pricelist PDF per wilayah/daerah
  weddingWorkflow?: {
    title: string;
    timeline: string[];
  };
  smallEventWorkflow?: {
    title: string;
    timeline: string[];
  };
  workflows?: WorkflowItem[]; // Dynamic CRUD workflows for public page & package catalog
  packageTerms?: PackageTermItem[]; // Dynamic CRUD terms and conditions for packages
  packageOrder?: string[]; // Ordered array of package IDs for display ordering
  addOnOrder?: string[]; // Ordered array of add-on IDs for display ordering
  socialMedia?: {
    instagram?: string;
    tiktok?: string;
    facebook?: string;
    youtube?: string;
    whatsapp?: string;
  };
  secondaryPhone?: string;
}

export interface Profile {
  id: string;
  adminUserId: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  website: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  youtube?: string;
  secondaryPhone?: string;
  address: string;
  bankAccount: string;
  authorizedSigner: string;
  idNumber?: string;
  bio: string;
  incomeCategories: string[];
  expenseCategories: string[];
  projectTypes: string[];
  eventTypes: string[];
  assetCategories: string[];
  sopCategories: string[];
  packageCategories: string[];
  projectStatusConfig: ProjectStatusConfig[];
  notificationSettings: NotificationSettings;
  securitySettings: SecuritySettings;
  briefingTemplate: string;
  termsAndConditions?: string;
  logoBase64?: string;
  signatureBase64?: string;
  brandColor?: string;
  publicPageConfig: PublicPageConfig;
  packageShareTemplate?: string;
  bookingFormTemplate?: string;
  chatTemplates?: ChatTemplate[];
  billingTemplates?: ChatTemplate[];
  invoiceShareTemplate?: string;
  receiptShareTemplate?: string;
  expenseShareTemplate?: string;
  portalShareTemplate?: string;
  checklistTemplates?: ChecklistTemplate[];
  contractTemplate?: string;
  mobileUiScale?: number | null;
}

export interface TeamProjectPayment {
  id: string;
  projectId: string;
  teamMemberName: string;
  teamMemberId: string;
  role?: string;
  date: string;
  status: 'Paid' | 'Unpaid';
  fee: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamPaymentRecord {
  id: string;
  recordNumber: string;
  teamMemberId: string;
  date: string;
  projectPaymentIds: string[];
  totalAmount: number;
  vendorSignature?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorProfileFaq {
  id: string;
  question: string;
  answer: string;
}

export interface VendorProfilePartner {
  id: string;
  name: string;
  logo_url: string;
}

export interface VendorProfileVideo {
  id: string;
  title: string;
  url: string;
}

export interface VendorProfile {
  id: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image_url?: string;
  hero_images?: string[];
  page_banner_title?: string;
  page_banner_subtitle?: string;
  page_banner_image_url?: string;
  whatsapp_number: string;
  info_images: string[]; // URLs of info images
  faqs?: VendorProfileFaq[];
  partners?: VendorProfilePartner[];
  videos?: VendorProfileVideo[];
  created_at: string;
  updated_at: string;
}

export interface BioLink {
  id: string;
  title: string;
  url: string;
}

export interface BioLinkPage {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  whatsapp_number: string;
  whatsapp_label: string;
  avatar_url: string;
  cover_url: string;
  links: BioLink[];
  is_published: boolean;
  updated_at: string;
}

export interface ClientFeedback {
  id: string;
  clientName: string;
  satisfaction: SatisfactionLevel;
  rating: number; // 1-5
  feedback: string;
  date: string; // ISO date string
}

export interface FreelancerFeedback {
  id: string;
  freelancerId: string;
  teamMemberName: string;
  date: string; // ISO date string
  message: string;
}

export interface SocialMediaPost {
  id: string;
  projectId: string;
  clientName: string;
  postType: PostType;
  platform: 'Instagram' | 'TikTok' | 'Website';
  scheduledDate: string; // ISO date string
  caption: string;
  mediaUrl?: string; // Link to the image/video in GDrive
  status: PostStatus;
  notes?: string;
}

export interface VendorData {
  clients: Client[];
  projects: Project[];
  teamMembers: TeamMember[];
  transactions: Transaction[];
  teamProjectPayments: TeamProjectPayment[];
  teamPaymentRecords: TeamPaymentRecord[];
  pockets: FinancialPocket[];
  profile: Profile;
  leads: Lead[];

  cards: Card[];
  clientFeedback: ClientFeedback[];
  notifications: Notification[];
  promoCodes: PromoCode[];
  packages: Package[];
  addOns: AddOn[];
}

// --- Component Prop Interfaces ---

export interface PublicBookingFormProps {
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  setPockets: React.Dispatch<React.SetStateAction<FinancialPocket[]>>;
  setPromoCodes: React.Dispatch<React.SetStateAction<PromoCode[]>>;
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  showNotification: (message: string) => void;
  userProfile: Profile;
  packages: Package[];
  addOns: AddOn[];
  cards: Card[];
  pockets: FinancialPocket[];
  promoCodes: PromoCode[];
  leads: Lead[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
}
export interface PublicLeadFormProps {
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  userProfile: Profile;
  showNotification: (message: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
}

export interface ClientPortalProps {
  accessId: string;
  clients: Client[];
  projects: Project[];
  transactions: Transaction[];
  setClientFeedback: React.Dispatch<React.SetStateAction<ClientFeedback[]>>;
  showNotification: (message: string) => void;
  userProfile: Profile;
  packages: Package[];
  onClientSubStatusConfirmation: (projectId: string, subStatusName: string, note: string) => void;
  teamMembers: TeamMember[];
}

export interface FreelancerPortalProps {
  accessId: string;
  teamMembers: TeamMember[];
  clients?: Client[];
  projects: Project[];
  teamProjectPayments: TeamProjectPayment[];
  teamPaymentRecords: TeamPaymentRecord[];

  showNotification: (message: string) => void;

  userProfile: Profile;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
}

export enum EventType {
  WEDDING = 'Wedding',
  MEETING = 'Meeting',
  PREPARATION = 'Preparation',
  FITTING = 'Fitting',
  VENDOR = 'Vendor',
  INTERNAL = 'Internal',
  FOLLOW_UP = 'Follow Up',
  OTHER = 'Other',
}

export enum EventStatus {
  PLANNED = 'Planned',
  CONFIRMED = 'Confirmed',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export interface CalendarEvent {
  id: string;
  title: string;
  eventType: EventType;
  status: EventStatus;
  date?: string;
  startAt: string; // ISO Date String
  endAt: string;   // ISO Date String
  allDay: boolean;
  
  // Relasi (semua nullable)
  projectId?: string;
  clientId?: string;
  teamMemberId?: string;
  vendorId?: string;
  
  location?: string;
  notes?: string;
  tasks?: { id: string; name: string; completed: boolean }[];
  
  createdAt: string;
  updatedAt: string;
}
