import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "utils/supabase/info";

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// ── Types ────────────────────────────────────────────────────

export type UserRole = "admin" | "project_manager" | "sales_rep" | "foreman" | "team_member";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone?: string | null;
  email?: string | null;
  permissions: {
    can_create_proposals: boolean;
    can_edit_sold_contracts: boolean;
    can_view_financials: boolean;
    can_manage_products: boolean;
    can_manage_users: boolean;
  };
  commission_rate: number;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  order_index: number;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface LeadSource {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  lead_source_id: string | null;
  pipeline_stage_id: string | null;
  requested_services: string | null;
  location_lat: number | null;
  location_lng: number | null;
  is_discarded: boolean;
  discarded_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  lead_source?: LeadSource;
  pipeline_stage?: PipelineStage;
}

export interface ClientNote {
  id: string;
  client_id: string;
  user_id: string | null;
  content: string;
  is_system_generated: boolean;
  action_type: string | null;
  created_at: string;
  profile?: Pick<Profile, "first_name" | "last_name">;
}

export interface ClientFile {
  id: string;
  client_id: string;
  user_id: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  assigned_to: string | null;
  title: string;
  appointment_date: string;
  appointment_time: string;
  notes: string | null;
  google_calendar_event_id: string | null;
  email_notification_sent: boolean;
  created_by: string | null;
  created_at: string;
  profile?: Pick<Profile, "first_name" | "last_name">;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProductService {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  unit: string;
  material_cost: number;
  labor_cost: number;
  markup_percentage: number;
  sales_tax_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: ServiceCategory;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type EstimateStatus = "draft" | "saved" | "sent" | "accepted" | "declined";

export interface Estimate {
  id: string;
  client_id: string;
  created_by: string | null;
  estimate_number: number;
  title: string;
  description: string | null;
  status: EstimateStatus;
  subtotal: number;
  discount_percentage: number;
  discount_amount: number;
  tax_label: string;
  tax_rate: number;
  tax_amount: number;
  total: number;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Pick<Client, "first_name" | "last_name" | "email" | "phone" | "address" | "city" | "state" | "zip">;
  line_items?: EstimateLineItem[];
  payment_schedules?: PaymentSchedule[];
}

export interface EstimateLineItem {
  id: string;
  estimate_id: string;
  product_service_id: string | null;
  name: string;
  description: string | null;
  unit: string;
  quantity: number;
  material_cost: number;
  labor_cost: number;
  markup_percentage: number;
  client_price: number;
  sort_order: number;
  created_at: string;
}

export interface PaymentSchedule {
  id: string;
  estimate_id: string;
  label: string;
  percentage: number;
  amount: number;
  sort_order: number;
  created_at: string;
}

export type ContractStatus = "pending" | "sent" | "signed" | "declined" | "voided";

export interface Contract {
  id: string;
  client_id: string;
  estimate_id: string | null;
  docusign_envelope_id: string | null;
  docusign_template_id: string | null;
  status: ContractStatus;
  signed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  id: string;
  company_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string | null;
  default_tax_rate: number;
  default_tax_label: string;
  monthly_revenue_goal: number;
  warranty_text: string | null;
  estimate_footer_text: string | null;
}
