import React, { useState, useEffect, useRef } from 'react';
import GoogleMapComponent from '@/components/GoogleMap';
import NotificationSystem from '@/components/NotificationSystem';
import ProfileAvatar from '@/components/ProfileAvatar';
import ChatSupport from '@/pages/ChatSupport';
import ContactOfficials from '@/pages/ContactOfficials';
import AboutPage from '@/pages/AboutPage';
import { supabase, generateId, logAuditDB, getClientIP, sendNotification, getPlatformSetting } from '@/lib/supabase';
import type { Driver, Ride, Transaction } from '@/types';
import { toast } from 'sonner';
import { showLocalNotification, startReEngagementNotifications } from '@/lib/pushNotifications';

interface DriverHomeProps {
  driver: Driver | null;
  onLogout: () => void;
  onUpdateDriver: (d: Driver) => void;
}

type SubView = 'home' | 'wallet' | 'history' | 'profile' | 'active-ride' | 'chat' | 'contact' | 'about';

const NIGERIAN_COORDS: Record<string, [number, number]> = {
  'Lagos': [3.3792, 6.5244], 'Abuja': [7.4898, 9.0579],
  'Rivers': [7.0134, 4.8156], 'Kano': [8.5120, 12.0022], 'Oyo': [3.9470, 7.3776],
  'Ikeja': [3.3488, 6.6018], 'Victoria Island': [3.4219, 6.4314],
  'Lekki': [3.5561, 6.4478], 'Surulere': [3.3494, 6.5057],
  'Yaba': [3.3796, 6.5159], 'Ajah': [3.5857, 6.4649],
  'Maitama': [7.5053, 9.0781], 'Wuse II': [7.4697, 9.0722],
  'Garki': [7.4842, 9.0424], 'Asokoro': [7.5234, 9.0429],
};

