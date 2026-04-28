// Legacy storage.ts - now superseded by src/lib/supabase.ts for all backend operations
// Kept for backward compatibility with any remaining imports

import type {
  Rider,
  Driver,
  Ride,
  Transaction,
  AuditLog,
  Notification,
  WithdrawalRequest,
  PlatformSettings,
  CEOWallet,
} from '@/types';

// ── Keys ──────────────────────────────────────────────────────────────────────
const KEYS = {
  RIDERS: 'rb_riders',
  DRIVERS: 'rb_drivers',
  RIDES: 'rb_rides',
  TRANSACTIONS: 'rb_transactions',
  AUDIT_LOG: 'rb_audit_log',
  NOTIFICATIONS: 'rb_notifications',
  WITHDRAWALS: 'rb_withdrawals',
  PLATFORM_SETTINGS: 'rb_platform_settings',
  CEO_WALLET: 'rb_ceo_wallet',
  CURRENT_RIDER: 'rb_current_rider',
  CURRENT_DRIVER: 'rb_current_driver',
  ADMIN_SESSION: 'rb_admin_session',
  USERNAMES: 'rb_usernames',
};

// ── Generic helpers ───────────────────────────────────────────────────────────
function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function set<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Riders ───────────────────────────────────────────────────────────────────
export const getRiders = (): Rider[] => get<Rider[]>(KEYS.RIDERS, []);
export const saveRiders = (r: Rider[]) => set(KEYS.RIDERS, r);
export const getRiderById = (id: string) => getRiders().find(r => r.id === id);
export const upsertRider = (rider: Rider) => {
  const all = getRiders();
  const idx = all.findIndex(r => r.id === rider.id);
  if (idx >= 0) all[idx] = rider; else all.push(rider);
  saveRiders(all);
};

// ── Drivers ──────────────────────────────────────────────────────────────────
export const getDrivers = (): Driver[] => get<Driver[]>(KEYS.DRIVERS, []);
export const saveDrivers = (d: Driver[]) => set(KEYS.DRIVERS, d);
export const getDriverById = (id: string) => getDrivers().find(d => d.id === id);
export const upsertDriver = (driver: Driver) => {
  const all = getDrivers();
  const idx = all.findIndex(d => d.id === driver.id);
  if (idx >= 0) all[idx] = driver; else all.push(driver);
  saveDrivers(all);
};

// ── Sessions ─────────────────────────────────────────────────────────────────
export const getCurrentRider = (): Rider | null => get<Rider | null>(KEYS.CURRENT_RIDER, null);
export const setCurrentRider = (r: Rider | null) => set(KEYS.CURRENT_RIDER, r);
export const getCurrentDriver = (): Driver | null => get<Driver | null>(KEYS.CURRENT_DRIVER, null);
export const setCurrentDriver = (d: Driver | null) => set(KEYS.CURRENT_DRIVER, d);
export const getAdminSession = (): boolean => get<boolean>(KEYS.ADMIN_SESSION, false);
export const setAdminSession = (v: boolean) => set(KEYS.ADMIN_SESSION, v);

// ── Usernames ─────────────────────────────────────────────────────────────────
export const getUsedUsernames = (): string[] => get<string[]>(KEYS.USERNAMES, []);
export const isUsernameTaken = (username: string): boolean =>
  getUsedUsernames().map(u => u.toLowerCase()).includes(username.toLowerCase());
export const reserveUsername = (username: string) => {
  const all = getUsedUsernames();
  if (!all.map(u => u.toLowerCase()).includes(username.toLowerCase())) {
    all.push(username.toLowerCase());
    set(KEYS.USERNAMES, all);
  }
};

// ── Rides ─────────────────────────────────────────────────────────────────────
export const getRides = (): Ride[] => get<Ride[]>(KEYS.RIDES, []);
export const saveRides = (r: Ride[]) => set(KEYS.RIDES, r);
export const upsertRide = (ride: Ride) => {
  const all = getRides();
  const idx = all.findIndex(r => r.id === ride.id);
  if (idx >= 0) all[idx] = ride; else all.push(ride);
  saveRides(all);
};

