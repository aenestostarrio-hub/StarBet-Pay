-- ==========================================
-- STARBETPAY - SUPABASE DATABASE INITIALIZATION SCHEMA
-- Paste this script directly into your Supabase SQL Editor
-- (https://supabase.com -> Project -> SQL Editor)
-- ==========================================

-- 1. Create CONFIGURATION Table
CREATE TABLE IF NOT EXISTS public.sb_config (
    id INT PRIMARY KEY DEFAULT 1,
    popup_enabled BOOLEAN DEFAULT TRUE,
    popup_title TEXT,
    popup_message TEXT,
    support_whatsapp TEXT,
    withdrawal_phys_ville TEXT,
    withdrawal_phys_rue TEXT,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Seed Initial Config (Match current system defaults)
INSERT INTO public.sb_config (id, popup_enabled, popup_title, popup_message, support_whatsapp, withdrawal_phys_ville, withdrawal_phys_rue)
VALUES (
    1,
    TRUE,
    'Chers clients',
    'Bienvenue sur StarBet Pay, la solution de dépôt & retrait rapide.',
    '+22900000000',
    'Abomey Calavi',
    'Chez star prono'
) ON CONFLICT (id) DO NOTHING;


-- 2. Create PAYMENT METHODS Table
CREATE TABLE IF NOT EXISTS public.sb_payment_methods (
    name TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE
);

-- Seed Default Payment Methods
INSERT INTO public.sb_payment_methods (name, number, active)
VALUES 
    ('AMANA', '85385627', TRUE),
    ('NITA', '85385627', TRUE)
ON CONFLICT (name) DO NOTHING;


-- 3. Create USERS Table
CREATE TABLE IF NOT EXISTS public.sb_users (
    phone TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user', -- 'user' or 'admin'
    password_hash TEXT NOT NULL,
    parent_phone TEXT,
    referral_code TEXT,
    balance_commission NUMERIC DEFAULT 0,
    balance_commission_withdrawn NUMERIC DEFAULT 0,
    mfa_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Seed ADMIN Account and one test user
-- Phone: 0197656263 | Password: Azertyui0p
INSERT INTO public.sb_users (phone, name, role, password_hash, referral_code, balance_commission, balance_commission_withdrawn, mfa_enabled)
VALUES (
    '0197656263',
    'StarBetPay Admin',
    'admin',
    'Azertyui0p',
    'ADMINREF',
    0,
    0,
    TRUE
) ON CONFLICT (phone) DO NOTHING;

-- Phone: 0161616161 | Password: Password123
INSERT INTO public.sb_users (phone, name, role, password_hash, parent_phone, referral_code, balance_commission, balance_commission_withdrawn, mfa_enabled)
VALUES (
    '0161616161',
    'Agbozo',
    'user',
    'Password123',
    '0197656263',
    'AGBOZOREF',
    4500,
    1000,
    TRUE
) ON CONFLICT (phone) DO NOTHING;


-- 4. Create COUPONS Table
CREATE TABLE IF NOT EXISTS public.sb_coupons (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    confidence TEXT,
    total_cote NUMERIC,
    matches JSONB DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    date TEXT
);

-- Seed Preconfigured Coupons
INSERT INTO public.sb_coupons (id, title, confidence, total_cote, matches, status, date)
VALUES 
    ('secured', 'COUPON SÉCURISÉ (COTE ~2)', 'ÉLEVÉ', 2.00, '[{"id": 1, "homeTeam": "France", "awayTeam": "Chili", "prediction": "Prono : Victoire de la France", "odd": 1.45}, {"id": 2, "homeTeam": "Portugal", "awayTeam": "République d''Irlande", "prediction": "Prono : Victoire du Portugal", "odd": 1.38}]'::jsonb, 'pending', '04/06/2026'),
    ('medium', 'COUPON INTERMÉDIAIRE (COTE ~5)', 'MOYEN', 4.91, '[{"id": 1, "homeTeam": "Angleterre", "awayTeam": "Belgique", "prediction": "Prono : Les deux équipes marquent : Oui", "odd": 1.75}, {"id": 2, "homeTeam": "Espagne", "awayTeam": "Colombie", "prediction": "Prono : Victoire de l''Espagne", "odd": 1.65}, {"id": 3, "homeTeam": "Allemagne", "awayTeam": "Pologne", "prediction": "Prono : Victoire de l''Allemagne et Plus de 1.5 buts", "odd": 1.70}]'::jsonb, 'pending', '04/06/2026'),
    ('bold', 'COUPON AUDACIEUX (COTE ~10)', 'RISQUE ÉLEVÉ', 9.94, '[{"id": 1, "homeTeam": "Argentine", "awayTeam": "Équateur", "prediction": "Prono : Victoire de l''Argentine", "odd": 1.50}, {"id": 2, "homeTeam": "Angleterre", "awayTeam": "Belgique", "prediction": "Prono : Match nul", "odd": 3.40}, {"id": 3, "homeTeam": "Espagne", "awayTeam": "Colombie", "prediction": "Prono : Les deux équipes marquent : Oui", "odd": 1.95}]'::jsonb, 'pending', '04/06/2026')
ON CONFLICT (id) DO NOTHING;


-- 5. Create PAST COUPONS Table (History Archives)
CREATE TABLE IF NOT EXISTS public.sb_past_coupons (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    confidence TEXT,
    total_cote NUMERIC,
    matches JSONB DEFAULT '[]',
    status TEXT,
    date TEXT
);


-- 6. Create TRANSACTIONS Table
CREATE TABLE IF NOT EXISTS public.sb_transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'commission_payout'
    amount NUMERIC NOT NULL,
    user_phone TEXT REFERENCES public.sb_users(phone) ON DELETE CASCADE,
    user_name TEXT,
    xbet_account TEXT,
    payment_method TEXT,
    payment_number TEXT,
    screenshot TEXT, -- Base64 encoded screenshot
    withdraw_code TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'validated', 'rejected'
    date TEXT,
    rejection_reason TEXT,
    applied_commission BOOLEAN DEFAULT FALSE
);

-- Seed initial test transactions
INSERT INTO public.sb_transactions (id, type, amount, user_phone, user_name, xbet_account, payment_method, payment_number, status, date, applied_commission)
VALUES (
    'TX_1717462000000',
    'deposit',
    2000,
    '0161616161',
    'Agbozo',
    '31354567',
    'AMANA',
    '85385627',
    'validated',
    '04/06/2026 01:40',
    TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sb_transactions (id, type, amount, user_phone, user_name, xbet_account, payment_method, payment_number, status, date, rejection_reason)
VALUES (
    'TX_1717461010101',
    'deposit',
    500,
    '0161616161',
    'Agbozo',
    '31354567',
    'AMANA',
    '85385627',
    'rejected',
    '02/06/2026 11:33',
    'Capture d''écran non valide ou corrompue.'
) ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS) bypass / public access for simple application integration
-- (Note: Feel free to customize these if you wish to enforce custom auth policies)
ALTER TABLE public.sb_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sb_payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sb_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sb_coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sb_past_coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sb_transactions DISABLE ROW LEVEL SECURITY;