const DriverHome: React.FC<DriverHomeProps> = ({ driver, onLogout, onUpdateDriver }) => {
  const [subView, setSubView] = useState<SubView>('home');
  const [isOnline, setIsOnline] = useState(false);
  const [walletBalance, setWalletBalance] = useState(driver?.walletBalance || 0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingRide, setPendingRide] = useState<Ride | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [retentionPct, setRetentionPct] = useState(50);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; read: boolean; created_at: string }[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [rideSearching, setRideSearching] = useState(false);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [totalRides, setTotalRides] = useState(0);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const gpsWatchRef = useRef<number | null>(null);

  const driverCoords: [number, number] = driverLocation || NIGERIAN_COORDS[driver?.state || 'Lagos'] || [3.3792, 6.5244];

  useEffect(() => {
    if (!driver) return;
    fetchBalance();
    fetchTransactions();
    fetchNotifications();
    checkActiveRide();
    fetchDriverStats();

    // Register SW + request notification permission
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    startReEngagementNotifications();

    const retentionVal = async () => {
      const v = await getPlatformSetting('driver_retention_percentage');
      if (typeof v === 'number') setRetentionPct(v);
      else if (typeof v === 'string') setRetentionPct(parseInt(v) || 50);
    };
    retentionVal();

    const balancePoll = setInterval(fetchBalance, 12000);

    // Real GPS tracking
    if (navigator.geolocation) {
      gpsWatchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setDriverLocation([longitude, latitude]);
          if (isOnline && driver) {
            await supabase.from('rb_drivers').update({
              latitude, longitude,
            }).eq('id', driver.id);
          }
        },
        (err) => console.log('GPS error:', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
      );
    }

    const rideChannel = supabase
      .channel(`driver-rides-${driver.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rb_rides', filter: `status=eq.searching` }, (payload) => {
        const ride = payload.new as Record<string, unknown>;
        if (isOnline && !pendingRide && !activeRide) {
          setPendingRide(mapRideRow(ride));
          showLocalNotification('🚨 New Ride Request!', `${ride.pickup} → ${ride.destination} · ₦${Number(ride.fare).toLocaleString()}`);
          toast.info('🚨 New ride request!', { description: `${ride.pickup} → ${ride.destination}` });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rb_rides', filter: `driver_id=eq.${driver.id}` }, (payload) => {
        const ride = payload.new as Record<string, unknown>;
        if (ride.status === 'completed') {
          setActiveRide(null);
          setSubView('home');
          fetchBalance();
          fetchTransactions();
          toast.success('Ride completed! Payment received. 💰');
        } else if (ride.status === 'cancelled') {
          setActiveRide(null);
          setPendingRide(null);
          setSubView('home');
          toast.info('Ride was cancelled by rider.');
        }
      })
      .subscribe();

    const notifChannel = supabase
      .channel(`driver-notifs-${driver.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rb_notifications', filter: `user_id=eq.${driver.id}` }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      clearInterval(balancePoll);
      if (gpsWatchRef.current !== null) navigator.geolocation.clearWatch(gpsWatchRef.current);
      supabase.removeChannel(rideChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [driver?.id, isOnline]);

  const mapRideRow = (row: Record<string, unknown>): Ride => ({
    id: row.id as string,
    riderId: row.rider_id as string,
    riderName: row.rider_name as string,
    driverId: row.driver_id as string | null,
    driverName: row.driver_name as string | null,
    pickup: row.pickup as string,
    destination: row.destination as string,
    pickupLat: row.pickup_lat as number,
    pickupLng: row.pickup_lng as number,
    destLat: row.dest_lat as number,
    destLng: row.dest_lng as number,
    fare: row.fare as number,
    status: row.status as string,
    rideType: row.ride_type as string,
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | null,
    riderPaid: row.rider_paid as number,
    driverReceived: row.driver_received as number,
    commissionAmount: row.commission_amount as number,
  });

  const fetchBalance = async () => {
    if (!driver) return;
    const { data } = await supabase.from('rb_drivers').select('wallet_balance').eq('id', driver.id).single();
    if (data) {
      setWalletBalance(data.wallet_balance);
      onUpdateDriver({ ...driver, walletBalance: data.wallet_balance });
    }
  };

  const fetchTransactions = async () => {
    if (!driver) return;
    const { data } = await supabase.from('rb_transactions').select('*').eq('user_id', driver.id).order('created_at', { ascending: false }).limit(50);
    if (data) setTransactions(data as Transaction[]);
  };

  const fetchNotifications = async () => {
    if (!driver) return;
    const { data } = await supabase.from('rb_notifications').select('*').eq('user_id', driver.id).order('created_at', { ascending: false }).limit(20);
    if (data) {
      setNotifications(data);
      setNotifCount(data.filter((n: Record<string, unknown>) => !n.read).length);
    }
  };

  const fetchDriverStats = async () => {
    if (!driver) return;
    const { data: ratingData } = await supabase.from('rb_ratings').select('rating').eq('driver_id', driver.id);
    if (ratingData && ratingData.length > 0) {
      const avg = ratingData.reduce((s: number, r: Record<string, unknown>) => s + Number(r.rating), 0) / ratingData.length;
      setAvgRating(Math.round(avg * 10) / 10);
    }
    const { count } = await supabase.from('rb_rides').select('id', { count: 'exact', head: true }).eq('driver_id', driver.id).eq('status', 'completed');
    setTotalRides(count || 0);
  };

  const checkActiveRide = async () => {
    if (!driver) return;
    const { data } = await supabase.from('rb_rides').select('*').eq('driver_id', driver.id).in('status', ['active']).order('created_at', { ascending: false }).limit(1);
    if (data && data.length > 0) {
      setActiveRide(mapRideRow(data[0]));
      setSubView('active-ride');
    }
  };

  const toggleOnline = async () => {
    if (!driver) return;
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    await supabase.from('rb_drivers').update({ is_online: newStatus }).eq('id', driver.id);
    toast.info(newStatus ? '🟢 You are now online — accepting rides!' : '⭕ You are now offline.');
  };

  const handleAcceptRide = async () => {
    if (!pendingRide || !driver) return;
    setRideSearching(true);
    const { error } = await supabase.from('rb_rides').update({
      driver_id: driver.id,
      driver_name: driver.fullName,
      status: 'active',
    }).eq('id', pendingRide.id).eq('status', 'searching');

    if (error) {
      toast.error('Ride already taken. Waiting for next request.');
      setPendingRide(null);
      setRideSearching(false);
      return;
    }

    await sendNotification(pendingRide.riderId, 'rider', 'Driver Found! 🎉',
      `${driver.fullName} accepted your ride. ${driver.vehicleMake} ${driver.vehicleModel} · ${driver.vehiclePlate}`,
      pendingRide.id
    );

    setActiveRide({ ...pendingRide, driverId: driver.id, driverName: driver.fullName, status: 'active' });
    setPendingRide(null);
    setSubView('active-ride');
    setRideSearching(false);

    const ip = await getClientIP();
    await logAuditDB(driver.username, 'driver', 'ride_accept', pendingRide.id, {
      rider: pendingRide.riderName, pickup: pendingRide.pickup, destination: pendingRide.destination
    }, ip, driver.state || 'Nigeria');
  };

  const handleRejectRide = () => {
    setPendingRide(null);
    toast.info('Ride request rejected.');
  };

  const handleCompleteRide = async () => {
    if (!activeRide || !driver) return;
    const fare = activeRide.fare || 0;
    const retentionFraction = retentionPct / 100;
    const driverEarns = fare * retentionFraction;
    const ceoShare = fare - driverEarns;

    // Deduct from rider wallet
    const { data: riderData } = await supabase.from('rb_riders').select('wallet_balance').eq('id', activeRide.riderId).single();
    if (riderData) {
      await supabase.from('rb_riders').update({ wallet_balance: Math.max(0, riderData.wallet_balance - fare) }).eq('id', activeRide.riderId);
    }

    // Credit driver
    const newDriverBalance = walletBalance + driverEarns;
    await supabase.from('rb_drivers').update({ wallet_balance: newDriverBalance }).eq('id', driver.id);

    // CEO wallet
    const { data: ceoWallet } = await supabase.from('rb_ceo_wallet').select('*').eq('id', 1).single();
    if (ceoWallet) {
      await supabase.from('rb_ceo_wallet').update({
        balance: ceoWallet.balance + ceoShare,
        total_earned: ceoWallet.total_earned + ceoShare,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
    }

    // Mark completed
    await supabase.from('rb_rides').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      rider_paid: fare,
      driver_received: driverEarns,
      commission_amount: ceoShare,
    }).eq('id', activeRide.id);

    // Transactions
    await supabase.from('rb_transactions').insert([
      { id: generateId(), user_id: driver.id, user_role: 'driver', type: 'credit', amount: driverEarns, description: `Ride: ${activeRide.pickup} → ${activeRide.destination}`, reference: activeRide.id, created_at: new Date().toISOString() },
      { id: generateId(), user_id: activeRide.riderId, user_role: 'rider', type: 'debit', amount: fare, description: `Ride: ${activeRide.pickup} → ${activeRide.destination}`, reference: activeRide.id, created_at: new Date().toISOString() },
    ]);

    await sendNotification(activeRide.riderId, 'rider', 'Ride Completed ✅',
      `You've arrived at ${activeRide.destination}. ₦${fare.toLocaleString()} charged. Rate your driver!`,
      activeRide.id
    );

    setWalletBalance(newDriverBalance);
    setActiveRide(null);
    setSubView('home');
    toast.success(`Ride completed! You earned ₦${driverEarns.toLocaleString()} 💰`);
    fetchTransactions();
    fetchDriverStats();
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!driver) return;
    if (isNaN(amount) || amount < 500) { toast.error('Minimum withdrawal is ₦500.'); return; }
    const maxWithdraw = walletBalance * (retentionPct / 100);
    if (amount > maxWithdraw) {
      toast.error(`You can only withdraw up to ₦${maxWithdraw.toLocaleString()} (${retentionPct}% of balance).`);
      return;
    }
    await supabase.from('rb_withdrawals').insert({
      id: generateId(),
      driver_id: driver.id, driver_name: driver.fullName,
      amount,
      bank_name: driver.bankName,
      bank_account: driver.bankAccount,
      bank_account_name: driver.bankAccountName,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    toast.success('Withdrawal request submitted! CEO will approve shortly.');
    setWithdrawAmount('');
  };

  const markNotifRead = async (id: string) => {
    await supabase.from('rb_notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setNotifCount(prev => Math.max(0, prev - 1));
  };

  if (!driver) return null;

  // ── CHAT SUPPORT ──
  if (subView === 'chat') {
    return <ChatSupport userId={driver.id} userRole="driver" userName={driver.fullName} onBack={() => setSubView('home')} />;
  }

  // ── CONTACT OFFICIALS ──
  if (subView === 'contact') {
    return <ContactOfficials onBack={() => setSubView('home')} />;
  }

  // ── ABOUT ──
  if (subView === 'about') {
    return <AboutPage onBack={() => setSubView('home')} />;
  }

  // ── ACTIVE RIDE VIEW ──
  if (subView === 'active-ride' && activeRide) {
    const pickupC = NIGERIAN_COORDS[activeRide.pickup] || [3.3792, 6.5244] as [number, number];
    const destC = NIGERIAN_COORDS[activeRide.destination] || [3.4219, 6.4314] as [number, number];

    return (
      <div style={{ minHeight: '100vh', background: '#080612', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif" }}>
        <NotificationSystem userId={driver.id} userRole="driver" />
        <div style={{ position: 'relative', flex: 1 }}>
          <GoogleMapComponent
            height="100%"
            center={{ lat: (driverLocation || pickupC)[1], lng: (driverLocation || pickupC)[0] }}
            zoom={13}
            activeRideRoute={{ pickup: pickupC, destination: destC, driver: driverLocation || undefined }}
            mode="driver"
            containerStyle={{ height: 'calc(100vh - 250px)', borderRadius: '0' }}
          />
          <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10 }}>
            <div className="glass-strong" style={{ borderRadius: '20px', padding: '14px 18px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.08em' }}>GPS NAVIGATION — ACTIVE RIDE</p>
              <p style={{ color: 'white', fontSize: '14px', fontWeight: 700, margin: '0 0 2px' }}>{activeRide.pickup} → {activeRide.destination}</p>
              <p style={{ color: '#4ADE80', fontSize: '13px', margin: 0 }}>Rider: {activeRide.riderName} · Fare: ₦{(activeRide.fare || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="glass-dark" style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            <div className="glass" style={{ flex: 1, borderRadius: '16px', padding: '12px', textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 2px' }}>Rider</p>
              <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, margin: 0 }}>{activeRide.riderName}</p>
            </div>
            <div className="glass" style={{ flex: 1, borderRadius: '16px', padding: '12px', textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 2px' }}>You Earn</p>
              <p style={{ color: '#4ADE80', fontSize: '14px', fontWeight: 700, margin: 0 }}>₦{((activeRide.fare || 0) * retentionPct / 100).toLocaleString()}</p>
            </div>
            <div className="glass" style={{ flex: 1, borderRadius: '16px', padding: '12px', textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 2px' }}>GPS</p>
              <p style={{ color: driverLocation ? '#4ADE80' : '#FCA5A5', fontSize: '13px', fontWeight: 600, margin: 0 }}>{driverLocation ? '🟢 Live' : '⭕ Off'}</p>
            </div>
          </div>
          <button onClick={handleCompleteRide} style={{ width: '100%', padding: '16px', borderRadius: '18px', background: 'linear-gradient(135deg, #22C55E, #16A34A)', border: 'none', color: 'white', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", boxShadow: '0 6px 20px rgba(34,197,94,0.4)' }}>
            ✅ Complete Ride & Collect Fare
          </button>
        </div>
      </div>
    );
  }

  // ── PROFILE ──
  if (subView === 'profile') {
    return (
      <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif", overflowY: 'auto' }}>
        <NotificationSystem userId={driver.id} userRole="driver" />
        <div style={{ padding: '52px 24px 80px', maxWidth: '440px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
            <button onClick={() => setSubView('home')} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: 0 }}>Driver Profile</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
            <ProfileAvatar name={driver.fullName} profilePic={driver.profilePic} size={88} />
            <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: '14px 0 4px' }}>{driver.fullName}</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 8px' }}>@{driver.username}</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              {avgRating > 0 && (
                <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px', padding: '4px 14px' }}>
                  <span style={{ color: '#FCD34D', fontSize: '13px', fontWeight: 700 }}>⭐ {avgRating.toFixed(1)} Rating</span>
                </div>
              )}
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '20px', padding: '4px 14px' }}>
                <span style={{ color: '#4ADE80', fontSize: '13px', fontWeight: 700 }}>{totalRides} Rides</span>
              </div>
            </div>
          </div>
          <div className="glass-card" style={{ padding: '20px', marginBottom: '16px', borderRadius: '24px' }}>
            {[
              { label: 'Vehicle', value: `${driver.vehicleYear} ${driver.vehicleMake} ${driver.vehicleModel}`, icon: '🚗' },
              { label: 'Plate', value: driver.vehiclePlate, icon: '🪪' },
              { label: 'Color', value: driver.vehicleColor, icon: '🎨' },
              { label: 'Bank', value: `${driver.bankName}`, icon: '🏦' },
              { label: 'Account', value: driver.bankAccount, icon: '💳' },
              { label: 'Phone', value: driver.phone, icon: '📱' },
              { label: 'Location', value: `${driver.location}, ${driver.state}`, icon: '📍' },
              { label: 'GPS', value: driverLocation ? `${driverLocation[1].toFixed(4)}, ${driverLocation[0].toFixed(4)}` : 'Not tracking', icon: '🛰️' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.icon} {item.label}</span>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: 500, maxWidth: '55%', textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </div>
          <button onClick={onLogout} style={{ width: '100%', padding: '16px', borderRadius: '18px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
            🚪 Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ── WALLET ──
  if (subView === 'wallet') {
    const maxWithdraw = walletBalance * (retentionPct / 100);
    return (
      <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif", overflowY: 'auto' }}>
        <NotificationSystem userId={driver.id} userRole="driver" />
        <div style={{ padding: '52px 24px 80px', maxWidth: '440px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
            <button onClick={() => setSubView('home')} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: 0 }}>Driver Wallet</h2>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', borderRadius: '28px', padding: '28px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 600, margin: '0 0 6px', letterSpacing: '0.06em' }}>DRIVER WALLET</p>
            <p style={{ color: 'white', fontSize: '38px', fontWeight: 800, margin: '0 0 4px' }}>₦{walletBalance.toLocaleString()}</p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', margin: 0 }}>Withdrawable: ₦{maxWithdraw.toLocaleString()} ({retentionPct}%)</p>
          </div>
          <div className="glass-card" style={{ padding: '20px', marginBottom: '16px', borderRadius: '24px' }}>
            <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 6px' }}>💸 Withdraw to Bank</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 14px' }}>{driver.bankName} · {driver.bankAccount} · {driver.bankAccountName}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
              {[500, 1000, 2000, 5000].filter(a => a <= maxWithdraw).map(a => (
                <button key={a} onClick={() => setWithdrawAmount(String(a))} style={{ padding: '11px 6px', borderRadius: '12px', background: withdrawAmount === String(a) ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : 'rgba(255,255,255,0.06)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                  ₦{a.toLocaleString()}
                </button>
              ))}
            </div>
            <input className="rb-input" type="number" placeholder={`Max ₦${maxWithdraw.toLocaleString()}`} value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} style={{ marginBottom: '12px' }} />
            <button onClick={handleWithdraw} style={{ width: '100%', padding: '15px', borderRadius: '16px', background: 'linear-gradient(135deg, #F59E0B, #EF4444)', border: 'none', color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
              💸 Request Withdrawal
            </button>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>Paid within minutes · CEO approval required</p>
          </div>
          <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 12px' }}>Recent Earnings</h3>
          {transactions.slice(0, 8).map(tx => (
            <div key={tx.id} className="glass" style={{ borderRadius: '16px', padding: '14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: 'white', fontSize: '13px', fontWeight: 500, margin: 0 }}>{tx.description}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '2px 0 0' }}>{new Date(tx.created_at).toLocaleDateString()}</p>
              </div>
              <p style={{ color: tx.type === 'credit' ? '#4ADE80' : '#FCA5A5', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── HISTORY ──
  if (subView === 'history') {
    return (
      <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif", overflowY: 'auto' }}>
        <NotificationSystem userId={driver.id} userRole="driver" />
        <div style={{ padding: '52px 24px 80px', maxWidth: '440px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
            <button onClick={() => setSubView('home')} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: 0 }}>Trip History</h2>
          </div>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ fontSize: '48px', margin: '0 0 12px' }}>🚗</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No trips yet. Go online to start!</p>
            </div>
          ) : transactions.map(tx => (
            <div key={tx.id} className="glass-card" style={{ padding: '14px 18px', borderRadius: '18px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '14px', background: tx.type === 'credit' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                  {tx.type === 'credit' ? '💰' : '💸'}
                </div>
                <div>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, margin: 0 }}>{tx.description}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '2px 0 0' }}>{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <p style={{ color: tx.type === 'credit' ? '#4ADE80' : '#FCA5A5', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── MAIN HOME ──
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a18', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif", position: 'relative' }}>
      <NotificationSystem userId={driver.id} userRole="driver" />

      {/* Side Menu */}
      {sideMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
          <div onClick={() => setSideMenuOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', width: '72%', maxWidth: '300px', height: '100%', background: 'rgba(10,6,24,0.97)', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', padding: '56px 0 24px', animation: 'slideInLeft 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ padding: '0 24px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <ProfileAvatar name={driver.fullName} profilePic={driver.profilePic} size={52} />
              <div>
                <p style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: 0 }}>{driver.fullName}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '2px 0 0' }}>@{driver.username} · Driver</p>
              </div>
            </div>
            <div style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
              {[
                { icon: '👤', label: 'Profile', action: () => { setSideMenuOpen(false); setSubView('profile'); } },
                { icon: '💬', label: 'RetroBliss Chat Support', action: () => { setSideMenuOpen(false); setSubView('chat'); } },
                { icon: '📞', label: 'Contact Officials', action: () => { setSideMenuOpen(false); setSubView('contact'); } },
                { icon: 'ℹ️', label: 'About RetroBliss', action: () => { setSideMenuOpen(false); setSubView('about'); } },
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}>
                  <span style={{ fontSize: '20px', width: '28px', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontWeight: 500 }}>{item.label}</span>
                </button>
              ))}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', marginBottom: '8px' }}>
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '14px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Wallet Balance</span>
                <span style={{ color: '#FCD34D', fontWeight: 700, fontSize: '14px' }}>₦{walletBalance.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => { setSideMenuOpen(false); onLogout(); }} style={{ margin: '0 24px', padding: '14px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              🚚 Log Out
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: '48px 20px 16px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <button onClick={() => setSideMenuOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[22, 16, 22].map((w, i) => (<div key={i} style={{ width: `${w}px`, height: '2px', background: 'rgba(255,255,255,0.6)', borderRadius: '1px' }} />))}
            </button>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 2px' }}>Driver Dashboard 🚗</p>
            <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 800, margin: 0 }}>{driver.fullName.split(' ')[0]}</h2>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={() => setShowNotifs(!showNotifs)} style={{ position: 'relative', background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notifCount > 0 && <div style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', borderRadius: '50%', background: '#EC4899' }} />}
            </button>
            <button onClick={() => setSubView('profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <ProfileAvatar name={driver.fullName} profilePic={driver.profilePic} size={44} />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {showNotifs && (
          <div className="glass-strong" style={{ borderRadius: '20px', padding: '14px', marginBottom: '16px', maxHeight: '250px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', textAlign: 'center', padding: '12px', margin: 0 }}>No notifications</p>
            ) : notifications.map(n => (
              <div key={n.id} onClick={() => markNotifRead(n.id)} style={{ padding: '10px 12px', borderRadius: '12px', marginBottom: '6px', background: n.read ? 'transparent' : 'rgba(245,158,11,0.08)', border: n.read ? 'none' : '1px solid rgba(245,158,11,0.2)', cursor: 'pointer' }}>
                <p style={{ color: 'white', fontSize: '13px', fontWeight: n.read ? 400 : 600, margin: '0 0 2px' }}>{n.title}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>{n.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <div className="glass" style={{ flex: 1, borderRadius: '18px', padding: '14px', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 4px' }}>Rating</p>
            <p style={{ color: '#FCD34D', fontSize: '18px', fontWeight: 800, margin: 0 }}>{avgRating > 0 ? `⭐ ${avgRating.toFixed(1)}` : 'New'}</p>
          </div>
          <div className="glass" style={{ flex: 1, borderRadius: '18px', padding: '14px', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 4px' }}>Rides</p>
            <p style={{ color: 'white', fontSize: '18px', fontWeight: 800, margin: 0 }}>{totalRides}</p>
          </div>
          <div className="glass" style={{ flex: 1, borderRadius: '18px', padding: '14px', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 4px' }}>Wallet</p>
            <p style={{ color: '#4ADE80', fontSize: '15px', fontWeight: 800, margin: 0 }}>₦{walletBalance.toLocaleString()}</p>
          </div>
        </div>

        {/* Online toggle */}
        <button onClick={toggleOnline} style={{
          width: '100%', padding: '18px', borderRadius: '22px',
          background: isOnline ? 'linear-gradient(135deg, #22C55E, #16A34A)' : 'rgba(255,255,255,0.07)',
          border: isOnline ? 'none' : '1.5px solid rgba(255,255,255,0.12)',
          color: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: 700,
          fontFamily: "'Poppins', sans-serif",
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          boxShadow: isOnline ? '0 8px 28px rgba(34,197,94,0.45)' : 'none',
          transition: 'all 0.3s ease', marginBottom: '16px'
        }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: isOnline ? 'white' : 'rgba(255,255,255,0.3)', boxShadow: isOnline ? '0 0 8px white' : 'none' }} />
          {isOnline ? '🟢 Online — Accepting Rides' : '⭕ Go Online'}
        </button>

        {/* Pending ride request */}
        {pendingRide && isOnline && (
          <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(236,72,153,0.12))', border: '1.5px solid rgba(139,92,246,0.4)', borderRadius: '24px', padding: '20px', marginBottom: '16px', animation: 'scaleIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ color: 'white', fontSize: '16px', fontWeight: 800, margin: 0 }}>🚨 New Ride Request!</h3>
              <div style={{ background: 'rgba(139,92,246,0.2)', borderRadius: '12px', padding: '4px 12px' }}>
                <span style={{ color: '#C4B5FD', fontSize: '14px', fontWeight: 800 }}>₦{(pendingRide.fare || 0).toLocaleString()}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div className="glass" style={{ borderRadius: '14px', padding: '10px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.08em' }}>PICKUP</p>
                <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, margin: 0 }}>{pendingRide.pickup}</p>
              </div>
              <div className="glass" style={{ borderRadius: '14px', padding: '10px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.08em' }}>DESTINATION</p>
                <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, margin: 0 }}>{pendingRide.destination}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleRejectRide} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                ✕ Reject
              </button>
              <button onClick={handleAcceptRide} disabled={rideSearching} style={{ flex: 2, padding: '14px', borderRadius: '16px', background: 'linear-gradient(135deg, #22C55E, #16A34A)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {rideSearching ? '⏳ Accepting...' : '✓ Accept Ride'}
              </button>
            </div>
          </div>
        )}

        {/* Map */}
        <GoogleMapComponent
          height={260}
          center={{ lat: driverCoords[1], lng: driverCoords[0] }}
          zoom={12}
          mode="driver"
          markers={driverLocation ? [{ id: 'my-location', lat: driverLocation[1], lng: driverLocation[0], label: 'You', color: '#22C55E' }] : []}
          containerStyle={{ borderRadius: '24px', marginBottom: '16px' }}
        />

        {/* Vehicle info */}
        <div className="glass-card" style={{ padding: '16px 18px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: 'linear-gradient(135deg, #F59E0B, #EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🚗</div>
          <div style={{ flex: 1 }}>
            <p style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: 0 }}>{driver.vehicleMake} {driver.vehicleModel}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '2px 0 0' }}>{driver.vehiclePlate} · {driver.vehicleColor} · {driver.vehicleYear}</p>
          </div>
          <div style={{ background: driverLocation ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '6px 10px' }}>
            <p style={{ color: driverLocation ? '#4ADE80' : 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700, margin: 0 }}>{driverLocation ? '🛰️ GPS' : '📍 No GPS'}</p>
          </div>
        </div>
      </div>

      {/* Bottom nav - same style as rider */}
      <div style={{ padding: '12px 20px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', maxWidth: '480px', margin: '0 auto', width: '100%', marginTop: 'auto' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            { icon: '🏠', label: 'Home', view: 'home' as SubView },
            { icon: '💰', label: 'Wallet', view: 'wallet' as SubView },
            { icon: '📋', label: 'History', view: 'history' as SubView },
            { icon: '👤', label: 'Profile', view: 'profile' as SubView },
          ].map(item => (
            <button key={item.view} onClick={() => setSubView(item.view)} style={{
              flex: 1, padding: '14px 6px', borderRadius: '18px',
              background: subView === item.view ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
              border: subView === item.view ? '1.5px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s ease', fontFamily: "'Poppins', sans-serif",
            }}>
              <span style={{ fontSize: '22px' }}>{item.icon}</span>
              <span style={{ color: subView === item.view ? '#FCD34D' : 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: subView === item.view ? 700 : 500 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DriverHome;