// ── Transactions ──────────────────────────────────────────────────────────────
export const getTransactions = (): Transaction[] => get<Transaction[]>(KEYS.TRANSACTIONS, []);
export const saveTransactions = (t: Transaction[]) => set(KEYS.TRANSACTIONS, t);
export const addTransaction = (tx: Transaction) => {
  const all = getTransactions();
  all.unshift(tx);
  saveTransactions(all);
};
export const getTransactionsByUser = (userId: string) =>
  getTransactions().filter(t => t.userId === userId);

// ── Audit Log ─────────────────────────────────────────────────────────────────
export const getAuditLogs = (): AuditLog[] => get<AuditLog[]>(KEYS.AUDIT_LOG, []);
export const saveAuditLogs = (l: AuditLog[]) => set(KEYS.AUDIT_LOG, l);
export const addAuditLog = (log: AuditLog) => {
  const all = getAuditLogs();
  all.unshift(log);
  saveAuditLogs(all);
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const getNotifications = (): Notification[] => get<Notification[]>(KEYS.NOTIFICATIONS, []);
export const saveNotifications = (n: Notification[]) => set(KEYS.NOTIFICATIONS, n);
export const addNotification = (n: Notification) => {
  const all = getNotifications();
  all.unshift(n);
  saveNotifications(all);
};
export const getNotificationsByUser = (userId: string) =>
  getNotifications().filter(n => n.userId === userId);

// ── Withdrawals ───────────────────────────────────────────────────────────────
export const getWithdrawals = (): WithdrawalRequest[] => get<WithdrawalRequest[]>(KEYS.WITHDRAWALS, []);
export const saveWithdrawals = (w: WithdrawalRequest[]) => set(KEYS.WITHDRAWALS, w);
export const addWithdrawal = (w: WithdrawalRequest) => {
  const all = getWithdrawals();
  all.unshift(w);
  saveWithdrawals(all);
};

// ── Platform Settings ─────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: PlatformSettings = {
  baseFare: 500,
  perKmRate: 80,
  surgeEnabled: false,
  scheduledRidesEnabled: true,
  driverRetentionPercentage: 50,
  availableStates: ['Lagos', 'Abuja', 'Rivers', 'Kano', 'Oyo'],
  stateRates: { Lagos: 1.0, Abuja: 1.1, Rivers: 1.05, Kano: 0.9, Oyo: 0.95 },
};
export const getPlatformSettings = (): PlatformSettings =>
  get<PlatformSettings>(KEYS.PLATFORM_SETTINGS, DEFAULT_SETTINGS);
export const savePlatformSettings = (s: PlatformSettings) => set(KEYS.PLATFORM_SETTINGS, s);

// ── CEO Wallet ────────────────────────────────────────────────────────────────
export const getCEOWallet = (): CEOWallet =>
  get<CEOWallet>(KEYS.CEO_WALLET, { balance: 0, totalEarned: 0, totalWithdrawn: 0 });
export const saveCEOWallet = (w: CEOWallet) => set(KEYS.CEO_WALLET, w);

// ── Utilities ─────────────────────────────────────────────────────────────────
export const generateId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

export async function getClientIP(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

export function getDeviceInfo(): string {
  return navigator.userAgent.substring(0, 100);
}

export function logAudit(
  performer: string,
  performerRole: 'rider' | 'driver' | 'admin',
  action: string,
  targetId: string,
  details: Record<string, unknown>,
  ip = 'Unknown',
  location = 'Nigeria'
) {
  addAuditLog({
    id: generateId(),
    performer,
    performerRole,
    action,
    targetId,
    details,
    ip,
    location,
    device: getDeviceInfo(),
    createdAt: new Date().toISOString(),
  });
}
