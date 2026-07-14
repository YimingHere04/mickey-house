/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'member';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string;
  linked_user_id?: string | null;
}

export type BillCategory = 'Rent' | 'TNB' | 'Air Selangor' | 'Maxis';

export interface Bill {
  id: string;
  category: BillCategory;
  total_amount: number;
  billing_month: string; // e.g., "2026-07"
  document_url: string | null; // URL to the uploaded official PDF/photo
  created_at: string;
}

export type PaymentStatus = 'Unpaid' | 'Pending' | 'Paid' | 'Reject';

export interface Payment {
  id: string;
  bill_id: string;
  user_id: string;
  amount_due: number;
  status: PaymentStatus;
  receipt_url: string | null; // URL to user's uploaded bank transfer receipt
  created_at: string;
}

// Join structure used for rendering payments with bill and user info
export interface PaymentWithDetails extends Payment {
  bill?: Bill;
  user?: UserProfile;
}
