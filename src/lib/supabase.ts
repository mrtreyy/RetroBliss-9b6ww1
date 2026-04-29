import { createClient } from '@supabase/supabase-js';

// Public Mapbox token: pk.eyJ1IjoicGVhY2U1NDMiLCJhIjoiY21vaHMwYzI2MDc3NjJycXZhdzFsb2ZyeiJ9.9nX4dOizNfUbny-D06iOBQ
// No secret keys stored here

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

// ── Generic helpers ───────────────────────────────────────────────────────────
export async function sbGet<T>(table: string, match?: Record<string, unknown>): Promise<T[]> {
  let q = supabase.from(table).select('*');
  if (match) Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v) as typeof q; });
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) { console.error(`[sb] ${table} get error`, error); return []; }
  return (data as T[]) || [];
}

export async function sbGetOne<T>(table: string, match: Record<string, unknown>): Promise<T | null> {
  let q = supabase.from(table).select('*');
  Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v) as typeof q; });
  const { data, error } = await q.single();
  if (error) return null;
  return data as T;
}

export async function sbUpsert(table: string, row: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
  if (error) { console.error(`[sb] ${table} upsert error`, error); return false; }
  return true;
}

export async function sbInsert(table: string, row: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from(table).insert(row);
  if (error) { console.error(`[sb] ${table} insert error`, error); return false; }
  return true;
}

export async function sbUpdate(table: string, match: Record<string, unknown>, updates: Record<string, unknown>): Promise<boolean> {
  let q = supabase.from(table).update(updates);
  Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v) as typeof q; });
  const { error } = await q;
  if (error) { console.error(`[sb] ${table} update error`, error); return false; }
  return true;
}

export async function sbDelete(table: string, match: Record<string, unknown>): Promise<boolean> {
  let q = supabase.from(table).delete();
  Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v) as typeof q; });
  const { error } = await q;
  if (error) { console.error(`[sb] ${table} delete error`, error); return false; }
  return true;
}

export async function sbRPC(fn: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) console.error(`[sb] rpc ${fn} error`, error);
  return data;
}

// ── Settings helpers ──────────────────────────────────────────────────────────
export async function getPlatformSetting(key: string): Promise<unknown> {
  const { data } = await supabase.from('rb_platform_settings').select('value').eq('key', key).single();
  return data?.value ?? null;
}

export async function setPlatformSetting(key: string, value: unknown): Promise<void> {
  await supabase.from('rb_platform_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

// ── CEO Wallet ────────────────────────────────────────────────────────────────
export async function getCEOWallet() {
  const { data } = await supabase.from('rb_ceo_wallet').select('*').eq('id', 1).single();
  return data || { id: 1, balance: 0, total_earned: 0, total_withdrawn: 0 };
}

export async function setCEOWalletField(field: string, value: number) {
  await supabase.from('rb_ceo_wallet').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', 1);
}

export async function updateCEOWallet(updates: { balance?: number; total_earned?: number; total_withdrawn?: number }) {
  await supabase.from('rb_ceo_wallet').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', 1);
}

// ── Audit logger ──────────────────────────────────────────────────────────────
export async function logAuditDB(
  performer: string,
  performerRole: 'rider' | 'driver' | 'admin',
  action: string,
  targetId: string,
  details: Record<string, unknown>,
  ip = 'Unknown',
  location = 'Nigeria'
) {
  await supabase.from('rb_audit_logs').insert({
    id: generateId(),
    performer, performer_role: performerRole, action, target_id: targetId,
    details, ip, location,
    device: navigator.userAgent.substring(0, 120),
    created_at: new Date().toISOString(),
  });
}

// ── Notification ──────────────────────────────────────────────────────────────
export async function sendNotification(userId: string, userRole: string, title: string, message: string, linkedRideId?: string) {
  await supabase.from('rb_notifications').insert({
    id: generateId(),
    user_id: userId, user_role: userRole,
    title, message, read: false,
    linked_ride_id: linkedRideId || null,
    created_at: new Date().toISOString(),
  });
}

// ── ID helpers ────────────────────────────────────────────────────────────────
export const generateId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

export async function getClientIP(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip || 'Unknown';
  } catch { return 'Unknown'; }
}
