-- ====================================================================
-- Shared House Expense Manager - Supabase SQL Setup Script
-- Paste this script directly into your Supabase SQL Editor.
-- ====================================================================

-- 1. Profiles (Users) Table
-- Extends Supabase auth.users with custom metadata (role, name)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Bills Table
-- Created by Admin to list official rental or utility invoices
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('Rent', 'TNB', 'Air Selangor', 'Maxis')),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount > 0),
    billing_month VARCHAR(7) NOT NULL, -- e.g., '2026-07'
    document_url TEXT, -- Path in Supabase Storage 'bills' bucket
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Bills
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- 3. Payments Table
-- Auto-divided amounts assigned to members for a specific bill
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    amount_due NUMERIC(10, 2) NOT NULL CHECK (amount_due >= 0),
    status TEXT NOT NULL CHECK (status IN ('Unpaid', 'Pending Verification', 'Paid')) DEFAULT 'Unpaid',
    receipt_url TEXT, -- Path in Supabase Storage 'receipts' bucket
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;


-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- --- Profiles Table Policies ---

-- Members and Admins can view all profiles in the same household to calculate splits
CREATE POLICY "Users can view all household profiles" 
ON public.profiles FOR SELECT 
USING (true);

-- Users can edit their own profile details
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- Only Admins can insert or delete profiles directly (usually handled via Auth sign up or admin dashboard)
CREATE POLICY "Only admins can perform full management on profiles"
ON public.profiles FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);


-- --- Bills Table Policies ---

-- Any logged-in member can view the shared bills
CREATE POLICY "Users can view shared bills"
ON public.bills FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only Admins can insert, update, or delete bills
CREATE POLICY "Only admins can manage bills"
ON public.bills FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);


-- --- Payments Table Policies ---

-- Members can only fetch or view payments assigned directly to themselves
-- Admins can view ALL payments to check status
CREATE POLICY "Users can view assigned payments or admins can view all"
ON public.payments FOR SELECT
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Members can update their own payments (specifically to upload receipts and change status to Pending Verification)
-- Admins can update any payment status (to set status to 'Paid' or 'Unpaid')
CREATE POLICY "Users can update their own payments or admins can update any"
ON public.payments FOR UPDATE
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Only Admins can create or delete payment records (auto-generated when bills are created)
CREATE POLICY "Only admins can create or delete payments"
ON public.payments FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);


-- ====================================================================
-- STORAGE BUCKETS & POLICIES (Supabase Storage)
-- ====================================================================

-- Note: Ensure you create 'bills' and 'receipts' buckets in the Supabase Storage UI.
-- Make them PUBLIC buckets for easy image display, or PRIVATE with signed URLs.
-- Below are the SQL configurations to configure RLS on buckets:

-- Policy for 'bills' Storage Bucket:
-- 1. Allow everyone to view/download bills
-- 2. Only admins can upload/delete documents in 'bills'

-- Policy for 'receipts' Storage Bucket:
-- 1. Allow any logged-in user to upload receipts
-- 2. Allow admins and receipt owners to read them


-- ====================================================================
-- AUTOMATION TRIGGER: SYNC SUPABASE AUTH WITH CUSTOM PROFILES
-- ====================================================================

-- Automatically inserts a record into public.profiles when a user signs up.
-- Default name is extracted from user_metadata or set to the email username.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
