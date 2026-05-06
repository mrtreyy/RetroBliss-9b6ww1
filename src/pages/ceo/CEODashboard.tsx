import React, { useState, useEffect } from 'react';
import MapboxMap from '@/components/MapboxMap';
import NotificationSystem from '@/components/NotificationSystem';
import ProfileAvatar from '@/components/ProfileAvatar';
import { supabase, generateId, logAuditDB, getClientIP, sendNotification, getPlatformSetting, setPlatformSetting } from '@/lib/supabase';
import { ALL_NIGERIAN_STATES } from '@/lib/nigerianLocations';
import { showLocalNotification } from '@/lib/pushNotifications';
import { toast } from 'sonner';

interface CEODashboardProps {
  onLogout: () => void;
}

// Bottom nav tabs (7 primary + extras via scroll)
type CEOTab = 'dashboard' | 'riders' | 'drivers' | 'rides' | 'approvals' | 'earnings' | 'audit' | 'controls' | 'notifications' | 'withdrawals' | 'broadcasts' | 'chat' | 'contact-settings';

const NIGERIAN_COORDS: Record<string, [number, number]> = {
  'Ikeja': [3.3488, 6.6018], 'Victoria Island': [3.4219, 6.4314],
  'Lekki': [3.5561, 6.4478], 'Surulere': [3.3494, 6.5057],
  'Yaba': [3.3796, 6.5159], 'Maitama': [7.5053, 9.0781],
  'Lagos': [3.3792, 6.5244], 'Abuja': [7.4898, 9.0579],
};

