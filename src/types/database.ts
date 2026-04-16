/**
 * Database types for ShoeStore POS & Inventory.
 * These types mirror the PostgreSQL schema and will be replaced/augmented
 * by Supabase-generated types (`supabase gen types`) once migrations are applied.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'seller';

export type MovementType =
  | 'entry'
  | 'sale'
  | 'return'
  | 'adjustment'
  | 'transfer_out'
  | 'transfer_in';

export type SaleStatus = 'completed' | 'voided';

export type DiscountType = 'percentage' | 'fixed_amount';

export type TransferStatus = 'pending' | 'confirmed' | 'cancelled';

export type ReturnReason =
  | 'factory_defect'
  | 'wrong_size'
  | 'not_satisfied'
  | 'transport_damage'
  | 'other';

export type ReturnStatus = 'completed' | 'cancelled';

export type AdjustmentReason =
  | 'physical_count'
  | 'damage'
  | 'theft_loss'
  | 'system_error'
  | 'other';

export type StockAlertStatus = 'active' | 'acknowledged';

export type ReferenceType =
  | 'sale'
  | 'return'
  | 'transfer'
  | 'adjustment'
  | 'entry';

// ─── Base entity ─────────────────────────────────────────────────────────────

export interface Timestamps {
  created_at: string;
  updated_at: string;
}

// ─── Configuration tables ────────────────────────────────────────────────────

export interface Store extends Timestamps {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  tax_id: string;
  logo_url: string | null;
  return_policy_text: string | null;
  is_active: boolean;
}

export interface Size {
  id: string;
  value: string;
  sort_order: number;
}

export interface Color {
  id: string;
  name: string;
  hex_code: string;
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface Brand {
  id: string;
  name: string;
  is_active: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// ─── Users & Auth ────────────────────────────────────────────────────────────

export interface User extends Timestamps {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
}

export interface UserStore {
  id: string;
  user_id: string;
  store_id: string;
  created_at: string;
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export interface Product extends Timestamps {
  id: string;
  name: string;
  brand_id: string;
  category_id: string;
  description: string | null;
  base_price: number;
  cost: number;
  tax_rate: number;
  is_active: boolean;
  created_by: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  color: string | null;
  image_url: string;
  thumbnail_url: string | null;
  optimized_url: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface ProductVariant extends Timestamps {
  id: string;
  product_id: string;
  size_id: string;
  color_id: string;
  sku: string;
  barcode: string | null;
  price_override: number | null;
  is_active: boolean;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface StockLevel {
  id: string;
  variant_id: string;
  store_id: string;
  quantity: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  variant_id: string;
  store_id: string;
  movement_type: MovementType;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_type: ReferenceType | null;
  reference_id: string | null;
  note: string | null;
  user_id: string;
  created_at: string;
}

export interface StockTransfer {
  id: string;
  transfer_number: string;
  source_store_id: string;
  destination_store_id: string;
  status: TransferStatus;
  note: string | null;
  created_by: string;
  confirmed_at: string | null;
  created_at: string;
}

export interface TransferLine {
  id: string;
  transfer_id: string;
  variant_id: string;
  quantity: number;
}

export interface StockAdjustment {
  id: string;
  variant_id: string;
  store_id: string;
  quantity_before: number;
  quantity_after: number;
  reason: AdjustmentReason;
  note: string;
  adjusted_by: string;
  created_at: string;
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export interface Sale {
  id: string;
  ticket_number: string;
  store_id: string;
  seller_id: string;
  subtotal: number;
  discount_amount: number;
  discount_type: DiscountType | null;
  discount_value: number | null;
  tax_amount: number;
  total: number;
  status: SaleStatus;
  voided_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface SaleLine {
  id: string;
  sale_id: string;
  variant_id: string;
  product_name: string;
  variant_description: string;
  quantity: number;
  unit_price: number;
  line_discount: number;
  tax_rate: number;
  line_subtotal: number;
  line_tax: number;
  line_total: number;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  payment_method_id: string;
  amount: number;
  amount_received: number | null;
  change_amount: number | null;
}

export interface TicketSequence {
  id: string;
  store_id: string;
  year: number;
  last_sequence: number;
}

export interface TransferSequence {
  id: string;
  year: number;
  last_sequence: number;
}

// ─── Returns ─────────────────────────────────────────────────────────────────

export interface Return {
  id: string;
  return_number: string;
  original_sale_id: string;
  store_id: string;
  processed_by: string;
  approved_by: string | null;
  reason: ReturnReason;
  reason_note: string | null;
  refund_amount: number;
  status: ReturnStatus;
  created_at: string;
}

export interface ReturnLine {
  id: string;
  return_id: string;
  sale_line_id: string;
  variant_id: string;
  quantity: number;
  refund_amount: number;
}

// ─── Audit & Alerts ──────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  user_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string;
  store_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface StockAlert {
  id: string;
  variant_id: string;
  store_id: string;
  current_stock: number;
  threshold: number;
  status: StockAlertStatus;
  acknowledged_by: string | null;
  acknowledged_note: string | null;
  acknowledged_at: string | null;
  created_at: string;
}
