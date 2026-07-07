-- ============================================================
-- RetroBliss v2.0 — Complete Database Schema
-- Run this entire file in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- ============================================================

-- ── Riders ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_riders (
  id                TEXT PRIMARY KEY,
  full_name         TEXT NOT NULL,
  username          TEXT NOT NULL UNIQUE,
  email             TEXT NOT NULL UNIQUE,
  phone             TEXT,
  dob               TEXT,
  location          TEXT,
  state             TEXT,
  country           TEXT DEFAULT 'Nigeria',
  profile_pic       TEXT,          -- base64 or URL
  wallet_balance    NUMERIC DEFAULT 0,
  status            TEXT DEFAULT 'active',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_riders DISABLE ROW LEVEL SECURITY;

-- ── Drivers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_drivers (
  id                TEXT PRIMARY KEY,
  full_name         TEXT NOT NULL,
  username          TEXT NOT NULL UNIQUE,
  email             TEXT NOT NULL UNIQUE,
  phone             TEXT,
  dob               TEXT,
  location          TEXT,
  state             TEXT,
  country           TEXT DEFAULT 'Nigeria',
  profile_pic       TEXT,
  wallet_balance    NUMERIC DEFAULT 0,
  status            TEXT DEFAULT 'pending',   -- pending | active | suspended
  is_online         BOOLEAN DEFAULT FALSE,
  latitude          NUMERIC DEFAULT 6.5244,
  longitude         NUMERIC DEFAULT 3.3792,
  vehicle_make      TEXT,
  vehicle_model     TEXT,
  vehicle_year      TEXT,
  vehicle_plate     TEXT,
  vehicle_color     TEXT,
  id_upload         TEXT,          -- base64 or URL
  bank_name         TEXT,
  bank_account      TEXT,
  bank_account_name TEXT,
  decline_reason    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_drivers DISABLE ROW LEVEL SECURITY;

-- ── Username registry (unique across all roles) ──────────────
CREATE TABLE IF NOT EXISTS rb_usernames (
  username   TEXT PRIMARY KEY,
  role       TEXT NOT NULL,       -- rider | driver | admin
  user_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_usernames DISABLE ROW LEVEL SECURITY;

-- ── Rides ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_rides (
  id                TEXT PRIMARY KEY,
  rider_id          TEXT NOT NULL,
  rider_name        TEXT,
  driver_id         TEXT,
  driver_name       TEXT,
  pickup            TEXT,
  destination       TEXT,
  pickup_lat        NUMERIC,
  pickup_lng        NUMERIC,
  dest_lat          NUMERIC,
  dest_lng          NUMERIC,
  fare              NUMERIC DEFAULT 0,
  status            TEXT DEFAULT 'searching', -- searching | active | completed | cancelled
  ride_type         TEXT DEFAULT 'ride',       -- ride | schedule | share
  rider_paid        NUMERIC DEFAULT 0,
  driver_received   NUMERIC DEFAULT 0,
  commission_amount NUMERIC DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);
ALTER TABLE rb_rides DISABLE ROW LEVEL SECURITY;

-- ── Scheduled Rides ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_scheduled_rides (
  id           TEXT PRIMARY KEY,
  rider_id     TEXT NOT NULL,
  rider_name   TEXT,
  pickup       TEXT,
  destination  TEXT,
  fare         NUMERIC DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  status       TEXT DEFAULT 'pending',  -- pending | confirmed | cancelled
  ride_type    TEXT DEFAULT 'schedule',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_scheduled_rides DISABLE ROW LEVEL SECURITY;

-- ── Transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_transactions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  user_role   TEXT,               -- rider | driver
  type        TEXT,               -- topup | ride_debit | ride_credit | withdrawal
  amount      NUMERIC DEFAULT 0,
  description TEXT,
  reference   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_transactions DISABLE ROW LEVEL SECURITY;

-- ── Notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_notifications (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  user_role           TEXT,
  title               TEXT,
  message             TEXT,
  read                BOOLEAN DEFAULT FALSE,
  linked_ride_id      TEXT,
  linked_transaction_id TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_notifications DISABLE ROW LEVEL SECURITY;

-- ── Ratings ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_ratings (
  id        TEXT PRIMARY KEY,
  ride_id   TEXT NOT NULL,
  rider_id  TEXT,
  driver_id TEXT,
  rating    NUMERIC,
  comment   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_ratings DISABLE ROW LEVEL SECURITY;

-- ── Withdrawals ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_withdrawals (
  id                TEXT PRIMARY KEY,
  driver_id         TEXT NOT NULL,
  driver_name       TEXT,
  amount            NUMERIC DEFAULT 0,
  bank_name         TEXT,
  bank_account      TEXT,
  bank_account_name TEXT,
  status            TEXT DEFAULT 'pending',  -- pending | approved | rejected
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_withdrawals DISABLE ROW LEVEL SECURITY;

-- ── CEO Wallet ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_ceo_wallet (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  balance          NUMERIC DEFAULT 0,
  total_earned     NUMERIC DEFAULT 0,
  total_withdrawn  NUMERIC DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_ceo_wallet DISABLE ROW LEVEL SECURITY;
-- Seed the single CEO wallet row
INSERT INTO rb_ceo_wallet (id, balance, total_earned, total_withdrawn)
VALUES (1, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- ── Platform Settings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_platform_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_platform_settings DISABLE ROW LEVEL SECURITY;
-- Seed default settings
INSERT INTO rb_platform_settings (key, value) VALUES
  ('available_states',     '["Lagos","Abuja","Rivers","Kano","Oyo"]'::jsonb),
  ('commission_rate',      '0.10'::jsonb),
  ('admin_fee_rate',       '0.05'::jsonb),
  ('min_deposit',          '500'::jsonb),
  ('maintenance_mode',     'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── Chat Messages ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_chat_messages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  sender_role TEXT,               -- rider | driver | admin
  message     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_chat_messages DISABLE ROW LEVEL SECURITY;

-- ── Contact Settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_contact_settings (
  id        TEXT PRIMARY KEY,
  label     TEXT,
  value     TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_contact_settings DISABLE ROW LEVEL SECURITY;

-- ── Broadcasts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_broadcasts (
  id          TEXT PRIMARY KEY,
  title       TEXT,
  message     TEXT,
  target_role TEXT DEFAULT 'all',  -- all | rider | driver
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_broadcasts DISABLE ROW LEVEL SECURITY;

-- ── Audit Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rb_audit_logs (
  id             TEXT PRIMARY KEY,
  performer      TEXT,
  performer_role TEXT,
  action         TEXT,
  target_id      TEXT,
  details        JSONB,
  ip             TEXT,
  location       TEXT,
  device         TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rb_audit_logs DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- RPC: cancel_ride_with_refund
-- Cancels a ride and refunds the rider if fare was deducted
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_ride_with_refund(p_ride_id TEXT, p_cancelled_by TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_ride rb_rides%ROWTYPE;
BEGIN
  SELECT * INTO v_ride FROM rb_rides WHERE id = p_ride_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_ride.status IN ('completed', 'cancelled') THEN RETURN; END IF;

  -- Mark ride cancelled
  UPDATE rb_rides SET status = 'cancelled' WHERE id = p_ride_id;

  -- Refund rider if they were charged
  IF v_ride.rider_paid > 0 THEN
    UPDATE rb_riders
      SET wallet_balance = wallet_balance + v_ride.rider_paid
      WHERE id = v_ride.rider_id;

    INSERT INTO rb_transactions (id, user_id, user_role, type, amount, description, created_at)
    VALUES (
      gen_random_uuid()::text,
      v_ride.rider_id, 'rider', 'refund',
      v_ride.rider_paid,
      'Refund for cancelled ride to ' || COALESCE(v_ride.destination, '?'),
      NOW()
    );
  END IF;
END;
$$;

-- ============================================================
-- RPC: ceo_wallet_withdrawal
-- Records a CEO withdrawal and deducts from balance
-- ============================================================
CREATE OR REPLACE FUNCTION ceo_wallet_withdrawal(p_amount NUMERIC, p_note TEXT DEFAULT '')
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE rb_ceo_wallet
  SET
    balance         = GREATEST(0, balance - p_amount),
    total_withdrawn = total_withdrawn + p_amount,
    updated_at      = NOW()
  WHERE id = 1;

  INSERT INTO rb_audit_logs (id, performer, performer_role, action, target_id, details, ip, location, device, created_at)
  VALUES (
    gen_random_uuid()::text,
    'CEO Admin', 'admin', 'ceo_withdrawal', 'ceo_wallet',
    jsonb_build_object('amount', p_amount, 'note', p_note),
    'system', 'Nigeria', 'server', NOW()
  );
END;
$$;

-- ============================================================
-- Done! All tables created and RLS disabled.
-- Run this once in Supabase SQL Editor.
-- ============================================================