const CEODashboard: React.FC<CEODashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<CEOTab>('dashboard');
  const [selectedItem, setSelectedItem] = useState<Record<string, unknown> | null>(null);
  const [detailView, setDetailView] = useState(false);

  // Data
  const [riders, setRiders] = useState<Record<string, unknown>[]>([]);
  const [drivers, setDrivers] = useState<Record<string, unknown>[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<Record<string, unknown>[]>([]);
  const [rides, setRides] = useState<Record<string, unknown>[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [notifications, setNotifications] = useState<Record<string, unknown>[]>([]);
  const [withdrawals, setWithdrawals] = useState<Record<string, unknown>[]>([]);
  const [chatMessages, setChatMessages] = useState<Record<string, unknown>[]>([]);
  const [contactSettings, setContactSettings] = useState<Record<string, unknown>[]>([]);

  // Wallet & Settings
  const [ceoWallet, setCeoWallet] = useState({ balance: 0, total_earned: 0, total_withdrawn: 0, total_platform_volume: 0 });
  const [retentionPct, setRetentionPct] = useState(50);
  const [baseFare, setBaseFare] = useState(500);
  const [perKmRate, setPerKmRate] = useState(80);
  const [availableNigerianStates, setAvailableNigerianStates] = useState<string[]>(['Lagos', 'Abuja', 'Rivers', 'Kano', 'Oyo']);
  const [surgeEnabled, setSurgeEnabled] = useState(false);
  const [ceoWithdrawAmount, setCeoWithdrawAmount] = useState('');
  const [ceoBank, setCeoBank] = useState('');
  const [ceoAcct, setCeoAcct] = useState('');
  const [ceoAcctName, setCeoAcctName] = useState('');

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [pendingDeclineId, setPendingDeclineId] = useState('');
  const [stats, setStats] = useState({ totalRiders: 0, totalDrivers: 0, activeRides: 0, todayRevenue: 0, pendingWithdrawals: 0 });
  const [activeRideMarkers, setActiveRideMarkers] = useState<{ id: string; lat: number; lng: number; label: string; color: string }[]>([]);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'riders' | 'drivers'>('all');
  const [selectedChatUser, setSelectedChatUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [chatReply, setChatReply] = useState('');
  const [newContactPlatform, setNewContactPlatform] = useState('');
  const [newContactLabel, setNewContactLabel] = useState('');
  const [newContactValue, setNewContactValue] = useState('');
  const [replyMsg, setReplyMsg] = useState('');
  const [notifCount, setNotifCount] = useState(0);
  const [rideStatusFilter, setRideStatusFilter] = useState('all');
  const [newLocationsInput, setNewLocationsInput] = useState('');
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);

  useEffect(() => {
    fetchAll();
    const poll = setInterval(() => { fetchStats(); fetchCEOWallet(); }, 8000);
    const notifCh = supabase.channel('ceo-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rb_notifications', filter: 'user_id=eq.ceo' }, () => fetchNotifications())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rb_rides' }, () => { fetchRides(); fetchStats(); })
      .subscribe();
    return () => { clearInterval(poll); supabase.removeChannel(notifCh); };
  }, []);

  const fetchAll = async () => {
    await Promise.all([
      fetchRiders(), fetchDrivers(), fetchRides(), fetchAuditLogs(),
      fetchNotifications(), fetchWithdrawals(), fetchSettings(), fetchCEOWallet(),
      fetchChatMessages(), fetchContactSettings(),
    ]);
    fetchStats();
  };

  const fetchRiders = async () => {
    const { data } = await supabase.from('rb_riders').select('*').order('created_at', { ascending: false });
    setRiders(data || []);
  };

  const fetchDrivers = async () => {
    const { data } = await supabase.from('rb_drivers').select('*').order('created_at', { ascending: false });
    const all = data || [];
    setDrivers(all.filter((d: Record<string, unknown>) => d.status !== 'pending'));
    setPendingDrivers(all.filter((d: Record<string, unknown>) => d.status === 'pending'));
  };

  const fetchRides = async () => {
    const { data } = await supabase.from('rb_rides').select('*').order('created_at', { ascending: false }).limit(200);
    const list = data || [];
    setRides(list);
    setActiveRideMarkers(list.filter((r: Record<string, unknown>) => r.status === 'active').map((r: Record<string, unknown>) => ({
      id: r.id as string, lat: (r.pickup_lat as number) || 6.5244, lng: (r.pickup_lng as number) || 3.3792,
      label: `${r.rider_name} → ${r.destination}`, color: '#8B5CF6',
    })));
  };

  const fetchAuditLogs = async () => {
    const { data } = await supabase.from('rb_audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
    setAuditLogs(data || []);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase.from('rb_notifications').select('*').order('created_at', { ascending: false }).limit(100);
    const notifs = data || [];
    setNotifications(notifs);
    setNotifCount(notifs.filter((n: Record<string, unknown>) => !n.read).length);
  };

  const fetchWithdrawals = async () => {
    const { data } = await supabase.from('rb_withdrawals').select('*').order('created_at', { ascending: false });
    setWithdrawals(data || []);
  };

  const fetchCEOWallet = async () => {
    const { data } = await supabase.from('rb_ceo_wallet').select('*').eq('id', 1).single();
    if (data) setCeoWallet({ balance: data.balance || 0, total_earned: data.total_earned || 0, total_withdrawn: data.total_withdrawn || 0, total_platform_volume: data.total_platform_volume || 0 });
  };

  const fetchSettings = async () => {
    const rp = await getPlatformSetting('driver_retention_percentage');
    const bf = await getPlatformSetting('base_fare');
    const km = await getPlatformSetting('per_km_rate');
    const states = await getPlatformSetting('available_states');
    const locs = await getPlatformSetting('available_locations');
    const surge = await getPlatformSetting('surge_enabled');
    if (rp !== null) setRetentionPct(Number(rp));
    if (bf !== null) setBaseFare(Number(bf));
    if (km !== null) setPerKmRate(Number(km));
    if (Array.isArray(states)) setAvailableNigerianStates(states);
    if (Array.isArray(locs)) setAvailableLocations(locs);
    if (typeof surge === 'boolean') setSurgeEnabled(surge);
  };

  const fetchChatMessages = async () => {
    const { data } = await supabase.from('rb_chat_messages').select('*').order('created_at', { ascending: false }).limit(300);
    setChatMessages(data || []);
  };

  const fetchContactSettings = async () => {
    const { data } = await supabase.from('rb_contact_settings').select('*').order('created_at');
    setContactSettings(data || []);
  };

  const fetchStats = async () => {
    const [rcRes, dcRes, arcRes] = await Promise.all([
      supabase.from('rb_riders').select('id', { count: 'exact', head: true }),
      supabase.from('rb_drivers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('rb_rides').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);
    const today = new Date().toISOString().split('T')[0];
    const { data: todayRides } = await supabase.from('rb_rides').select('commission_amount').eq('status', 'completed').gte('created_at', today);
    const todayRev = todayRides?.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.commission_amount) || 0), 0) || 0;
    const { count: wc } = await supabase.from('rb_withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    setStats({ totalRiders: rcRes.count || 0, totalDrivers: dcRes.count || 0, activeRides: arcRes.count || 0, todayRevenue: todayRev, pendingWithdrawals: wc || 0 });
  };

  const getPassword = (userId: string) => localStorage.getItem(`rb_pwd_${userId}`) || '(not set)';

  // ── ACTIONS ──
  const handleApproveDriver = async (driverId: string, driverName: string) => {
    await supabase.from('rb_drivers').update({ status: 'active' }).eq('id', driverId);
    await sendNotification(driverId, 'driver', '🎉 Application Approved!', 'Congratulations! Your RetroBliss driver account is now active. Log in to start accepting rides!');
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'driver_approve', driverId, { driver_name: driverName }, ip, 'Nigeria');
    showLocalNotification('✅ Driver Approved', `${driverName} is now active on the platform.`);
    toast.success(`${driverName} approved!`);
    fetchDrivers();
    setDetailView(false); setSelectedItem(null);
  };

  const openDeclineModal = (driverId: string) => {
    setPendingDeclineId(driverId);
    setDeclineReason('');
    setShowDeclineModal(true);
  };

  const handleDeclineDriver = async () => {
    if (!declineReason.trim()) { toast.error('Please provide a decline reason.'); return; }
    const d = [...pendingDrivers, ...drivers].find((x: Record<string, unknown>) => x.id === pendingDeclineId);
    await supabase.from('rb_drivers').update({ status: 'declined', decline_reason: declineReason }).eq('id', pendingDeclineId);
    await sendNotification(pendingDeclineId, 'driver', '❌ Application Declined', `Your driver application was declined. Reason: ${declineReason}`);
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'driver_decline', pendingDeclineId, { reason: declineReason, name: d?.full_name }, ip, 'Nigeria');
    toast.info('Application declined. Driver notified.');
    setShowDeclineModal(false);
    fetchDrivers();
    setDetailView(false); setSelectedItem(null);
  };

  const handleFreezeAccount = async (id: string, name: string, table: 'rb_riders' | 'rb_drivers', frozen: boolean, role: string) => {
    await supabase.from(table).update({ status: frozen ? 'frozen' : 'active' }).eq('id', id);
    await sendNotification(id, role, frozen ? '🔒 Account Frozen' : '🔓 Account Restored', frozen ? 'Your account has been temporarily suspended.' : 'Your account has been fully restored.');
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', frozen ? 'account_freeze' : 'account_unfreeze', id, { name, role }, ip, 'Nigeria');
    toast.success(`${name}'s account ${frozen ? 'frozen' : 'restored'}.`);
    if (role === 'rider') fetchRiders(); else fetchDrivers();
  };

  const handleDeleteAccount = async (id: string, name: string, table: 'rb_riders' | 'rb_drivers', role: string) => {
    if (!window.confirm(`Delete ${name}'s account permanently? This cannot be undone.`)) return;
    await supabase.from(table).delete().eq('id', id);
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'account_delete', id, { name, role }, ip, 'Nigeria');
    toast.success(`${name}'s account deleted.`);
    if (role === 'rider') fetchRiders(); else fetchDrivers();
    setDetailView(false); setSelectedItem(null);
  };

  const handleCancelRide = async (rideId: string) => {
    const ride = rides.find(r => r.id === rideId);
    await supabase.rpc('cancel_ride_with_refund', { p_ride_id: rideId, p_cancelled_by: 'ceo' });
    if (ride?.rider_id) await sendNotification(ride.rider_id as string, 'rider', 'Ride Cancelled', 'Your ride was cancelled by admin. Any charges have been refunded.', rideId);
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'ride_cancel', rideId, { rider: ride?.rider_name, driver: ride?.driver_name }, ip, 'Nigeria');
    toast.success('Ride cancelled + refund issued.');
    fetchRides(); fetchCEOWallet();
    setDetailView(false); setSelectedItem(null);
  };

  const handleApproveWithdrawal = async (wId: string) => {
    const w = withdrawals.find(x => x.id === wId);
    if (!w) return;
    const { data: driverData } = await supabase.from('rb_drivers').select('wallet_balance').eq('id', w.driver_id).single();
    if (driverData && driverData.wallet_balance >= Number(w.amount)) {
      await supabase.from('rb_drivers').update({ wallet_balance: driverData.wallet_balance - Number(w.amount) }).eq('id', w.driver_id);
    }
    await supabase.from('rb_withdrawals').update({ status: 'approved' }).eq('id', wId);
    await supabase.from('rb_transactions').insert({
      id: generateId(), user_id: w.driver_id, user_role: 'driver', type: 'debit',
      amount: w.amount, description: `Withdrawal to ${w.bank_name} · ${w.bank_account}`,
      reference: wId, created_at: new Date().toISOString(),
    });
    await sendNotification(w.driver_id as string, 'driver', '💸 Withdrawal Approved!', `₦${Number(w.amount).toLocaleString()} sent to your ${w.bank_name} account!`);
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'withdrawal_approve', wId, { driver: w.driver_name, amount: w.amount }, ip, 'Nigeria');
    toast.success('Withdrawal approved & paid!');
    fetchWithdrawals(); fetchDrivers();
  };

  const handleRejectWithdrawal = async (wId: string) => {
    const w = withdrawals.find(x => x.id === wId);
    await supabase.from('rb_withdrawals').update({ status: 'rejected' }).eq('id', wId);
    if (w) await sendNotification(w.driver_id as string, 'driver', '❌ Withdrawal Rejected', `Your withdrawal of ₦${Number(w.amount).toLocaleString()} was rejected. Contact support.`);
    toast.info('Withdrawal rejected.');
    fetchWithdrawals();
  };

  const handleCEOWithdrawal = async () => {
    const amount = parseFloat(ceoWithdrawAmount);
    if (isNaN(amount) || amount < 1000) { toast.error('Minimum CEO withdrawal is ₦1,000.'); return; }
    if (!ceoBank || !ceoAcct || !ceoAcctName) { toast.error('Fill all bank details.'); return; }
    if (amount > ceoWallet.balance) { toast.error('Insufficient CEO wallet balance.'); return; }
    const { data } = await supabase.rpc('ceo_wallet_withdrawal', { p_amt: amount, p_bank: ceoBank, p_acct: ceoAcct, p_name: ceoAcctName });
    if (data?.success) {
      toast.success(`₦${amount.toLocaleString()} withdrawn from CEO wallet!`);
      const ip = await getClientIP();
      await logAuditDB('CEO Admin', 'admin', 'ceo_withdrawal', 'ceo_wallet', { amount, bank: ceoBank, account: ceoAcct }, ip, 'Nigeria');
      setCeoWithdrawAmount(''); setCeoBank(''); setCeoAcct(''); setCeoAcctName('');
      fetchCEOWallet();
    } else {
      toast.error(data?.error || 'Withdrawal failed.');
    }
  };

  const handleCollectEarnings = async () => {
    const activeDrivers = drivers.filter(d => Number(d.wallet_balance) > 0);
    let total = 0;
    for (const d of activeDrivers) {
      const bal = Number(d.wallet_balance);
      const ceoShare = bal * ((100 - retentionPct) / 100);
      if (ceoShare > 0.5) {
        const newBal = bal - ceoShare;
        await supabase.from('rb_drivers').update({ wallet_balance: newBal }).eq('id', d.id);
        total += ceoShare;
        await supabase.from('rb_transactions').insert({
          id: generateId(), user_id: d.id, user_role: 'driver', type: 'debit',
          amount: ceoShare, description: `Platform commission collected (${100 - retentionPct}%)`,
          reference: `CEO_COLLECT_${Date.now()}`, created_at: new Date().toISOString(),
        });
        await sendNotification(d.id as string, 'driver', '💼 Commission Collected', `RetroBliss collected its ${100 - retentionPct}% share (₦${ceoShare.toFixed(2)}) from your wallet.`);
      }
    }
    if (total > 0) {
      await supabase.from('rb_ceo_wallet').update({ balance: ceoWallet.balance + total, total_earned: ceoWallet.total_earned + total, updated_at: new Date().toISOString() }).eq('id', 1);
      const ip = await getClientIP();
      await logAuditDB('CEO Admin', 'admin', 'earnings_collection', 'all_drivers', { total, retention: retentionPct, drivers: activeDrivers.length }, ip, 'Nigeria');
      toast.success(`₦${total.toFixed(0)} collected from ${activeDrivers.length} drivers!`);
      fetchCEOWallet(); fetchDrivers();
    } else {
      toast.info('No earnings to collect right now.');
    }
  };

  const handleSaveSettings = async () => {
    await Promise.all([
      setPlatformSetting('driver_retention_percentage', retentionPct),
      setPlatformSetting('base_fare', baseFare),
      setPlatformSetting('per_km_rate', perKmRate),
      setPlatformSetting('surge_enabled', surgeEnabled),
      setPlatformSetting('available_states', availableNigerianStates),
      setPlatformSetting('available_locations', availableLocations),
    ]);
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'settings_update', 'platform', { retention: retentionPct, states: availableNigerianStates.length, base_fare: baseFare }, ip, 'Nigeria');
    toast.success('Platform settings saved! Changes live across the app.');
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) { toast.error('Enter a broadcast message.'); return; }
    const bId = generateId();
    await supabase.from('rb_broadcasts').insert({
      id: bId, title: '📢 RetroBliss Announcement', message: broadcastMsg,
      target: broadcastTarget, target_role: broadcastTarget,
      sent_by: 'CEO Admin', created_at: new Date().toISOString(),
    });
    if (broadcastTarget !== 'drivers') {
      const { data: rList } = await supabase.from('rb_riders').select('id').eq('status', 'active');
      for (const r of (rList || [])) await sendNotification(r.id, 'rider', '📢 RetroBliss Announcement', broadcastMsg);
    }
    if (broadcastTarget !== 'riders') {
      const { data: dList } = await supabase.from('rb_drivers').select('id').eq('status', 'active');
      for (const d of (dList || [])) await sendNotification(d.id, 'driver', '📢 RetroBliss Announcement', broadcastMsg);
    }
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'broadcast_sent', bId, { target: broadcastTarget, msg: broadcastMsg.substring(0, 80) }, ip, 'Nigeria');
    showLocalNotification('📢 Broadcast Sent', `Delivered to ${broadcastTarget === 'all' ? 'all users' : broadcastTarget}.`);
    toast.success(`Broadcast delivered to ${broadcastTarget === 'all' ? 'all users' : broadcastTarget}!`);
    setBroadcastMsg('');
  };

  const handleSendChatReply = async () => {
    if (!selectedChatUser || !chatReply.trim()) return;
    await supabase.from('rb_chat_messages').insert({
      id: generateId(), user_id: selectedChatUser.id, user_role: selectedChatUser.role,
      user_name: 'CEO Admin', sender: 'ceo', message: chatReply,
      read: false, created_at: new Date().toISOString(),
    });
    await sendNotification(selectedChatUser.id, selectedChatUser.role, '💬 Reply from RetroBliss', chatReply);
    toast.success('Reply sent!');
    setChatReply('');
    fetchChatMessages();
  };

  const handleAddContact = async () => {
    if (!newContactPlatform || !newContactLabel || !newContactValue) { toast.error('Fill all contact fields.'); return; }
    await supabase.from('rb_contact_settings').insert({
      id: generateId(), platform: newContactPlatform.toLowerCase(),
      label: newContactLabel, value: newContactValue, is_active: true,
      created_at: new Date().toISOString(),
    });
    toast.success('Contact channel added!');
    setNewContactPlatform(''); setNewContactLabel(''); setNewContactValue('');
    fetchContactSettings();
  };

  const handleDeleteContact = async (id: string) => {
    await supabase.from('rb_contact_settings').delete().eq('id', id);
    toast.success('Contact removed.');
    fetchContactSettings();
  };

  const handleMarkNotifRead = async (id: string) => {
    await supabase.from('rb_notifications').update({ read: true }).eq('id', id);
    fetchNotifications();
  };

  const handleReplyNotification = async (nId: string, userId: string, userRole: string) => {
    if (!replyMsg.trim()) return;
    await sendNotification(userId, userRole, '💬 Message from RetroBliss Admin', replyMsg);
    await supabase.from('rb_notifications').update({ read: true }).eq('id', nId);
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'notification_reply', nId, { to: userId, msg: replyMsg }, ip, 'Nigeria');
    toast.success('Reply sent!');
    setReplyMsg('');
    fetchNotifications();
  };

  // ─────────────────────────────────────────────────────────────
  // BOTTOM TABS CONFIG (7 primary shown at once on bottom)
  const bottomTabs: { key: CEOTab; icon: string; label: string }[] = [
    { key: 'dashboard', icon: '📊', label: 'Dashboard' },
    { key: 'riders', icon: '🛵', label: 'Riders' },
    { key: 'drivers', icon: '🚗', label: 'Drivers' },
    { key: 'rides', icon: '🗺️', label: 'All Rides' },
    { key: 'approvals', icon: '⏳', label: 'Approvals' },
    { key: 'earnings', icon: '💼', label: 'Earnings' },
    { key: 'audit', icon: '📋', label: 'Audit Log' },
  ];

  const moreTabs: { key: CEOTab; icon: string; label: string }[] = [
    { key: 'withdrawals', icon: '💸', label: `Payouts${stats.pendingWithdrawals > 0 ? ` (${stats.pendingWithdrawals})` : ''}` },
    { key: 'controls', icon: '⚙️', label: 'Controls' },
    { key: 'notifications', icon: '🔔', label: `Notifs${notifCount > 0 ? ` (${notifCount})` : ''}` },
    { key: 'broadcasts', icon: '📢', label: 'Broadcast' },
    { key: 'chat', icon: '💬', label: 'Chat' },
    { key: 'contact-settings', icon: '📞', label: 'Contacts' },
  ];

  // ── DETAIL VIEW ──
  const renderDetail = () => {
    if (!selectedItem) return null;
    const d = selectedItem;

    if (activeTab === 'riders' || activeTab === 'drivers') {
      const isDriver = activeTab === 'drivers';
      const table = isDriver ? 'rb_drivers' as const : 'rb_riders' as const;
      const pwd = getPassword(d.id as string);

      return (
        <div style={{ padding: '20px 20px 120px', maxWidth: '480px', margin: '0 auto', overflowY: 'auto' }}>
          <button onClick={() => { setDetailView(false); setSelectedItem(null); }} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif", marginBottom: '20px' }}>← Back</button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <ProfileAvatar name={d.full_name as string} profilePic={d.profile_pic as string | null} size={84} />
            <h3 style={{ color: 'white', fontSize: '22px', fontWeight: 800, margin: '12px 0 4px' }}>{d.full_name as string}</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 8px' }}>@{d.username as string}</p>
            <div style={{ background: d.status === 'active' ? 'rgba(34,197,94,0.15)' : d.status === 'frozen' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', border: `1px solid ${d.status === 'active' ? 'rgba(34,197,94,0.4)' : d.status === 'frozen' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`, borderRadius: '20px', padding: '4px 16px' }}>
              <span style={{ color: d.status === 'active' ? '#4ADE80' : d.status === 'frozen' ? '#FCA5A5' : '#FCD34D', fontSize: '12px', fontWeight: 700, textTransform: 'capitalize' }}>{d.status as string}</span>
            </div>
          </div>

          {/* Profile info */}
          <div className="glass-card" style={{ padding: '18px', marginBottom: '14px', borderRadius: '20px' }}>
            {[
              { label: '📧 Email', value: d.email as string },
              { label: '📱 Phone', value: d.phone as string },
              { label: '📍 Location', value: `${d.location}, ${d.state}` as string },
              { label: '💰 Wallet', value: `₦${Number(d.wallet_balance).toLocaleString()}` },
              { label: '📅 Joined', value: new Date(d.created_at as string).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) },
              ...(isDriver ? [
                { label: '🚗 Vehicle', value: `${d.vehicle_year} ${d.vehicle_make} ${d.vehicle_model}` as string },
                { label: '🪪 Plate', value: d.vehicle_plate as string },
                { label: '🎨 Color', value: d.vehicle_color as string },
                { label: '🏦 Bank', value: `${d.bank_name} · ${d.bank_account}` as string },
                { label: '👤 Acct Name', value: d.bank_account_name as string },
              ] : []),
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', flexShrink: 0 }}>{item.label}</span>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: 500, maxWidth: '58%', textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* CEO-ONLY: Login credentials */}
          <div className="glass-card" style={{ padding: '16px', marginBottom: '14px', borderRadius: '20px', border: '1px solid rgba(245,158,11,0.2)' }}>
            <p style={{ color: '#FCD34D', fontSize: '11px', fontWeight: 700, margin: '0 0 10px', letterSpacing: '0.1em' }}>🔐 LOGIN CREDENTIALS (CEO ONLY)</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Email</span>
              <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>{d.email as string}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Password</span>
              <span style={{ color: '#FCD34D', fontSize: '13px', fontWeight: 700 }}>{pwd}</span>
            </div>
          </div>

          {/* ID Upload for drivers */}
          {isDriver && d.id_upload && (
            <div className="glass-card" style={{ padding: '16px', marginBottom: '14px', borderRadius: '20px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600, margin: '0 0 10px', letterSpacing: '0.08em' }}>GOVERNMENT ID DOCUMENT</p>
              {(d.id_upload as string).startsWith('data:image') ? (
                <img src={d.id_upload as string} alt="ID" style={{ width: '100%', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' }} />
              ) : (
                <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                  <p style={{ color: '#4ADE80', fontSize: '13px', margin: 0 }}>📄 ID Document Uploaded</p>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <button onClick={() => handleFreezeAccount(d.id as string, d.full_name as string, table, d.status !== 'frozen', isDriver ? 'driver' : 'rider')} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: d.status !== 'frozen' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', border: `1px solid ${d.status !== 'frozen' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, color: d.status !== 'frozen' ? '#FCA5A5' : '#4ADE80', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
              {d.status !== 'frozen' ? '🔒 Freeze' : '🔓 Unfreeze'}
            </button>
            <button onClick={() => handleDeleteAccount(d.id as string, d.full_name as string, table, isDriver ? 'driver' : 'rider')} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
              🗑️ Delete
            </button>
          </div>
        </div>
      );
    }

    if (activeTab === 'approvals') {
      const d = selectedItem;
      return (
        <div style={{ padding: '20px 20px 120px', maxWidth: '480px', margin: '0 auto', overflowY: 'auto' }}>
          <button onClick={() => { setDetailView(false); setSelectedItem(null); }} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif", marginBottom: '20px' }}>← Back</button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <ProfileAvatar name={d.full_name as string} profilePic={d.profile_pic as string | null} size={80} />
            <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 800, margin: '12px 0 4px' }}>{d.full_name as string}</h3>
            <p style={{ color: '#FCD34D', fontSize: '12px', fontWeight: 700, margin: 0 }}>PENDING APPROVAL</p>
          </div>
          <div className="glass-card" style={{ padding: '18px', marginBottom: '14px', borderRadius: '20px' }}>
            {[
              { label: 'Email', value: d.email as string },
              { label: 'Phone', value: d.phone as string },
              { label: 'Location', value: `${d.location}, ${d.state}` as string },
              { label: 'Vehicle', value: `${d.vehicle_year} ${d.vehicle_make} ${d.vehicle_model}` as string },
              { label: 'Plate', value: d.vehicle_plate as string },
              { label: 'Color', value: d.vehicle_color as string },
              { label: 'Bank', value: `${d.bank_name} · ${d.bank_account}` as string },
              { label: 'Account Name', value: d.bank_account_name as string },
              { label: 'Applied', value: new Date(d.created_at as string).toLocaleString('en-NG') },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</span>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: 500, maxWidth: '58%', textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Also show credentials */}
          <div className="glass-card" style={{ padding: '16px', marginBottom: '14px', borderRadius: '20px', border: '1px solid rgba(245,158,11,0.2)' }}>
            <p style={{ color: '#FCD34D', fontSize: '11px', fontWeight: 700, margin: '0 0 8px', letterSpacing: '0.1em' }}>🔐 LOGIN CREDENTIALS</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Email</span>
              <span style={{ color: 'white', fontSize: '13px' }}>{d.email as string}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Password</span>
              <span style={{ color: '#FCD34D', fontSize: '13px', fontWeight: 700 }}>{getPassword(d.id as string)}</span>
            </div>
          </div>

          {d.id_upload && (
            <div className="glass-card" style={{ padding: '16px', marginBottom: '14px', borderRadius: '20px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600, margin: '0 0 10px', letterSpacing: '0.08em' }}>GOVERNMENT ID</p>
              {(d.id_upload as string).startsWith('data:image') ? (
                <img src={d.id_upload as string} alt="ID" style={{ width: '100%', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' }} />
              ) : (
                <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                  <p style={{ color: '#4ADE80', fontSize: '13px', margin: 0 }}>📄 ID Document Uploaded</p>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => openDeclineModal(d.id as string)} style={{ flex: 1, padding: '15px', borderRadius: '16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>✕ Decline</button>
            <button onClick={() => handleApproveDriver(d.id as string, d.full_name as string)} style={{ flex: 2, padding: '15px', borderRadius: '16px', background: 'linear-gradient(135deg, #22C55E, #16A34A)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>✓ Approve Application</button>
          </div>
        </div>
      );
    }

    if (activeTab === 'rides') {
      const r = selectedItem;
      const statusColors: Record<string, string> = { active: '#4ADE80', searching: '#F59E0B', completed: '#8B5CF6', cancelled: '#EF4444' };
      return (
        <div style={{ padding: '20px 20px 120px', maxWidth: '480px', margin: '0 auto', overflowY: 'auto' }}>
          <button onClick={() => { setDetailView(false); setSelectedItem(null); }} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif", marginBottom: '20px' }}>← Back</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: statusColors[r.status as string] || '#888' }} />
            <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 800, margin: 0 }}>{(r.status as string).toUpperCase()}</h3>
          </div>
          <div className="glass-card" style={{ padding: '18px', marginBottom: '14px', borderRadius: '20px' }}>
            {[
              { label: 'Rider', value: r.rider_name as string },
              { label: 'Driver', value: (r.driver_name as string) || 'None assigned' },
              { label: 'Pickup', value: r.pickup as string },
              { label: 'Destination', value: r.destination as string },
              { label: 'Total Fare', value: `₦${Number(r.fare).toLocaleString()}` },
              { label: 'Rider Paid', value: `₦${Number(r.rider_paid).toLocaleString()}` },
              { label: 'Driver Earned', value: `₦${Number(r.driver_received).toLocaleString()}` },
              { label: 'Commission', value: `₦${Number(r.commission_amount).toLocaleString()}` },
              { label: 'Type', value: r.ride_type as string },
              { label: 'Booked', value: new Date(r.created_at as string).toLocaleString('en-NG') },
              ...(r.completed_at ? [{ label: 'Completed', value: new Date(r.completed_at as string).toLocaleString('en-NG') }] : []),
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</span>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>{item.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <MapboxMap height={200} center={[r.pickup_lng as number || 3.3792, r.pickup_lat as number || 6.5244]} zoom={12}
              activeRideRoute={{ pickup: [r.pickup_lng as number || 3.3792, r.pickup_lat as number || 6.5244], destination: [r.dest_lng as number || 3.4219, r.dest_lat as number || 6.4314] }}
              containerStyle={{ borderRadius: '18px' }} />
          </div>
          {(r.status === 'searching' || r.status === 'active') && (
            <button onClick={() => handleCancelRide(r.id as string)} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>
              ✕ Cancel This Ride (Issue Refund)
            </button>
          )}
        </div>
      );
    }

    if (activeTab === 'audit') {
      const log = selectedItem;
      return (
        <div style={{ padding: '20px 20px 120px', maxWidth: '480px', margin: '0 auto', overflowY: 'auto' }}>
          <button onClick={() => { setDetailView(false); setSelectedItem(null); }} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif", marginBottom: '20px' }}>← Back</button>
          <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: '0 0 20px' }}>Audit Entry Detail</h3>
          <div className="glass-card" style={{ padding: '18px', marginBottom: '14px', borderRadius: '20px' }}>
            {[
              { label: 'Action', value: (log.action as string).replace(/_/g, ' ') },
              { label: 'Performer', value: log.performer as string },
              { label: 'Role', value: log.performer_role as string },
              { label: 'Target', value: ((log.target_id as string) || '').substring(0, 24) + '...' },
              { label: 'IP', value: log.ip as string },
              { label: 'Location', value: log.location as string },
              { label: 'Time', value: new Date(log.created_at as string).toLocaleString('en-NG') },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</span>
                <span style={{ color: 'white', fontSize: '12px', fontWeight: 500, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>{item.value}</span>
              </div>
            ))}
          </div>
          {log.details && (
            <div className="glass" style={{ borderRadius: '16px', padding: '14px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700, margin: '0 0 8px' }}>METADATA</p>
              <pre style={{ color: '#C4B5FD', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, fontFamily: 'monospace', lineHeight: 1.6 }}>
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // ── MAIN TAB CONTENT ──
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* CEO Wallet Card */}
          <div style={{ background: 'linear-gradient(135deg, #6D28D9, #EC4899)', borderRadius: '28px', padding: '28px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '11px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '0.12em' }}>CEO ADMINISTRATIVE WALLET</p>
            <p style={{ color: 'white', fontSize: '38px', fontWeight: 900, margin: '0 0 2px', fontFamily: "'Poppins', sans-serif" }}>₦{ceoWallet.balance.toLocaleString()}</p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', margin: '0 0 2px' }}>Total Earned: ₦{ceoWallet.total_earned.toLocaleString()}</p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', margin: 0 }}>Platform Volume: ₦{ceoWallet.total_platform_volume.toLocaleString()}</p>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Total Riders', value: stats.totalRiders, icon: '🛵', color: '#8B5CF6', tab: 'riders' as CEOTab },
              { label: 'Active Drivers', value: stats.totalDrivers, icon: '🚗', color: '#F59E0B', tab: 'drivers' as CEOTab },
              { label: 'Active Rides', value: stats.activeRides, icon: '🗺️', color: '#EC4899', tab: 'rides' as CEOTab },
              { label: "Today's Revenue", value: `₦${stats.todayRevenue.toLocaleString()}`, icon: '💰', color: '#22C55E', tab: 'earnings' as CEOTab },
              { label: 'Pending Approvals', value: pendingDrivers.length, icon: '⏳', color: '#F59E0B', tab: 'approvals' as CEOTab },
              { label: 'Pending Payouts', value: stats.pendingWithdrawals, icon: '💸', color: '#EF4444', tab: 'withdrawals' as CEOTab },
            ].map(s => (
              <button key={s.label} onClick={() => setActiveTab(s.tab)} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${s.color}22`, borderRadius: '22px', padding: '18px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: "'Poppins', sans-serif" }}>
                <p style={{ fontSize: '28px', margin: '0 0 6px' }}>{s.icon}</p>
                <p style={{ color: s.color, fontSize: '26px', fontWeight: 900, margin: '0 0 4px' }}>{s.value}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0, fontWeight: 600 }}>{s.label}</p>
              </button>
            ))}
          </div>

          {/* Live map */}
          <div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 700, margin: '0 0 10px', letterSpacing: '0.1em' }}>🔴 LIVE ACTIVE RIDES</p>
            <MapboxMap height={260} center={[3.3792, 6.5244]} zoom={9} markers={activeRideMarkers} mode="ceo" containerStyle={{ borderRadius: '22px' }} />
          </div>
        </div>
      );

      case 'riders': {
        const filtered = riders.filter(r => !searchQuery || [(r.full_name as string), (r.username as string), (r.email as string)].some(v => v?.toLowerCase().includes(searchQuery.toLowerCase())));
        return (
          <div>
            <input className="rb-input" placeholder="🔍 Search riders by name, username, email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ marginBottom: '14px' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 12px' }}>{filtered.length} riders total</p>
            {filtered.map(r => (
              <button key={r.id as string} onClick={() => { setSelectedItem(r); setDetailView(true); }} style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', padding: '14px 16px', marginBottom: '9px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', gap: '14px' }}>
                <ProfileAvatar name={r.full_name as string} profilePic={r.profile_pic as string | null} size={44} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: 700, margin: '0 0 2px' }}>{r.full_name as string}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>@{r.username as string} · ₦{Number(r.wallet_balance).toLocaleString()}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.status === 'active' ? '#4ADE80' : r.status === 'frozen' ? '#EF4444' : '#888' }} />
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '16px' }}>›</span>
                </div>
              </button>
            ))}
          </div>
        );
      }

      case 'drivers': {
        const filtered = drivers.filter(r => !searchQuery || [(r.full_name as string), (r.username as string), (r.vehicle_make as string)].some(v => v?.toLowerCase().includes(searchQuery.toLowerCase())));
        return (
          <div>
            <input className="rb-input" placeholder="🔍 Search drivers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ marginBottom: '14px' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 12px' }}>{filtered.length} drivers</p>
            {filtered.map(d => (
              <button key={d.id as string} onClick={() => { setSelectedItem(d); setDetailView(true); }} style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', padding: '14px 16px', marginBottom: '9px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', gap: '14px' }}>
                <ProfileAvatar name={d.full_name as string} profilePic={d.profile_pic as string | null} size={44} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: 700, margin: '0 0 2px' }}>{d.full_name as string}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>{d.vehicle_make as string} {d.vehicle_model as string} · ₦{Number(d.wallet_balance).toLocaleString()}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: (d.is_online as boolean) ? '#4ADE80' : 'rgba(255,255,255,0.15)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '16px' }}>›</span>
                </div>
              </button>
            ))}
          </div>
        );
      }

      case 'approvals': return (
        <div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 14px' }}>{pendingDrivers.length} applications pending review</p>
          {pendingDrivers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ fontSize: '52px', margin: '0 0 12px' }}>✅</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px', fontWeight: 600 }}>All caught up!</p>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>No pending driver applications</p>
            </div>
          ) : pendingDrivers.map(d => (
            <button key={d.id as string} onClick={() => { setSelectedItem(d); setDetailView(true); }} style={{ width: '100%', textAlign: 'left', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '18px', padding: '14px 16px', marginBottom: '9px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', gap: '14px' }}>
              <ProfileAvatar name={d.full_name as string} profilePic={d.profile_pic as string | null} size={44} />
              <div style={{ flex: 1 }}>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: 700, margin: '0 0 2px' }}>{d.full_name as string}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>{d.vehicle_year as string} {d.vehicle_make as string} · {d.state as string}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span style={{ background: 'rgba(245,158,11,0.15)', borderRadius: '10px', padding: '2px 10px', color: '#FCD34D', fontSize: '11px', fontWeight: 700 }}>PENDING</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '16px' }}>›</span>
              </div>
            </button>
          ))}
        </div>
      );

      case 'rides': {
        const statusColors: Record<string, string> = { active: '#4ADE80', searching: '#F59E0B', completed: '#8B5CF6', cancelled: '#EF4444' };
        const filtered = rides.filter(r => {
          const matchSearch = !searchQuery || [(r.rider_name as string), (r.driver_name as string), (r.pickup as string), (r.destination as string)].some(v => v?.toLowerCase().includes(searchQuery.toLowerCase()));
          const matchStatus = rideStatusFilter === 'all' || r.status === rideStatusFilter;
          return matchSearch && matchStatus;
        });
        return (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
              {['all', 'active', 'searching', 'completed', 'cancelled'].map(s => (
                <button key={s} onClick={() => setRideStatusFilter(s)} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: '12px', background: rideStatusFilter === s ? (statusColors[s] || 'linear-gradient(135deg, #8B5CF6, #EC4899)') : 'rgba(255,255,255,0.06)', border: rideStatusFilter === s ? 'none' : '1px solid rgba(255,255,255,0.08)', color: rideStatusFilter === s ? (s === 'all' ? 'white' : 'white') : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: "'Poppins', sans-serif", textTransform: 'capitalize' }}>{s}</button>
              ))}
            </div>
            <input className="rb-input" placeholder="🔍 Search rides..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ marginBottom: '12px' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 12px' }}>{filtered.length} rides</p>
            {filtered.map(r => (
              <button key={r.id as string} onClick={() => { setSelectedItem(r); setDetailView(true); }} style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '13px 15px', marginBottom: '8px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColors[r.status as string] || '#888', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: 700, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.rider_name as string} → {r.destination as string}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: 0 }}>₦{Number(r.fare).toLocaleString()} · {r.driver_name as string || 'No driver'} · {new Date(r.created_at as string).toLocaleDateString('en-NG')}</p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '16px', flexShrink: 0 }}>›</span>
              </button>
            ))}
          </div>
        );
      }

      case 'earnings': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'linear-gradient(135deg, #6D28D9, #EC4899)', borderRadius: '28px', padding: '26px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '11px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '0.1em' }}>CEO WALLET</p>
            <p style={{ color: 'white', fontSize: '36px', fontWeight: 900, margin: '0 0 2px' }}>₦{ceoWallet.balance.toLocaleString()}</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 2px' }}>Earned All Time: ₦{ceoWallet.total_earned.toLocaleString()}</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0 }}>Withdrawn: ₦{ceoWallet.total_withdrawn.toLocaleString()}</p>
          </div>

          {/* Platform volume */}
          <div className="glass-card" style={{ padding: '18px', borderRadius: '20px' }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '0.1em' }}>TOTAL PLATFORM VOLUME</p>
            <p style={{ color: '#4ADE80', fontSize: '28px', fontWeight: 800, margin: 0 }}>₦{ceoWallet.total_platform_volume.toLocaleString()}</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: '4px 0 0' }}>All money ever processed through RetroBliss</p>
          </div>

          {/* Commission settings */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '20px' }}>
            <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 16px' }}>⚙️ Commission Split</h3>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>DRIVER KEEPS: {retentionPct}% · CEO GETS: {100 - retentionPct}%</label>
            <input type="range" min={10} max={90} step={5} value={retentionPct} onChange={e => setRetentionPct(Number(e.target.value))} style={{ width: '100%', accentColor: '#8B5CF6', marginBottom: '8px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                <p style={{ color: '#4ADE80', fontSize: '22px', fontWeight: 800, margin: '0 0 2px' }}>{retentionPct}%</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0 }}>Driver keeps</p>
              </div>
              <div style={{ background: 'rgba(139,92,246,0.1)', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                <p style={{ color: '#C4B5FD', fontSize: '22px', fontWeight: 800, margin: '0 0 2px' }}>{100 - retentionPct}%</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0' }}>RetroBliss gets</p>
              </div>
            </div>
            <button onClick={handleSaveSettings} className="btn-gradient" style={{ width: '100%', padding: '14px', borderRadius: '16px', fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Save Commission Settings</button>
            <button onClick={handleCollectEarnings} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'linear-gradient(135deg, #F59E0B, #EF4444)', border: 'none', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>💼 Collect Commissions Now</button>
          </div>

          {/* CEO withdrawal */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '20px' }}>
            <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 16px' }}>💸 CEO Wallet Withdrawal</h3>
            <input className="rb-input" type="number" placeholder="Amount (min ₦1,000)" value={ceoWithdrawAmount} onChange={e => setCeoWithdrawAmount(e.target.value)} style={{ marginBottom: '10px' }} />
            <input className="rb-input" placeholder="Bank name (e.g. GTBank)" value={ceoBank} onChange={e => setCeoBank(e.target.value)} style={{ marginBottom: '10px' }} />
            <input className="rb-input" placeholder="Account number" value={ceoAcct} onChange={e => setCeoAcct(e.target.value)} style={{ marginBottom: '10px' }} />
            <input className="rb-input" placeholder="Account name" value={ceoAcctName} onChange={e => setCeoAcctName(e.target.value)} style={{ marginBottom: '12px' }} />
            <button onClick={handleCEOWithdrawal} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>💸 Withdraw from CEO Wallet</button>
          </div>
        </div>
      );

      case 'audit': {
        const filtered = auditLogs.filter(l => !searchQuery || [(l.action as string), (l.performer as string)].some(v => v?.toLowerCase().includes(searchQuery.toLowerCase())));
        return (
          <div>
            <input className="rb-input" placeholder="🔍 Search by action or performer..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ marginBottom: '14px' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 12px' }}>{filtered.length} entries</p>
            {filtered.map(log => (
              <button key={log.id as string} onClick={() => { setSelectedItem(log); setDetailView(true); }} style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '12px 14px', marginBottom: '7px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: log.performer_role === 'admin' ? 'rgba(139,92,246,0.15)' : log.performer_role === 'driver' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                  {log.performer_role === 'admin' ? '👑' : log.performer_role === 'driver' ? '🚗' : '🛵'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(log.action as string).replace(/_/g, ' ')}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: 0 }}>{log.performer as string} · {new Date(log.created_at as string).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '16px', flexShrink: 0 }}>›</span>
              </button>
            ))}
          </div>
        );
      }

      case 'withdrawals': {
        const pending = withdrawals.filter(w => w.status === 'pending');
        const past = withdrawals.filter(w => w.status !== 'pending');
        return (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 700, margin: '0 0 12px', letterSpacing: '0.1em' }}>PENDING WITHDRAWALS ({pending.length})</p>
            {pending.length === 0 ? (
              <div className="glass" style={{ borderRadius: '18px', padding: '24px', textAlign: 'center', marginBottom: '16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', margin: 0 }}>No pending withdrawal requests</p>
              </div>
            ) : pending.map(w => (
              <div key={w.id as string} className="glass-card" style={{ padding: '16px', marginBottom: '10px', borderRadius: '20px', border: '1px solid rgba(245,158,11,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <p style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 2px' }}>{w.driver_name as string}</p>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '0 0 2px' }}>{w.bank_name as string} · {w.bank_account as string}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 }}>{w.bank_account_name as string}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#FCD34D', fontSize: '20px', fontWeight: 900, margin: '0 0 2px' }}>₦{Number(w.amount).toLocaleString()}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 }}>{new Date(w.created_at as string).toLocaleDateString('en-NG')}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleRejectWithdrawal(w.id as string)} style={{ flex: 1, padding: '12px', borderRadius: '14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>Reject</button>
                  <button onClick={() => handleApproveWithdrawal(w.id as string)} style={{ flex: 2, padding: '12px', borderRadius: '14px', background: 'linear-gradient(135deg, #22C55E, #16A34A)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>✓ Approve & Pay</button>
                </div>
              </div>
            ))}
            {past.length > 0 && (
              <>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 700, margin: '16px 0 10px', letterSpacing: '0.1em' }}>PAST WITHDRAWALS</p>
                {past.slice(0, 15).map(w => (
                  <div key={w.id as string} className="glass" style={{ borderRadius: '16px', padding: '13px 15px', marginBottom: '7px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ color: 'white', fontSize: '13px', fontWeight: 500, margin: '0 0 2px' }}>{w.driver_name as string}</p>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 }}>{new Date(w.created_at as string).toLocaleDateString('en-NG')}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: w.status === 'approved' ? '#4ADE80' : '#FCA5A5', fontSize: '14px', fontWeight: 700, margin: '0 0 2px' }}>₦{Number(w.amount).toLocaleString()}</p>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0, textTransform: 'capitalize' }}>{w.status as string}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      }

      case 'controls': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '20px', borderRadius: '20px' }}>
            <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 16px' }}>💰 Pricing Config</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>BASE FARE (₦)</label>
                <input className="rb-input" type="number" value={baseFare} onChange={e => setBaseFare(Number(e.target.value))} style={{ fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>PER-KM RATE (₦)</label>
                <input className="rb-input" type="number" value={perKmRate} onChange={e => setPerKmRate(Number(e.target.value))} style={{ fontSize: '14px' }} />
              </div>
            </div>
            <div className="glass" style={{ borderRadius: '16px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: 600, margin: 0 }}>Surge Pricing</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '2px 0 0' }}>Auto-raise fares during peak demand</p>
              </div>
              <button onClick={() => setSurgeEnabled(!surgeEnabled)} style={{ width: '52px', height: '28px', borderRadius: '14px', background: surgeEnabled ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.3s ease' }}>
                <div style={{ position: 'absolute', top: '2px', left: surgeEnabled ? '26px' : '2px', width: '24px', height: '24px', borderRadius: '50%', background: 'white', transition: 'left 0.3s ease' }} />
              </button>
            </div>
          </div>

          {/* Nigerian States Selector */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '20px' }}>
            <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 4px' }}>🗺️ Active Ride States</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 14px' }}>Only riders in these Nigerian states can book rides. All cities & locations from active states are auto-available for autocomplete.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px', maxHeight: '220px', overflowY: 'auto' }}>
              {ALL_NIGERIAN_STATES.map(state => (
                <button key={state} onClick={() => setAvailableNigerianStates(prev => prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state])} style={{ padding: '6px 12px', borderRadius: '12px', background: availableNigerianStates.includes(state) ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(255,255,255,0.05)', border: availableNigerianStates.includes(state) ? 'none' : '1px solid rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: availableNigerianStates.includes(state) ? 700 : 400, fontFamily: "'Poppins', sans-serif" }}>
                  {state}
                </button>
              ))}
            </div>
            {availableNigerianStates.length > 0 && (
              <p style={{ color: '#C4B5FD', fontSize: '12px', margin: '0 0 10px' }}>✅ {availableNigerianStates.length} active: {availableNigerianStates.slice(0, 5).join(', ')}{availableNigerianStates.length > 5 ? '...' : ''}</p>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setAvailableNigerianStates(ALL_NIGERIAN_STATES)} style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontFamily: "'Poppins', sans-serif" }}>Select All</button>
              <button onClick={() => setAvailableNigerianStates([])} style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontFamily: "'Poppins', sans-serif" }}>Clear All</button>
            </div>
          </div>

          {/* Specific locations */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '20px' }}>
            <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 4px' }}>📍 Specific Available Locations</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 14px' }}>Add specific areas (these supplement state-level availability)</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '12px', maxHeight: '160px', overflowY: 'auto' }}>
              {availableLocations.map(loc => (
                <div key={loc} style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '12px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{ color: '#C4B5FD', fontSize: '12px', fontWeight: 600 }}>{loc}</span>
                  <button onClick={() => setAvailableLocations(prev => prev.filter(l => l !== loc))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="rb-input" placeholder="Add location (e.g. Lekki Phase 1)..." value={newLocationsInput} onChange={e => setNewLocationsInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newLocationsInput.trim()) { setAvailableLocations(prev => [...prev, newLocationsInput.trim()]); setNewLocationsInput(''); } }} style={{ flex: 1, fontSize: '13px' }} />
              <button onClick={() => { if (newLocationsInput.trim()) { setAvailableLocations(prev => [...prev, newLocationsInput.trim()]); setNewLocationsInput(''); } }} style={{ padding: '0 16px', borderRadius: '16px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: 700, fontFamily: "'Poppins', sans-serif", flexShrink: 0 }}>+</button>
            </div>
          </div>

          <button onClick={handleSaveSettings} className="btn-gradient" style={{ width: '100%', padding: '16px', borderRadius: '20px', fontSize: '15px', fontWeight: 700 }}>💾 Save All Platform Settings</button>
        </div>
      );

      case 'notifications': return (
        <div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 14px' }}>{notifications.length} notifications · {notifCount} unread</p>
          {notifications.map(n => (
            <div key={n.id as string} className="glass-card" style={{ padding: '15px', marginBottom: '10px', borderRadius: '20px', border: n.read ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(139,92,246,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }} onClick={() => handleMarkNotifRead(n.id as string)}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: n.read ? 500 : 700, margin: '0 0 3px' }}>{n.title as string}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 3px', lineHeight: 1.4 }}>{n.message as string}</p>
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', margin: 0 }}>{new Date(n.created_at as string).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })} · {n.user_role as string}</p>
                </div>
                {!n.read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8B5CF6', flexShrink: 0, marginTop: '4px' }} />}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="rb-input" placeholder="Reply to this user..." value={replyMsg} onChange={e => setReplyMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReplyNotification(n.id as string, n.user_id as string, n.user_role as string)} style={{ flex: 1, fontSize: '12px', padding: '10px 14px' }} />
                <button onClick={() => handleReplyNotification(n.id as string, n.user_id as string, n.user_role as string)} style={{ padding: '10px 14px', borderRadius: '12px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>➤</button>
              </div>
            </div>
          ))}
        </div>
      );

      case 'broadcasts': return (
        <div>
          <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderRadius: '20px' }}>
            <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 16px' }}>📢 Platform Broadcast</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {[{ key: 'all', label: '👥 Everyone' }, { key: 'riders', label: '🛵 Riders Only' }, { key: 'drivers', label: '🚗 Drivers Only' }].map(t => (
                <button key={t.key} onClick={() => setBroadcastTarget(t.key as typeof broadcastTarget)} style={{ flex: 1, padding: '10px 6px', borderRadius: '14px', background: broadcastTarget === t.key ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(255,255,255,0.06)', border: broadcastTarget === t.key ? 'none' : '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>{t.label}</button>
              ))}
            </div>
            <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Type your message to the platform..." rows={4} style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', color: 'white', fontSize: '14px', padding: '14px', fontFamily: "'Poppins', sans-serif", resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }} />
            <button onClick={handleBroadcast} style={{ width: '100%', padding: '15px', borderRadius: '16px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
              📢 Send Broadcast to {broadcastTarget === 'all' ? 'Everyone' : broadcastTarget === 'riders' ? 'All Riders' : 'All Drivers'}
            </button>
          </div>
        </div>
      );

      case 'chat': {
        const userChats = chatMessages.reduce((acc: Record<string, Record<string, unknown>[]>, msg: Record<string, unknown>) => {
          const uid = msg.user_id as string;
          if (!acc[uid]) acc[uid] = [];
          acc[uid].push(msg);
          return acc;
        }, {});

        if (selectedChatUser) {
          const msgs = (userChats[selectedChatUser.id] || []).sort((a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime());
          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 240px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <button onClick={() => setSelectedChatUser(null)} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '12px', padding: '8px 14px', color: 'white', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: '13px' }}>←</button>
                <div>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: 700, margin: 0 }}>{selectedChatUser.name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0, textTransform: 'capitalize' }}>{selectedChatUser.role}</p>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                {msgs.map(msg => (
                  <div key={msg.id as string} style={{ display: 'flex', justifyContent: (msg.sender as string) === 'ceo' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '78%', background: (msg.sender as string) === 'ceo' ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(255,255,255,0.08)', borderRadius: '16px', padding: '10px 14px' }}>
                      <p style={{ color: 'white', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>{msg.message as string}</p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', margin: '4px 0 0', textAlign: (msg.sender as string) === 'ceo' ? 'right' : 'left' }}>{new Date(msg.created_at as string).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="rb-input" placeholder="Reply..." value={chatReply} onChange={e => setChatReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendChatReply()} style={{ flex: 1, fontSize: '13px', padding: '12px 16px' }} />
                <button onClick={handleSendChatReply} style={{ padding: '12px 16px', borderRadius: '14px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>➤</button>
              </div>
            </div>
          );
        }

        const uniqueUsers = Object.entries(userChats).map(([uid, msgs]) => {
          const lastMsg = [...msgs].sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())[0] as Record<string, unknown>;
          const userMsg = msgs.find((m: Record<string, unknown>) => m.sender !== 'ceo') as Record<string, unknown> | undefined;
          return { id: uid, name: (userMsg?.user_name as string) || 'User', role: lastMsg?.user_role as string, lastMsg: lastMsg?.message as string, time: lastMsg?.created_at as string, unread: msgs.filter((m: Record<string, unknown>) => !(m.read as boolean) && m.sender !== 'ceo').length };
        });

        return (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 14px' }}>{uniqueUsers.length} conversations</p>
            {uniqueUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}><p style={{ fontSize: '48px', margin: '0 0 12px' }}>💬</p><p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No support messages yet</p></div>
            ) : uniqueUsers.map(user => (
              <button key={user.id} onClick={() => { setSelectedChatUser({ id: user.id, name: user.name, role: user.role }); fetchChatMessages(); }} style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: user.unread > 0 ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', padding: '14px 16px', marginBottom: '9px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: user.role === 'driver' ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{user.role === 'driver' ? '🚗' : '🛵'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <p style={{ color: 'white', fontSize: '13px', fontWeight: 700, margin: 0 }}>{user.name}</p>
                    {user.unread > 0 && <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'white', fontSize: '10px', fontWeight: 700 }}>{user.unread}</span></div>}
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.lastMsg}</p>
                </div>
              </button>
            ))}
          </div>
        );
      }

      case 'contact-settings': return (
        <div>
          <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderRadius: '20px' }}>
            <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>➕ Add Contact Channel</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '12px' }}>
              {['whatsapp', 'telegram', 'instagram', 'twitter', 'email', 'phone', 'facebook', 'youtube', 'tiktok', 'linkedin'].map(p => (
                <button key={p} onClick={() => { setNewContactPlatform(p); setNewContactLabel(p.charAt(0).toUpperCase() + p.slice(1)); }} style={{ padding: '6px 12px', borderRadius: '12px', background: newContactPlatform === p ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(255,255,255,0.06)', border: newContactPlatform === p ? 'none' : '1px solid rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: "'Poppins', sans-serif", textTransform: 'capitalize' }}>{p}</button>
              ))}
            </div>
            <input className="rb-input" placeholder="Label (e.g. CEO WhatsApp)" value={newContactLabel} onChange={e => setNewContactLabel(e.target.value)} style={{ marginBottom: '10px', fontSize: '13px' }} />
            <input className="rb-input" placeholder="Value (phone, @username, or full URL)" value={newContactValue} onChange={e => setNewContactValue(e.target.value)} style={{ marginBottom: '12px', fontSize: '13px' }} />
            <button onClick={handleAddContact} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>Add Contact Channel</button>
          </div>
          {contactSettings.length > 0 && (
            <>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 700, margin: '0 0 10px', letterSpacing: '0.1em' }}>ACTIVE CHANNELS</p>
              {contactSettings.map(c => (
                <div key={c.id as string} className="glass" style={{ borderRadius: '16px', padding: '14px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, margin: '0 0 2px' }}>{c.label as string}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>{c.platform as string} · {c.value as string}</p>
                  </div>
                  <button onClick={() => handleDeleteContact(c.id as string)} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '6px 12px', color: '#FCA5A5', cursor: 'pointer', fontSize: '12px', fontFamily: "'Poppins', sans-serif" }}>Remove</button>
                </div>
              ))}
            </>
          )}
        </div>
      );

      default: return null;
    }
  };

  // ── RENDER ──
  if (detailView && selectedItem) {
    return (
      <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif", overflowY: 'auto' }}>
        <NotificationSystem userId="ceo" userRole="admin" />
        {renderDetail()}
        {showDeclineModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div className="glass-strong" style={{ borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '380px', animation: 'scaleIn 0.3s ease' }}>
              <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>⚠️ Decline Application</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 16px' }}>Provide a mandatory reason that will be sent to the driver.</p>
              <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="e.g. ID documents unclear, vehicle doesn't meet standards..." style={{ width: '100%', minHeight: '90px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', color: 'white', fontSize: '14px', padding: '14px', fontFamily: "'Poppins', sans-serif", resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button onClick={() => setShowDeclineModal(false)} style={{ flex: 1, padding: '13px', borderRadius: '14px', background: 'rgba(255,255,255,0.07)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontFamily: "'Poppins', sans-serif" }}>Cancel</button>
                <button onClick={handleDeclineDriver} style={{ flex: 2, padding: '13px', borderRadius: '14px', background: 'linear-gradient(135deg, #EF4444, #B91C1C)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>Send Decline</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif", paddingBottom: '80px' }}>
      <NotificationSystem userId="ceo" userRole="admin" />

      {/* Header */}
      <div style={{ background: 'rgba(8,6,18,0.98)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '48px 20px 16px', position: 'sticky', top: 0, zIndex: 50, maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ADE80' }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, margin: 0, letterSpacing: '0.1em' }}>CEO ADMINISTRATIVE SYSTEM</p>
            </div>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 900, margin: 0 }}>RetroBliss CAS</h2>
          </div>
          <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '8px 14px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontFamily: "'Poppins', sans-serif" }}>Sign Out</button>
        </div>

        {/* More tabs as scrollable chips */}
        <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          {moreTabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flexShrink: 0, padding: '7px 12px', borderRadius: '12px', background: activeTab === t.key ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)', border: activeTab === t.key ? '1.5px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.07)', color: activeTab === t.key ? '#C4B5FD' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '11px', fontWeight: activeTab === t.key ? 700 : 500, fontFamily: "'Poppins', sans-serif", whiteSpace: 'nowrap' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 20px 20px', maxWidth: '480px', margin: '0 auto' }}>
        <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 800, margin: '0 0 16px' }}>
          {[...bottomTabs, ...moreTabs].find(t => t.key === activeTab)?.icon} {activeTab.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </h3>
        {renderTabContent()}
      </div>

      {/* Bottom 7-Tab Navigation */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: 'rgba(8,6,18,0.97)', backdropFilter: 'blur(24px)', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px 8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))', zIndex: 50 }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {bottomTabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex: 1, padding: '10px 2px 8px', borderRadius: '14px', background: activeTab === t.key ? 'rgba(139,92,246,0.2)' : 'transparent', border: activeTab === t.key ? '1.5px solid rgba(139,92,246,0.4)' : '1px solid transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'all 0.2s ease', fontFamily: "'Poppins', sans-serif" }}>
              <span style={{ fontSize: t.key === 'approvals' && pendingDrivers.length > 0 ? '16px' : '20px' }}>
                {t.key === 'approvals' && pendingDrivers.length > 0 ? (
                  <span style={{ position: 'relative', display: 'inline-block' }}>
                    {t.icon}
                    <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#EF4444', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'white', fontWeight: 700 }}>{pendingDrivers.length > 9 ? '9+' : pendingDrivers.length}</span>
                  </span>
                ) : t.icon}
              </span>
              <span style={{ color: activeTab === t.key ? '#C4B5FD' : 'rgba(255,255,255,0.35)', fontSize: '9px', fontWeight: activeTab === t.key ? 700 : 500, textAlign: 'center', lineHeight: 1.2 }}>
                {t.label.replace(` (${pendingDrivers.length})`, '')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="glass-strong" style={{ borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '380px', animation: 'scaleIn 0.3s ease' }}>
            <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>⚠️ Decline Application</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 16px' }}>This reason will be sent directly to the driver as a notification.</p>
            <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="e.g. ID documents were unclear or expired..." style={{ width: '100%', minHeight: '90px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', color: 'white', fontSize: '14px', padding: '14px', fontFamily: "'Poppins', sans-serif", resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button onClick={() => setShowDeclineModal(false)} style={{ flex: 1, padding: '13px', borderRadius: '14px', background: 'rgba(255,255,255,0.07)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontFamily: "'Poppins', sans-serif" }}>Cancel</button>
              <button onClick={handleDeclineDriver} style={{ flex: 2, padding: '13px', borderRadius: '14px', background: 'linear-gradient(135deg, #EF4444, #B91C1C)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>Send Decline Notice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CEODashboard;
