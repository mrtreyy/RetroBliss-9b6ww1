import React, { useState, useEffect } from 'react';
import MapboxMap from '@/components/MapboxMap';
import NotificationSystem from '@/components/NotificationSystem';
import ProfileAvatar from '@/components/ProfileAvatar';
import { supabase, generateId, formatCurrency, logAuditDB, getClientIP, sendNotification, getPlatformSetting, setPlatformSetting, getCEOWallet, updateCEOWallet } from '@/lib/supabase';
import { toast } from 'sonner';

interface CEODashboardProps {
  onLogout: () => void;
}

type CEOTab = 'dashboard' | 'riders' | 'drivers' | 'rides' | 'approvals' | 'earnings' | 'audit' | 'controls' | 'notifications' | 'withdrawals';
type DetailView = 'list' | 'detail';

const NIGERIAN_COORDS: Record<string, [number, number]> = {
  'Ikeja': [3.3488, 6.6018], 'Victoria Island': [3.4219, 6.4314],
  'Lekki': [3.5561, 6.4478], 'Surulere': [3.3494, 6.5057],
  'Yaba': [3.3796, 6.5159], 'Maitama': [7.5053, 9.0781],
};

const CEODashboard: React.FC<CEODashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<CEOTab>('dashboard');
  const [detailView, setDetailView] = useState<DetailView>('list');
  const [selectedItem, setSelectedItem] = useState<Record<string, unknown> | null>(null);

  // Data
  const [riders, setRiders] = useState<Record<string, unknown>[]>([]);
  const [drivers, setDrivers] = useState<Record<string, unknown>[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<Record<string, unknown>[]>([]);
  const [rides, setRides] = useState<Record<string, unknown>[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [notifications, setNotifications] = useState<Record<string, unknown>[]>([]);
  const [withdrawals, setWithdrawals] = useState<Record<string, unknown>[]>([]);
  const [ceoWallet, setCeoWallet] = useState({ balance: 0, total_earned: 0, total_withdrawn: 0 });
  const [retentionPct, setRetentionPct] = useState(50);
  const [baseFare, setBaseFare] = useState(500);
  const [perKmRate, setPerKmRate] = useState(80);
  const [availableStates, setAvailableStates] = useState<string[]>(['Lagos', 'Abuja', 'Rivers', 'Kano', 'Oyo']);
  const [availableLocations, setAvailableLocations] = useState<string[]>(['Ikeja', 'Victoria Island', 'Lekki', 'Surulere', 'Yaba', 'Maitama', 'Wuse II']);
  const [surgeEnabled, setSurgeEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [pendingDeclineId, setPendingDeclineId] = useState('');
  const [stats, setStats] = useState({ totalRiders: 0, totalDrivers: 0, activeRides: 0, todayRevenue: 0, pendingWithdrawals: 0 });
  const [activeRideMarkers, setActiveRideMarkers] = useState<{ id: string; lat: number; lng: number; label: string; color: string }[]>([]);
  const [newLocationsInput, setNewLocationsInput] = useState('');
  const [replyMsg, setReplyMsg] = useState('');
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    fetchAll();
    const poll = setInterval(fetchStats, 6000);
    const notifChannel = supabase.channel('ceo-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rb_notifications', filter: 'user_id=eq.ceo' }, () => fetchNotifications())
      .subscribe();
    return () => { clearInterval(poll); supabase.removeChannel(notifChannel); };
  }, []);

  const fetchAll = async () => {
    await Promise.all([fetchRiders(), fetchDrivers(), fetchRides(), fetchAuditLogs(), fetchNotifications(), fetchWithdrawals(), fetchSettings(), fetchCEOWallet()]);
    await fetchStats();
  };

  const fetchRiders = async () => {
    const { data } = await supabase.from('rb_riders').select('*').order('created_at', { ascending: false });
    setRiders(data || []);
  };
  const fetchDrivers = async () => {
    const { data } = await supabase.from('rb_drivers').select('*').order('created_at', { ascending: false });
    const all = data || [];
    setDrivers(all.filter((d: Record<string, unknown>) => d.status === 'active'));
    setPendingDrivers(all.filter((d: Record<string, unknown>) => d.status === 'pending'));
  };
  const fetchRides = async () => {
    const { data } = await supabase.from('rb_rides').select('*').order('created_at', { ascending: false });
    const rideList = data || [];
    setRides(rideList);
    // Set active ride markers
    const active = rideList.filter((r: Record<string, unknown>) => r.status === 'active');
    setActiveRideMarkers(active.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      lat: (r.pickup_lat as number) || 6.5244,
      lng: (r.pickup_lng as number) || 3.3792,
      label: `${r.rider_name} → ${r.destination}`,
      color: '#8B5CF6',
    })));
  };
  const fetchAuditLogs = async () => {
    const { data } = await supabase.from('rb_audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
    setAuditLogs(data || []);
  };
  const fetchNotifications = async () => {
    const { data } = await supabase.from('rb_notifications').select('*').order('created_at', { ascending: false }).limit(50);
    const notifs = data || [];
    setNotifications(notifs);
    setNotifCount(notifs.filter((n: Record<string, unknown>) => !n.read).length);
  };
  const fetchWithdrawals = async () => {
    const { data } = await supabase.from('rb_withdrawals').select('*').order('created_at', { ascending: false });
    setWithdrawals(data || []);
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
    if (Array.isArray(states)) setAvailableStates(states);
    if (Array.isArray(locs)) setAvailableLocations(locs);
    if (typeof surge === 'boolean') setSurgeEnabled(surge);
  };
  const fetchCEOWallet = async () => {
    const w = await getCEOWallet();
    setCeoWallet(w);
  };
  const fetchStats = async () => {
    const { count: rc } = await supabase.from('rb_riders').select('id', { count: 'exact', head: true });
    const { count: dc } = await supabase.from('rb_drivers').select('id', { count: 'exact', head: true }).eq('status', 'active');
    const { count: arc } = await supabase.from('rb_rides').select('id', { count: 'exact', head: true }).eq('status', 'active');
    const today = new Date().toISOString().split('T')[0];
    const { data: todayRides } = await supabase.from('rb_rides').select('commission_amount').eq('status', 'completed').gte('created_at', today);
    const todayRev = todayRides?.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r.commission_amount) || 0), 0) || 0;
    const { count: wc } = await supabase.from('rb_withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    setStats({ totalRiders: rc || 0, totalDrivers: dc || 0, activeRides: arc || 0, todayRevenue: todayRev, pendingWithdrawals: wc || 0 });
    fetchCEOWallet();
  };

  const handleApproveDriver = async (driverId: string, driverName: string) => {
    await supabase.from('rb_drivers').update({ status: 'active' }).eq('id', driverId);
    await sendNotification(driverId, 'driver', '🎉 Application Approved!', 'Congratulations! Your RetroBliss driver account is now active. Start accepting rides today!');
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'driver_approve', driverId, { driver_name: driverName }, ip, 'Nigeria');
    toast.success(`${driverName}'s account approved!`);
    fetchDrivers();
    setDetailView('list');
    setSelectedItem(null);
  };

  const openDeclineModal = (driverId: string) => {
    setPendingDeclineId(driverId);
    setDeclineReason('');
    setShowDeclineModal(true);
  };

  const handleDeclineDriver = async () => {
    if (!declineReason.trim()) { toast.error('Please provide a reason for declining.'); return; }
    const d = pendingDrivers.find(d => d.id === pendingDeclineId);
    await supabase.from('rb_drivers').update({ status: 'declined', decline_reason: declineReason }).eq('id', pendingDeclineId);
    await sendNotification(pendingDeclineId, 'driver', '❌ Application Declined', `Your driver application was declined. Reason: ${declineReason}. You may apply again with updated information.`);
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'driver_decline', pendingDeclineId, { reason: declineReason, driver_name: d?.full_name }, ip, 'Nigeria');
    toast.info('Driver application declined.');
    setShowDeclineModal(false);
    fetchDrivers();
    setDetailView('list');
    setSelectedItem(null);
  };

  const handleFreezeRider = async (riderId: string, riderName: string, freeze: boolean) => {
    await supabase.from('rb_riders').update({ status: freeze ? 'frozen' : 'active' }).eq('id', riderId);
    await sendNotification(riderId, 'rider', freeze ? '🔒 Account Frozen' : '🔓 Account Restored', freeze ? 'Your account has been temporarily frozen by admin.' : 'Your account has been restored. Welcome back!');
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', freeze ? 'rider_freeze' : 'rider_unfreeze', riderId, { rider_name: riderName }, ip, 'Nigeria');
    toast.success(`${riderName}'s account ${freeze ? 'frozen' : 'restored'}.`);
    fetchRiders();
  };

  const handleCancelRide = async (rideId: string) => {
    const ride = rides.find(r => r.id === rideId) as Record<string, unknown>;
    await supabase.from('rb_rides').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', rideId);
    if (ride?.rider_id) await sendNotification(ride.rider_id as string, 'rider', 'Ride Cancelled', 'Your ride was cancelled by admin. No charges applied.', rideId);
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'ride_cancel', rideId, { rider: ride?.rider_name, driver: ride?.driver_name }, ip, 'Nigeria');
    toast.success('Ride cancelled.');
    fetchRides();
    setDetailView('list');
    setSelectedItem(null);
  };

  const handleApproveWithdrawal = async (wId: string) => {
    const w = withdrawals.find(x => x.id === wId) as Record<string, unknown>;
    if (!w) return;
    // Deduct from driver wallet
    const { data: driverData } = await supabase.from('rb_drivers').select('wallet_balance').eq('id', w.driver_id).single();
    if (driverData) {
      await supabase.from('rb_drivers').update({ wallet_balance: Math.max(0, driverData.wallet_balance - Number(w.amount)) }).eq('id', w.driver_id);
    }
    await supabase.from('rb_withdrawals').update({ status: 'approved' }).eq('id', wId);
    await supabase.from('rb_transactions').insert({
      id: generateId(), user_id: w.driver_id, user_role: 'driver',
      type: 'debit', amount: w.amount,
      description: `Withdrawal to ${w.bank_name} · ${w.bank_account}`,
      reference: wId, created_at: new Date().toISOString(),
    });
    await sendNotification(w.driver_id as string, 'driver', '💸 Withdrawal Approved!', `₦${Number(w.amount).toLocaleString()} sent to your ${w.bank_name} account. Should arrive within minutes!`);
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'withdrawal_approve', wId, { driver: w.driver_name, amount: w.amount }, ip, 'Nigeria');
    toast.success('Withdrawal approved and paid!');
    fetchWithdrawals();
    fetchDrivers();
  };

  const handleRejectWithdrawal = async (wId: string) => {
    const w = withdrawals.find(x => x.id === wId) as Record<string, unknown>;
    await supabase.from('rb_withdrawals').update({ status: 'rejected' }).eq('id', wId);
    if (w) await sendNotification(w.driver_id as string, 'driver', '❌ Withdrawal Rejected', `Your withdrawal request of ₦${Number(w.amount).toLocaleString()} was rejected by admin. Contact support.`);
    toast.info('Withdrawal rejected.');
    fetchWithdrawals();
  };

  const handleSaveSettings = async () => {
    await setPlatformSetting('driver_retention_percentage', retentionPct);
    await setPlatformSetting('base_fare', baseFare);
    await setPlatformSetting('per_km_rate', perKmRate);
    await setPlatformSetting('surge_enabled', surgeEnabled);
    await setPlatformSetting('available_states', availableStates);
    await setPlatformSetting('available_locations', availableLocations);
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'settings_update', 'platform', { retention: retentionPct, base_fare: baseFare, per_km: perKmRate, states: availableStates, locations: availableLocations }, ip, 'Nigeria');
    toast.success('Platform settings saved!');
  };

  const handleCollectEarnings = async () => {
    const activeDrivers = drivers.filter(d => Number(d.wallet_balance) > 0);
    let totalCollected = 0;
    for (const d of activeDrivers) {
      const balance = Number(d.wallet_balance);
      const ceoShare = balance * ((100 - retentionPct) / 100);
      if (ceoShare > 0) {
        const newBalance = balance - ceoShare;
        await supabase.from('rb_drivers').update({ wallet_balance: newBalance }).eq('id', d.id);
        totalCollected += ceoShare;
        await sendNotification(d.id as string, 'driver', '💼 Platform Earnings Collected', `RetroBliss has collected its platform share of ₦${ceoShare.toFixed(2).toLocaleString()} from your wallet.`);
        await supabase.from('rb_transactions').insert({
          id: generateId(), user_id: d.id, user_role: 'driver',
          type: 'debit', amount: ceoShare,
          description: `Platform earnings collected (${100 - retentionPct}% share)`,
          reference: `CEO_COLLECT_${Date.now()}`, created_at: new Date().toISOString(),
        });
      }
    }
    if (totalCollected > 0) {
      await updateCEOWallet({ balance: ceoWallet.balance + totalCollected, total_earned: ceoWallet.total_earned + totalCollected });
      const ip = await getClientIP();
      await logAuditDB('CEO Admin', 'admin', 'earnings_collection', 'all_drivers', { total_collected: totalCollected, drivers_count: activeDrivers.length, retention_pct: retentionPct }, ip, 'Nigeria');
      toast.success(`Collected ₦${totalCollected.toFixed(2)} from ${activeDrivers.length} drivers!`);
      fetchCEOWallet();
      fetchDrivers();
    } else {
      toast.info('No earnings to collect right now.');
    }
  };

  const handleReplyNotification = async (notifId: string, userId: string, userRole: string) => {
    if (!replyMsg.trim()) return;
    await sendNotification(userId, userRole, 'Message from RetroBliss Admin', replyMsg);
    await supabase.from('rb_notifications').update({ read: true }).eq('id', notifId);
    const ip = await getClientIP();
    await logAuditDB('CEO Admin', 'admin', 'notification_reply', notifId, { to: userId, message: replyMsg }, ip, 'Nigeria');
    toast.success('Reply sent!');
    setReplyMsg('');
    fetchNotifications();
  };

  const handleAddLocation = () => {
    const loc = newLocationsInput.trim();
    if (!loc) return;
    if (!availableLocations.includes(loc)) {
      setAvailableLocations(prev => [...prev, loc]);
    }
    setNewLocationsInput('');
  };

  const handleRemoveLocation = (loc: string) => {
    setAvailableLocations(prev => prev.filter(l => l !== loc));
  };

  const tabs: { key: CEOTab; icon: string; label: string }[] = [
    { key: 'dashboard', icon: '📊', label: 'Dashboard' },
    { key: 'riders', icon: '🧑‍💼', label: 'Riders' },
    { key: 'drivers', icon: '🚗', label: 'Drivers' },
    { key: 'approvals', icon: '⏳', label: `Approvals${pendingDrivers.length > 0 ? ` (${pendingDrivers.length})` : ''}` },
    { key: 'rides', icon: '🗺️', label: 'Rides' },
    { key: 'withdrawals', icon: '💸', label: `Payouts${stats.pendingWithdrawals > 0 ? ` (${stats.pendingWithdrawals})` : ''}` },
    { key: 'earnings', icon: '💼', label: 'Earnings' },
    { key: 'audit', icon: '📋', label: 'Audit Log' },
    { key: 'controls', icon: '⚙️', label: 'Controls' },
    { key: 'notifications', icon: '🔔', label: `Notifs${notifCount > 0 ? ` (${notifCount})` : ''}` },
  ];

  // ── DETAIL VIEW RENDERS ──
  const renderDetailView = () => {
    if (!selectedItem) return null;

    if (activeTab === 'riders' || activeTab === 'drivers') {
      const isDriver = activeTab === 'drivers';
      const d = selectedItem;
      return (
        <div style={{ padding: '20px 24px 100px', maxWidth: '480px', margin: '0 auto', animation: 'fadeInUp 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
            <button onClick={() => { setDetailView('list'); setSelectedItem(null); }} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '12px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: 0 }}>{isDriver ? 'Driver' : 'Rider'} Profile</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <ProfileAvatar name={d.full_name as string} profilePic={d.profile_pic as string | null} size={80} />
            <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: '12px 0 4px' }}>{d.full_name as string}</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 8px' }}>@{d.username as string}</p>
            <div style={{ background: d.status === 'active' ? 'rgba(34,197,94,0.15)' : d.status === 'frozen' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', border: `1px solid ${d.status === 'active' ? 'rgba(34,197,94,0.4)' : d.status === 'frozen' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`, borderRadius: '20px', padding: '4px 14px' }}>
              <span style={{ color: d.status === 'active' ? '#4ADE80' : d.status === 'frozen' ? '#FCA5A5' : '#FCD34D', fontSize: '12px', fontWeight: 700 }}>{d.status as string}</span>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
            {[
              { label: 'Email', value: d.email as string },
              { label: 'Phone', value: d.phone as string },
              { label: 'Location', value: `${d.location}, ${d.state}` as string },
              { label: 'Wallet', value: `₦${Number(d.wallet_balance).toLocaleString()}` },
              { label: 'Joined', value: new Date(d.created_at as string).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) },
              ...(isDriver ? [
                { label: 'Vehicle', value: `${d.vehicle_year} ${d.vehicle_make} ${d.vehicle_model}` as string },
                { label: 'Plate', value: d.vehicle_plate as string },
                { label: 'Bank', value: `${d.bank_name} · ${d.bank_account}` as string },
              ] : []),
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</span>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: 500, maxWidth: '55%', textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* ID Upload for drivers */}
          {isDriver && d.id_upload && (
            <div className="glass-card" style={{ padding: '16px', marginBottom: '16px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, margin: '0 0 12px', letterSpacing: '0.08em' }}>UPLOADED ID DOCUMENT</p>
              {(d.id_upload as string).startsWith('data:image') ? (
                <img src={d.id_upload as string} alt="Driver ID" style={{ width: '100%', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' }} />
              ) : (
                <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📄</span>
                  <p style={{ color: '#4ADE80', fontSize: '13px', margin: 0 }}>ID Document Uploaded</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!isDriver && (
              <>
                <button onClick={() => handleFreezeRider(d.id as string, d.full_name as string, d.status === 'active')} style={{ padding: '14px', borderRadius: '16px', background: d.status === 'active' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', border: `1px solid ${d.status === 'active' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, color: d.status === 'active' ? '#FCA5A5' : '#4ADE80', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                  {d.status === 'active' ? '🔒 Freeze Account' : '🔓 Restore Account'}
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'rides') {
      const r = selectedItem;
      return (
        <div style={{ padding: '20px 24px 100px', maxWidth: '480px', margin: '0 auto', animation: 'fadeInUp 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
            <button onClick={() => { setDetailView('list'); setSelectedItem(null); }} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '12px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: 0 }}>Ride Details</h2>
          </div>
          <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
            {[
              { label: 'Rider', value: r.rider_name as string },
              { label: 'Driver', value: (r.driver_name as string) || 'Searching...' },
              { label: 'Pickup', value: r.pickup as string },
              { label: 'Destination', value: r.destination as string },
              { label: 'Fare', value: `₦${Number(r.fare).toLocaleString()}` },
              { label: 'Status', value: r.status as string },
              { label: 'Rider Paid', value: `₦${Number(r.rider_paid).toLocaleString()}` },
              { label: 'Driver Earned', value: `₦${Number(r.driver_received).toLocaleString()}` },
              { label: 'Commission', value: `₦${Number(r.commission_amount).toLocaleString()}` },
              { label: 'Booked At', value: new Date(r.created_at as string).toLocaleString('en-NG') },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</span>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>{item.value}</span>
              </div>
            ))}
          </div>
          {/* Route on map */}
          {r.pickup && r.destination && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, margin: '0 0 10px', letterSpacing: '0.08em' }}>ROUTE MAP</p>
              <MapboxMap
                height={200}
                center={NIGERIAN_COORDS[r.pickup as string] || [3.3792, 6.5244]}
                zoom={12}
                activeRideRoute={NIGERIAN_COORDS[r.pickup as string] ? {
                  pickup: NIGERIAN_COORDS[r.pickup as string],
                  destination: NIGERIAN_COORDS[r.destination as string] || [3.4219, 6.4314],
                } : undefined}
                containerStyle={{ borderRadius: '20px' }}
              />
            </div>
          )}
          {(r.status === 'searching' || r.status === 'active') && (
            <button onClick={() => handleCancelRide(r.id as string)} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
              ✕ Cancel This Ride
            </button>
          )}
        </div>
      );
    }

    if (activeTab === 'approvals') {
      const d = selectedItem;
      return (
        <div style={{ padding: '20px 24px 100px', maxWidth: '480px', margin: '0 auto', animation: 'fadeInUp 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
            <button onClick={() => { setDetailView('list'); setSelectedItem(null); }} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '12px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: 0 }}>Driver Application</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <ProfileAvatar name={d.full_name as string} profilePic={d.profile_pic as string | null} size={80} />
            <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: '12px 0 4px' }}>{d.full_name as string}</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>@{d.username as string}</p>
          </div>

          <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
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
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</span>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: 500, maxWidth: '55%', textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* ID Upload preview */}
          {d.id_upload && (
            <div className="glass-card" style={{ padding: '16px', marginBottom: '16px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, margin: '0 0 12px', letterSpacing: '0.08em' }}>GOVERNMENT ID</p>
              {(d.id_upload as string).startsWith('data:image') ? (
                <img src={d.id_upload as string} alt="Driver ID" style={{ width: '100%', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)' }} />
              ) : (
                <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📄</span>
                  <p style={{ color: '#4ADE80', fontSize: '13px', margin: 0 }}>ID Document Uploaded</p>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => openDeclineModal(d.id as string)} style={{ flex: 1, padding: '15px', borderRadius: '16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
              ✕ Decline
            </button>
            <button onClick={() => handleApproveDriver(d.id as string, d.full_name as string)} style={{ flex: 2, padding: '15px', borderRadius: '16px', background: 'linear-gradient(135deg, #22C55E, #16A34A)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>
              ✓ Approve Application
            </button>
          </div>
        </div>
      );
    }

    if (activeTab === 'audit') {
      const log = selectedItem;
      return (
        <div style={{ padding: '20px 24px 100px', maxWidth: '480px', margin: '0 auto', animation: 'fadeInUp 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
            <button onClick={() => { setDetailView('list'); setSelectedItem(null); }} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '12px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: 0 }}>Audit Entry</h2>
          </div>
          <div className="glass-card" style={{ padding: '20px' }}>
            {[
              { label: 'Action', value: log.action as string },
              { label: 'Performer', value: log.performer as string },
              { label: 'Role', value: log.performer_role as string },
              { label: 'Target ID', value: (log.target_id as string)?.substring(0, 20) + '...' },
              { label: 'IP Address', value: log.ip as string },
              { label: 'Location', value: log.location as string },
              { label: 'Time', value: new Date(log.created_at as string).toLocaleString('en-NG') },
              { label: 'Device', value: ((log.device as string) || '').substring(0, 40) + '...' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', flexShrink: 0 }}>{item.label}</span>
                <span style={{ color: 'white', fontSize: '12px', fontWeight: 500, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>{item.value}</span>
              </div>
            ))}
            {log.details && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 8px', fontWeight: 600 }}>DETAILS</p>
                <pre style={{ color: '#C4B5FD', fontSize: '11px', background: 'rgba(139,92,246,0.08)', borderRadius: '12px', padding: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, fontFamily: 'monospace' }}>
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  if (detailView === 'detail') {
    return (
      <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif", overflowY: 'auto' }}>
        <NotificationSystem userId="ceo" userRole="admin" />
        {renderDetailView()}
        {/* Decline modal */}
        {showDeclineModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div className="glass-strong" style={{ borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '380px', animation: 'scaleIn 0.3s ease' }}>
              <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>Decline Application</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 16px' }}>Please provide a mandatory reason for declining this driver's application.</p>
              <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="e.g. ID documents unclear, vehicle too old..." style={{ width: '100%', minHeight: '100px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', color: 'white', fontSize: '14px', padding: '14px', fontFamily: "'Poppins', sans-serif", resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button onClick={() => setShowDeclineModal(false)} style={{ flex: 1, padding: '13px', borderRadius: '14px', background: 'rgba(255,255,255,0.07)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontFamily: "'Poppins', sans-serif" }}>Cancel</button>
                <button onClick={handleDeclineDriver} style={{ flex: 2, padding: '13px', borderRadius: '14px', background: 'linear-gradient(135deg, #EF4444, #B91C1C)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>Send Decline Notice</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── MAIN DASHBOARD TABS ──
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* CEO Wallet */}
            <div style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', borderRadius: '24px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '0.1em' }}>CEO ADMIN WALLET</p>
              <p style={{ color: 'white', fontSize: '32px', fontWeight: 800, margin: '0 0 2px' }}>₦{ceoWallet.balance.toLocaleString()}</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: 0 }}>Total Earned: ₦{ceoWallet.total_earned.toLocaleString()} · Withdrawn: ₦{ceoWallet.total_withdrawn.toLocaleString()}</p>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Total Riders', value: stats.totalRiders, icon: '🧑‍💼', color: '#8B5CF6', glow: 'stat-glow-purple' },
                { label: 'Active Drivers', value: stats.totalDrivers, icon: '🚗', color: '#F59E0B', glow: 'stat-glow-yellow' },
                { label: 'Active Rides', value: stats.activeRides, icon: '🗺️', color: '#EC4899', glow: 'stat-glow-pink' },
                { label: "Today's Revenue", value: `₦${stats.todayRevenue.toLocaleString()}`, icon: '💰', color: '#22C55E', glow: 'stat-glow-green' },
                { label: 'Pending Approvals', value: pendingDrivers.length, icon: '⏳', color: '#F59E0B', glow: 'stat-glow-yellow' },
                { label: 'Pending Payouts', value: stats.pendingWithdrawals, icon: '💸', color: '#8B5CF6', glow: 'stat-glow-purple' },
              ].map(s => (
                <button key={s.label} onClick={() => {
                  if (s.label === 'Total Riders') setActiveTab('riders');
                  if (s.label === 'Active Drivers') setActiveTab('drivers');
                  if (s.label === 'Active Rides') setActiveTab('rides');
                  if (s.label === 'Pending Approvals') setActiveTab('approvals');
                  if (s.label === 'Pending Payouts') setActiveTab('withdrawals');
                }} className={s.glow} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '18px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: "'Poppins', sans-serif" }}>
                  <p style={{ fontSize: '28px', margin: '0 0 8px' }}>{s.icon}</p>
                  <p style={{ color: 'white', fontSize: '24px', fontWeight: 800, margin: '0 0 4px' }}>{s.value}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0, fontWeight: 500 }}>{s.label}</p>
                </button>
              ))}
            </div>

            {/* Active rides map */}
            <div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 700, margin: '0 0 10px', letterSpacing: '0.1em' }}>LIVE ACTIVE RIDES MAP</p>
              <MapboxMap
                height={280}
                center={[3.3792, 6.5244]}
                zoom={10}
                markers={activeRideMarkers}
                mode="ceo"
                containerStyle={{ borderRadius: '22px' }}
              />
            </div>
          </div>
        );

      case 'riders': {
        const filtered = riders.filter(r =>
          !searchQuery || (r.full_name as string)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.username as string)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.email as string)?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return (
          <div>
            <input className="rb-input" placeholder="🔍 Search riders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ marginBottom: '16px' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 12px' }}>{filtered.length} riders total</p>
            {filtered.map(r => (
              <button key={r.id as string} onClick={() => { setSelectedItem(r); setDetailView('detail'); }} style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', padding: '16px', marginBottom: '10px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <ProfileAvatar name={r.full_name as string} profilePic={r.profile_pic as string | null} size={44} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: 600, margin: '0 0 2px' }}>{r.full_name as string}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>@{r.username as string} · ₦{Number(r.wallet_balance).toLocaleString()}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.status === 'active' ? '#4ADE80' : '#EF4444' }} />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px' }}>›</span>
                </div>
              </button>
            ))}
          </div>
        );
      }

      case 'drivers': {
        const filtered = drivers.filter(r =>
          !searchQuery || (r.full_name as string)?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return (
          <div>
            <input className="rb-input" placeholder="🔍 Search drivers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ marginBottom: '16px' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 12px' }}>{filtered.length} active drivers</p>
            {filtered.map(d => (
              <button key={d.id as string} onClick={() => { setSelectedItem(d); setDetailView('detail'); }} style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', padding: '16px', marginBottom: '10px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <ProfileAvatar name={d.full_name as string} profilePic={d.profile_pic as string | null} size={44} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: 600, margin: '0 0 2px' }}>{d.full_name as string}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>{d.vehicle_make as string} {d.vehicle_model as string} · ₦{Number(d.wallet_balance).toLocaleString()}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: (d.is_online as boolean) ? '#4ADE80' : 'rgba(255,255,255,0.2)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px' }}>›</span>
                </div>
              </button>
            ))}
          </div>
        );
      }

      case 'approvals':
        return (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 16px' }}>{pendingDrivers.length} applications pending</p>
            {pendingDrivers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <p style={{ fontSize: '48px', margin: '0 0 12px' }}>✅</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No pending applications</p>
              </div>
            ) : pendingDrivers.map(d => (
              <button key={d.id as string} onClick={() => { setSelectedItem(d); setDetailView('detail'); }} style={{ width: '100%', textAlign: 'left', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '18px', padding: '16px', marginBottom: '10px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', gap: '14px' }}>
                <ProfileAvatar name={d.full_name as string} profilePic={d.profile_pic as string | null} size={44} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: 600, margin: '0 0 2px' }}>{d.full_name as string}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>{d.vehicle_year as string} {d.vehicle_make as string} {d.vehicle_model as string} · {d.state as string}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ background: 'rgba(245,158,11,0.2)', borderRadius: '10px', padding: '2px 8px', color: '#FCD34D', fontSize: '11px', fontWeight: 700 }}>PENDING</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px' }}>›</span>
                </div>
              </button>
            ))}
          </div>
        );

      case 'rides': {
        const statusColors: Record<string, string> = { active: '#4ADE80', searching: '#F59E0B', completed: '#8B5CF6', cancelled: '#EF4444' };
        const filtered = rides.filter(r =>
          !searchQuery || (r.rider_name as string)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.pickup as string)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.destination as string)?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return (
          <div>
            <input className="rb-input" placeholder="🔍 Search rides..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ marginBottom: '16px' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 12px' }}>{filtered.length} rides total</p>
            {filtered.map(r => (
              <button key={r.id as string} onClick={() => { setSelectedItem(r); setDetailView('detail'); }} style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', padding: '14px 16px', marginBottom: '8px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif', display: 'flex', alignItems: 'center', gap: '12px'" }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColors[r.status as string] || '#888', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, margin: '0 0 2px' }}>{r.rider_name as string} → {r.destination as string}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0 }}>₦{Number(r.fare).toLocaleString()} · {new Date(r.created_at as string).toLocaleDateString()}</p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px' }}>›</span>
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
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 700, margin: '0 0 12px', letterSpacing: '0.08em' }}>PENDING WITHDRAWALS</p>
            {pending.length === 0 ? (
              <div className="glass" style={{ borderRadius: '18px', padding: '24px', textAlign: 'center', marginBottom: '16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', margin: 0 }}>No pending withdrawals</p>
              </div>
            ) : pending.map(w => (
              <div key={w.id as string} className="glass-card" style={{ padding: '16px', marginBottom: '10px', borderRadius: '18px', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: 700, margin: '0 0 2px' }}>{w.driver_name as string}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>{w.bank_name as string} · {w.bank_account as string}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: '2px 0 0' }}>{w.bank_account_name as string}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#FCD34D', fontSize: '18px', fontWeight: 800, margin: 0 }}>₦{Number(w.amount).toLocaleString()}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: '2px 0 0' }}>{new Date(w.created_at as string).toLocaleDateString()}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleRejectWithdrawal(w.id as string)} style={{ flex: 1, padding: '11px', borderRadius: '14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                    Reject
                  </button>
                  <button onClick={() => handleApproveWithdrawal(w.id as string)} style={{ flex: 2, padding: '11px', borderRadius: '14px', background: 'linear-gradient(135deg, #22C55E, #16A34A)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>
                    ✓ Approve & Pay
                  </button>
                </div>
              </div>
            ))}
            {past.length > 0 && (
              <>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 700, margin: '16px 0 12px', letterSpacing: '0.08em' }}>PAST WITHDRAWALS</p>
                {past.slice(0, 10).map(w => (
                  <div key={w.id as string} className="glass" style={{ borderRadius: '16px', padding: '14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ color: 'white', fontSize: '13px', fontWeight: 500, margin: '0 0 2px' }}>{w.driver_name as string}</p>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 }}>{new Date(w.created_at as string).toLocaleDateString()}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: w.status === 'approved' ? '#4ADE80' : '#FCA5A5', fontSize: '14px', fontWeight: 700, margin: '0 0 2px' }}>₦{Number(w.amount).toLocaleString()}</p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: 0, textTransform: 'capitalize' }}>{w.status as string}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      }

      case 'earnings':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', borderRadius: '24px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.1em' }}>CEO WALLET BALANCE</p>
              <p style={{ color: 'white', fontSize: '36px', fontWeight: 800, margin: '0 0 4px' }}>₦{ceoWallet.balance.toLocaleString()}</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: 0 }}>Total Earned: ₦{ceoWallet.total_earned.toLocaleString()}</p>
            </div>

            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 16px' }}>⚙️ Commission Settings</h3>
              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>DRIVER RETENTION RATE: {retentionPct}%</label>
              <input type="range" min={10} max={90} value={retentionPct} onChange={e => setRetentionPct(Number(e.target.value))} style={{ width: '100%', accentColor: '#8B5CF6', marginBottom: '8px' }} />
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: '0 0 16px' }}>Drivers keep {retentionPct}% · RetroBliss takes {100 - retentionPct}%</p>
              <button onClick={handleSaveSettings} className="btn-gradient" style={{ width: '100%', padding: '14px', borderRadius: '16px', fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>
                Save Settings
              </button>
              <button onClick={handleCollectEarnings} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'linear-gradient(135deg, #F59E0B, #EF4444)', border: 'none', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
                💼 Collect Daily Earnings Now
              </button>
            </div>
          </div>
        );

      case 'audit': {
        const filtered = auditLogs.filter(l =>
          !searchQuery || (l.action as string)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (l.performer as string)?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return (
          <div>
            <input className="rb-input" placeholder="🔍 Search audit log..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ marginBottom: '16px' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 12px' }}>{filtered.length} entries</p>
            {filtered.map(log => (
              <button key={log.id as string} onClick={() => { setSelectedItem(log); setDetailView('detail'); }} style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '12px 14px', marginBottom: '8px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                  {log.performer_role === 'admin' ? '👑' : log.performer_role === 'driver' ? '🚗' : '🧑‍💼'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(log.action as string).replace(/_/g, ' ')}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: 0 }}>{log.performer as string} · {new Date(log.created_at as string).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px' }}>›</span>
              </button>
            ))}
          </div>
        );
      }

      case 'controls':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 16px' }}>💰 Pricing</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>BASE FARE (₦)</label>
                  <input className="rb-input" type="number" value={baseFare} onChange={e => setBaseFare(Number(e.target.value))} style={{ fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px', letterSpacing: '0.08em' }}>PER KM RATE (₦)</label>
                  <input className="rb-input" type="number" value={perKmRate} onChange={e => setPerKmRate(Number(e.target.value))} style={{ fontSize: '14px' }} />
                </div>
              </div>
              <div className="glass" style={{ borderRadius: '16px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: 600, margin: 0 }}>Surge Pricing</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '2px 0 0' }}>Enable during peak hours</p>
                </div>
                <button onClick={() => setSurgeEnabled(!surgeEnabled)} style={{ width: '52px', height: '28px', borderRadius: '14px', background: surgeEnabled ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.3s ease' }}>
                  <div style={{ position: 'absolute', top: '2px', left: surgeEnabled ? '26px' : '2px', width: '24px', height: '24px', borderRadius: '50%', background: 'white', transition: 'left 0.3s ease', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 4px' }}>📍 Available Locations</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 16px' }}>Riders can only book rides to/from these locations</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {availableLocations.map(loc => (
                  <div key={loc} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#C4B5FD', fontSize: '12px', fontWeight: 600 }}>📍 {loc}</span>
                    <button onClick={() => handleRemoveLocation(loc)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="rb-input" placeholder="Add new location..." value={newLocationsInput} onChange={e => setNewLocationsInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddLocation()} style={{ flex: 1, fontSize: '13px' }} />
                <button onClick={handleAddLocation} style={{ padding: '0 16px', borderRadius: '16px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: "'Poppins', sans-serif", flexShrink: 0 }}>+</button>
              </div>
            </div>

            <button onClick={handleSaveSettings} className="btn-gradient" style={{ width: '100%', padding: '16px', borderRadius: '20px', fontSize: '15px', fontWeight: 700 }}>
              💾 Save All Platform Settings
            </button>
          </div>
        );

      case 'notifications':
        return (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 16px' }}>{notifications.length} notifications</p>
            {notifications.map(n => (
              <div key={n.id as string} className="glass-card" style={{ padding: '16px', marginBottom: '10px', borderRadius: '18px', border: n.read ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(139,92,246,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'white', fontSize: '13px', fontWeight: n.read ? 500 : 700, margin: '0 0 2px' }}>{n.title as string}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 4px', lineHeight: 1.4 }}>{n.message as string}</p>
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', margin: 0 }}>{new Date(n.created_at as string).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })} · {n.user_role as string}</p>
                  </div>
                  {!n.read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8B5CF6', flexShrink: 0, marginTop: '4px' }} />}
                </div>
                {/* Reply input */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <input className="rb-input" placeholder="Reply to user..." value={replyMsg} onChange={e => setReplyMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReplyNotification(n.id as string, n.user_id as string, n.user_role as string)} style={{ flex: 1, fontSize: '12px', padding: '10px 14px' }} />
                  <button onClick={() => handleReplyNotification(n.id as string, n.user_id as string, n.user_role as string)} style={{ padding: '10px 14px', borderRadius: '12px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Poppins', sans-serif", flexShrink: 0 }}>Send</button>
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif" }}>
      <NotificationSystem userId="ceo" userRole="admin" />

      {/* CEO Header */}
      <div style={{ background: 'rgba(8,6,18,0.95)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '48px 20px 16px', maxWidth: '480px', margin: '0 auto', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ADE80', animation: 'ping-ring 2s ease-in-out infinite' }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 600, margin: 0, letterSpacing: '0.08em' }}>CEO ADMINISTRATIVE PANEL</p>
            </div>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 800, margin: 0 }}>RetroBliss CAS</h2>
          </div>
          <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '8px 14px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontFamily: "'Poppins', sans-serif" }}>
            Sign Out
          </button>
        </div>

        {/* Tab scroll */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setDetailView('list'); setSelectedItem(null); setSearchQuery(''); }} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: '14px', background: activeTab === t.key ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(255,255,255,0.05)', border: activeTab === t.key ? 'none' : '1px solid rgba(255,255,255,0.08)', color: activeTab === t.key ? 'white' : 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '12px', fontWeight: activeTab === t.key ? 700 : 500, fontFamily: "'Poppins', sans-serif", whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease' }}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ padding: '20px 20px 100px', maxWidth: '480px', margin: '0 auto' }}>
        <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 800, margin: '0 0 16px', textTransform: 'capitalize' }}>
          {tabs.find(t => t.key === activeTab)?.icon} {activeTab.replace('-', ' ')}
        </h3>
        {renderTabContent()}
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="glass-strong" style={{ borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '380px', animation: 'scaleIn 0.3s ease' }}>
            <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>⚠️ Decline Application</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 16px' }}>This reason will be sent to the driver. Make it clear and specific.</p>
            <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="e.g. Uploaded ID documents were unclear or expired..." style={{ width: '100%', minHeight: '100px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', color: 'white', fontSize: '14px', padding: '14px', fontFamily: "'Poppins', sans-serif", resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setShowDeclineModal(false)} style={{ flex: 1, padding: '13px', borderRadius: '14px', background: 'rgba(255,255,255,0.07)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontFamily: "'Poppins', sans-serif" }}>Cancel</button>
              <button onClick={handleDeclineDriver} style={{ flex: 2, padding: '13px', borderRadius: '14px', background: 'linear-gradient(135deg, #EF4444, #B91C1C)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>Send Decline</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CEODashboard;
