import React, { useState, useEffect, useRef } from 'react';
import MapboxMap from '@/components/MapboxMap';
import NotificationSystem from '@/components/NotificationSystem';
import ProfileAvatar from '@/components/ProfileAvatar';
import { supabase, generateId, logAuditDB, getClientIP, sendNotification, getPlatformSetting } from '@/lib/supabase';
import type { Rider, Ride, Transaction } from '@/types';
import { toast } from 'sonner';

interface RiderHomeProps {
  rider: Rider | null;
  onLogout: () => void;
  onUpdateRider: (r: Rider) => void;
}

type Tab = 'ride' | 'schedule' | 'share';
type SubView = 'home' | 'wallet' | 'history' | 'profile' | 'matching' | 'active-ride' | 'rating';

interface DriverMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
}

const NIGERIAN_COORDS: Record<string, [number, number]> = {
  'Lagos': [3.3792, 6.5244], 'Abuja': [7.4898, 9.0579],
  'Rivers': [7.0134, 4.8156], 'Kano': [8.5120, 12.0022], 'Oyo': [3.9470, 7.3776],
  'Ikeja': [3.3488, 6.6018], 'Victoria Island': [3.4219, 6.4314],
  'Lekki': [3.5561, 6.4478], 'Surulere': [3.3494, 6.5057],
  'Yaba': [3.3796, 6.5159], 'Ajah': [3.5857, 6.4649],
  'Maitama': [7.5053, 9.0781], 'Wuse II': [7.4697, 9.0722],
  'Garki': [7.4842, 9.0424], 'Asokoro': [7.5234, 9.0429],
};

const RiderHome: React.FC<RiderHomeProps> = ({ rider, onLogout, onUpdateRider }) => {
  const [tab, setTab] = useState<Tab>('ride');
  const [subView, setSubView] = useState<SubView>('home');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [shareLocation, setShareLocation] = useState('');
  const [walletBalance, setWalletBalance] = useState(rider?.walletBalance || 0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [completedRideForRating, setCompletedRideForRating] = useState<Ride | null>(null);
  const [matchedDriver, setMatchedDriver] = useState<{
    id: string; name: string; rating: number; vehicle: string; plate: string; eta: string; profilePic?: string;
  } | null>(null);
  const [onlineDrivers, setOnlineDrivers] = useState<DriverMarker[]>([]);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; read: boolean; created_at: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeField, setActiveField] = useState<'pickup' | 'destination' | 'share' | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [starRating, setStarRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [driverLocation, setDriverLocation] = useState<[number, number] | undefined>(undefined);

  useEffect(() => {
    if (!rider) return;
    fetchBalance();
    fetchTransactions();
    fetchOnlineDrivers();
    fetchAvailableLocations();
    fetchNotifications();
    checkActiveRide();
    checkScheduledRideReminders();

    const driverPoll = setInterval(fetchOnlineDrivers, 10000);
    const balancePoll = setInterval(fetchBalance, 15000);
    const reminderPoll = setInterval(checkScheduledRideReminders, 60000);

    const rideChannel = supabase
      .channel(`rider-rides-${rider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rb_rides', filter: `rider_id=eq.${rider.id}` }, (payload) => {
        const ride = payload.new as Record<string, unknown>;
        if (ride.status === 'active' && ride.driver_id) {
          const mappedRide = mapRideRow(ride);
          setActiveRide(mappedRide);
          setSubView('active-ride');
          fetchMatchedDriver(ride.driver_id as string);
        } else if (ride.status === 'completed') {
          const mappedRide = mapRideRow(ride);
          setCompletedRideForRating(mappedRide);
          setActiveRide(null);
          setMatchedDriver(null);
          setSubView('rating');
          fetchBalance();
          fetchTransactions();
        } else if (ride.status === 'cancelled') {
          setActiveRide(null);
          setMatchedDriver(null);
          setSubView('home');
          toast.info('Ride was cancelled.');
        }
      })
      .subscribe();

    // Real-time driver location for active ride
    const driverLocChannel = supabase
      .channel(`driver-loc-${rider.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rb_drivers' }, (payload) => {
        const d = payload.new as Record<string, unknown>;
        if (matchedDriver && d.id === matchedDriver.id) {
          setDriverLocation([d.longitude as number, d.latitude as number]);
        }
      })
      .subscribe();

    const notifChannel = supabase
      .channel(`rider-notifs-${rider.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rb_notifications', filter: `user_id=eq.${rider.id}` }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      clearInterval(driverPoll);
      clearInterval(balancePoll);
      clearInterval(reminderPoll);
      supabase.removeChannel(rideChannel);
      supabase.removeChannel(driverLocChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [rider?.id]);

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
    if (!rider) return;
    const { data } = await supabase.from('rb_riders').select('wallet_balance').eq('id', rider.id).single();
    if (data) {
      setWalletBalance(data.wallet_balance);
      onUpdateRider({ ...rider, walletBalance: data.wallet_balance });
    }
  };

  const fetchTransactions = async () => {
    if (!rider) return;
    const { data } = await supabase.from('rb_transactions').select('*').eq('user_id', rider.id).order('created_at', { ascending: false }).limit(50);
    if (data) setTransactions(data as Transaction[]);
  };

  const fetchOnlineDrivers = async () => {
    const { data } = await supabase.from('rb_drivers').select('id,full_name,latitude,longitude,vehicle_make,vehicle_model').eq('status', 'active').eq('is_online', true);
    if (data) {
      setOnlineDrivers(data.map((d: Record<string, unknown>) => ({
        id: d.id as string,
        lat: (d.latitude as number) || 6.5244 + (Math.random() - 0.5) * 0.08,
        lng: (d.longitude as number) || 3.3792 + (Math.random() - 0.5) * 0.08,
        label: `${d.full_name} · ${d.vehicle_make} ${d.vehicle_model}`,
        color: '#8B5CF6',
      })));
    }
  };

  const fetchAvailableLocations = async () => {
    const locs = await getPlatformSetting('available_locations');
    if (Array.isArray(locs)) setAvailableLocations(locs);
    else setAvailableLocations(['Ikeja', 'Victoria Island', 'Lekki', 'Surulere', 'Yaba', 'Ajah', 'Maitama', 'Wuse II', 'Garki', 'Asokoro']);
  };

  const fetchNotifications = async () => {
    if (!rider) return;
    const { data } = await supabase.from('rb_notifications').select('*').eq('user_id', rider.id).order('created_at', { ascending: false }).limit(20);
    if (data) {
      setNotifications(data);
      setNotifCount(data.filter((n: Record<string, unknown>) => !n.read).length);
    }
  };

  const checkActiveRide = async () => {
    if (!rider) return;
    const { data } = await supabase.from('rb_rides').select('*').eq('rider_id', rider.id).in('status', ['searching', 'active']).order('created_at', { ascending: false }).limit(1);
    if (data && data.length > 0) {
      const ride = mapRideRow(data[0]);
      setActiveRide(ride);
      if (ride.status === 'active' && ride.driverId) {
        setSubView('active-ride');
        fetchMatchedDriver(ride.driverId);
      } else if (ride.status === 'searching') {
        setSubView('matching');
      }
    }
  };

  const checkScheduledRideReminders = async () => {
    if (!rider) return;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60000);
    const { data } = await supabase.from('rb_scheduled_rides')
      .select('*')
      .eq('rider_id', rider.id)
      .eq('status', 'pending')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', in30.toISOString());
    if (data && data.length > 0) {
      data.forEach((r: Record<string, unknown>) => {
        const time = new Date(r.scheduled_at as string).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
        toast.info(`⏰ Reminder: Your ride to ${r.destination} is at ${time}!`);
      });
    }
  };

  const fetchMatchedDriver = async (driverId: string) => {
    const { data } = await supabase.from('rb_drivers').select('*').eq('id', driverId).single();
    if (data) {
      const { data: ratingData } = await supabase.from('rb_ratings').select('rating').eq('driver_id', driverId);
      const avgRating = ratingData && ratingData.length > 0
        ? ratingData.reduce((s: number, r: Record<string, unknown>) => s + Number(r.rating), 0) / ratingData.length
        : 4.7 + Math.random() * 0.25;
      setMatchedDriver({
        id: data.id,
        name: data.full_name,
        rating: Math.round(avgRating * 10) / 10,
        vehicle: `${data.vehicle_make} ${data.vehicle_model}`,
        plate: data.vehicle_plate,
        eta: `${Math.floor(Math.random() * 5) + 2} mins away`,
        profilePic: data.profile_pic,
      });
      if (data.latitude && data.longitude) {
        setDriverLocation([data.longitude, data.latitude]);
      }
    }
  };

  const handleLocationInput = (value: string, field: 'pickup' | 'destination' | 'share') => {
    if (field === 'pickup') setPickup(value);
    if (field === 'destination') setDestination(value);
    if (field === 'share') setShareLocation(value);
    setActiveField(field);
    if (value.length >= 0) {
      const filtered = availableLocations.filter(l => l.toLowerCase().includes(value.toLowerCase()));
      setLocationSuggestions(filtered.length > 0 ? filtered : availableLocations);
    }
  };

  const validateLocation = (loc: string): boolean => {
    return availableLocations.some(l => l.toLowerCase() === loc.toLowerCase() || l.toLowerCase().includes(loc.toLowerCase()) || loc.toLowerCase().includes(l.toLowerCase()));
  };

  const handleRequestRide = async () => {
    if (!rider) return;
    if (!pickup.trim() || !destination.trim()) { toast.error('Please enter pickup and destination.'); return; }
    if (!validateLocation(pickup)) {
      toast.error(`"${pickup}" is unavailable. Try: ${availableLocations.slice(0, 3).join(', ')}`);
      return;
    }
    if (!validateLocation(destination)) {
      toast.error(`"${destination}" is unavailable. Try: ${availableLocations.slice(0, 3).join(', ')}`);
      return;
    }
    if (pickup.toLowerCase() === destination.toLowerCase()) {
      toast.error('Pickup and destination cannot be the same!');
      return;
    }

    const fare = 800 + Math.floor(Math.random() * 1500);
    if (walletBalance < fare) {
      toast.error(`Low wallet balance. Estimated fare: ₦${fare.toLocaleString()}. Top up your wallet.`);
      return;
    }

    setSearching(true);
    const rideId = generateId();
    const pickupCoords = NIGERIAN_COORDS[availableLocations.find(l => l.toLowerCase().includes(pickup.toLowerCase()) || pickup.toLowerCase().includes(l.toLowerCase())) || pickup] || [3.3792, 6.5244] as [number, number];
    const destCoords = NIGERIAN_COORDS[availableLocations.find(l => l.toLowerCase().includes(destination.toLowerCase()) || destination.toLowerCase().includes(l.toLowerCase())) || destination] || [3.4219, 6.4314] as [number, number];

    if (tab === 'schedule') {
      if (!scheduleDate || !scheduleTime) { toast.error('Please set a date and time for your scheduled ride.'); setSearching(false); return; }
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
      if (scheduledAt <= new Date()) { toast.error('Scheduled time must be in the future.'); setSearching(false); return; }

      await supabase.from('rb_scheduled_rides').insert({
        id: rideId, rider_id: rider.id, rider_name: rider.fullName,
        pickup, destination, scheduled_at: scheduledAt.toISOString(),
        fare, status: 'pending', ride_type: 'schedule',
        created_at: new Date().toISOString(),
      });

      await sendNotification(rider.id, 'rider', '📅 Ride Scheduled!',
        `Your ride from ${pickup} to ${destination} is booked for ${scheduledAt.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}.`
      );
      toast.success('Ride scheduled! You\'ll get a reminder 30 minutes before.');
      setSearching(false);
      setPickup('');
      setDestination('');
      return;
    }

    const rideRow = {
      id: rideId, rider_id: rider.id, rider_name: rider.fullName,
      driver_id: null, driver_name: null,
      pickup, destination, fare,
      pickup_lat: pickupCoords[1], pickup_lng: pickupCoords[0],
      dest_lat: destCoords[1], dest_lng: destCoords[0],
      status: 'searching', ride_type: tab,
      created_at: new Date().toISOString(),
      rider_paid: 0, driver_received: 0, commission_amount: 0,
    };

    await supabase.from('rb_rides').insert(rideRow);
    const ip = await getClientIP();
    await logAuditDB(rider.username, 'rider', 'ride_request', rideId, { pickup, destination, fare }, ip, rider.state || 'Nigeria');

    setActiveRide(mapRideRow({ ...rideRow, rider_id: rider.id, driver_id: null, driver_name: null, dest_lat: destCoords[1], dest_lng: destCoords[0], rider_paid: 0, driver_received: 0, commission_amount: 0 }));
    setSubView('matching');
    setSearching(false);
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    await supabase.from('rb_rides').update({ status: 'cancelled' }).eq('id', activeRide.id);
    setActiveRide(null);
    setMatchedDriver(null);
    setDriverLocation(undefined);
    setSubView('home');
    toast.info('Ride cancelled.');
  };

  const handleSOS = async () => {
    if (!rider || !activeRide) return;
    const ip = await getClientIP();
    await sendNotification('ceo', 'admin', '🚨 SOS EMERGENCY!',
      `URGENT: Rider ${rider.fullName} triggered SOS! Ride: ${activeRide.id}. Driver: ${activeRide.driverName || 'Unknown'}. Location: ${activeRide.pickup} → ${activeRide.destination}. IP: ${ip}`
    );
    await logAuditDB(rider.username, 'rider', 'sos_triggered', activeRide.id, {
      rider: rider.fullName, driver: activeRide.driverName, ride: activeRide.id, pickup: activeRide.pickup, destination: activeRide.destination
    }, ip, rider.state || 'Nigeria');
    toast.error('🚨 SOS Alert Sent! Help is on the way.', { duration: 8000 });
  };

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 100) { toast.error('Minimum top-up is ₦100.'); return; }
    if (!rider) return;
    const newBalance = walletBalance + amount;
    await supabase.from('rb_riders').update({ wallet_balance: newBalance }).eq('id', rider.id);
    await supabase.from('rb_transactions').insert({
      id: generateId(), user_id: rider.id, user_role: 'rider',
      type: 'credit', amount, description: 'Wallet top-up via bank transfer',
      reference: `TOP${Date.now()}`, created_at: new Date().toISOString(),
    });
    setWalletBalance(newBalance);
    setTopUpAmount('');
    toast.success(`₦${amount.toLocaleString()} added to wallet!`);
    fetchTransactions();
  };

  const handleSubmitRating = async () => {
    if (!rider || !completedRideForRating || starRating === 0) {
      toast.error('Please select a star rating.');
      return;
    }
    await supabase.from('rb_ratings').insert({
      id: generateId(),
      ride_id: completedRideForRating.id,
      rider_id: rider.id,
      driver_id: completedRideForRating.driverId,
      rating: starRating,
      comment: ratingComment,
      created_at: new Date().toISOString(),
    });
    toast.success('Thanks for your rating! ⭐');
    setCompletedRideForRating(null);
    setStarRating(0);
    setRatingComment('');
    setSubView('home');
    fetchBalance();
    fetchTransactions();
  };

  const markNotifRead = async (id: string) => {
    await supabase.from('rb_notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setNotifCount(prev => Math.max(0, prev - 1));
  };

  if (!rider) return null;

  const mapCenter: [number, number] = NIGERIAN_COORDS[rider.state] || [3.3792, 6.5244];

  // ── RATING SCREEN ──
  if (subView === 'rating' && completedRideForRating) {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #1e0a3c 0%, #0d0618 45%, #080612 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', fontFamily: "'Poppins', sans-serif" }}>
        <NotificationSystem userId={rider.id} userRole="rider" />
        <div style={{ width: '100%', maxWidth: '380px', animation: 'scaleIn 0.5s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '64px', marginBottom: '12px' }}>🎉</div>
            <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 800, margin: '0 0 8px' }}>Ride Complete!</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
              {completedRideForRating.pickup} → {completedRideForRating.destination}
            </p>
            <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.1))', borderRadius: '16px', padding: '12px 20px', marginTop: '12px', display: 'inline-block' }}>
              <p style={{ color: '#C4B5FD', fontSize: '20px', fontWeight: 800, margin: 0 }}>₦{(completedRideForRating.fare || 0).toLocaleString()}</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '2px 0 0' }}>charged from wallet</p>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px', marginBottom: '20px', borderRadius: '24px' }}>
            <p style={{ color: 'white', fontSize: '16px', fontWeight: 700, textAlign: 'center', margin: '0 0 20px' }}>Rate your driver</p>
            {matchedDriver && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '16px' }}>
                <ProfileAvatar name={matchedDriver.name} profilePic={matchedDriver.profilePic} size={44} />
                <div>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: 600, margin: 0 }}>{matchedDriver.name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '2px 0 0' }}>{matchedDriver.vehicle}</p>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setStarRating(star)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '36px', transition: 'transform 0.15s ease', transform: star <= starRating ? 'scale(1.2)' : 'scale(1)', filter: star <= starRating ? 'drop-shadow(0 0 8px rgba(245,158,11,0.8))' : 'grayscale(1) opacity(0.3)' }}>
                  ⭐
                </button>
              ))}
            </div>
            <textarea
              placeholder="Leave a comment (optional)..."
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
              style={{ width: '100%', minHeight: '80px', background: 'rgba(255,255,255,0.055)', border: '1.5px solid rgba(255,255,255,0.09)', borderRadius: '16px', color: 'white', fontSize: '14px', padding: '12px 16px', fontFamily: "'Poppins', sans-serif", resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <button onClick={handleSubmitRating} className="btn-gradient" style={{ width: '100%', padding: '18px', borderRadius: '20px', fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            ⭐ Submit Rating
          </button>
          <button onClick={() => { setCompletedRideForRating(null); setSubView('home'); }} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>
            Skip
          </button>
        </div>
      </div>
    );
  }

  // ── PROFILE ──
  if (subView === 'profile') {
    return (
      <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif", overflowY: 'auto' }}>
        <NotificationSystem userId={rider.id} userRole="rider" />
        <div style={{ padding: '52px 24px 80px', maxWidth: '440px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
            <button onClick={() => setSubView('home')} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: 0 }}>My Profile</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
            <ProfileAvatar name={rider.fullName} profilePic={rider.profilePic} size={88} />
            <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: '14px 0 4px' }}>{rider.fullName}</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>@{rider.username}</p>
          </div>
          <div className="glass-card" style={{ padding: '20px', marginBottom: '16px', borderRadius: '24px' }}>
            {[
              { label: 'Email', value: rider.email, icon: '📧' },
              { label: 'Phone', value: rider.phone, icon: '📱' },
              { label: 'Location', value: rider.location, icon: '📍' },
              { label: 'State', value: rider.state, icon: '🗺️' },
              { label: 'Country', value: 'Nigeria 🇳🇬', icon: '' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
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

  // ── HISTORY ──
  if (subView === 'history') {
    return (
      <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif", overflowY: 'auto' }}>
        <NotificationSystem userId={rider.id} userRole="rider" />
        <div style={{ padding: '52px 24px 80px', maxWidth: '440px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
            <button onClick={() => setSubView('home')} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: 0 }}>Transaction History</h2>
          </div>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ fontSize: '48px', margin: '0 0 12px' }}>💳</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No transactions yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {transactions.map(tx => (
                <div key={tx.id} className="glass-card" style={{ padding: '16px 18px', borderRadius: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '14px', background: tx.type === 'credit' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                        {tx.type === 'credit' ? '⬇️' : '⬆️'}
                      </div>
                      <div>
                        <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, margin: 0 }}>{tx.description}</p>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '2px 0 0' }}>{new Date(tx.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <p style={{ color: tx.type === 'credit' ? '#4ADE80' : '#FCA5A5', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                      {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── WALLET ──
  if (subView === 'wallet') {
    return (
      <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif", overflowY: 'auto' }}>
        <NotificationSystem userId={rider.id} userRole="rider" />
        <div style={{ padding: '52px 24px 80px', maxWidth: '440px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
            <button onClick={() => setSubView('home')} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: 0 }}>My Wallet</h2>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)', borderRadius: '28px', padding: '28px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 600, margin: '0 0 8px', letterSpacing: '0.06em' }}>WALLET BALANCE</p>
            <p style={{ color: 'white', fontSize: '38px', fontWeight: 800, margin: '0 0 4px' }}>₦{walletBalance.toLocaleString()}</p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: 0 }}>Non-withdrawable · Used for rides only</p>
          </div>
          <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderRadius: '24px' }}>
            <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>💰 Top Up Wallet</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {[500, 1000, 2000, 5000, 10000, 20000].map(amt => (
                <button key={amt} onClick={() => setTopUpAmount(String(amt))} style={{ padding: '11px 6px', borderRadius: '14px', background: topUpAmount === String(amt) ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(255,255,255,0.06)', border: `1px solid ${topUpAmount === String(amt) ? 'transparent' : 'rgba(255,255,255,0.08)'}`, color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                  ₦{amt.toLocaleString()}
                </button>
              ))}
            </div>
            <input className="rb-input" type="number" placeholder="Or enter custom amount..." value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} style={{ marginBottom: '12px' }} />
            <button onClick={handleTopUp} className="btn-gradient" style={{ width: '100%', padding: '15px', borderRadius: '16px', fontSize: '15px', fontWeight: 700 }}>
              💳 Top Up via Bank Transfer
            </button>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>Powered by Paystack · Instant credit</p>
          </div>
          <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 12px' }}>Recent</h3>
          {transactions.slice(0, 5).map(tx => (
            <div key={tx.id} className="glass" style={{ borderRadius: '16px', padding: '14px 16px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: 'white', fontSize: '13px', fontWeight: 500, margin: 0 }}>{tx.description}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '2px 0 0' }}>{new Date(tx.created_at).toLocaleDateString()}</p>
              </div>
              <p style={{ color: tx.type === 'credit' ? '#4ADE80' : '#FCA5A5', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
              </p>
            </div>
          ))}
          <button onClick={() => setSubView('history')} style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: '14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '13px', fontFamily: "'Poppins', sans-serif" }}>
            View All Transactions →
          </button>
        </div>
      </div>
    );
  }

  // ── MATCHING SCREEN ──
  if (subView === 'matching') {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #1e0a3c 0%, #0d0618 60%, #080612 100%)', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif" }}>
        <NotificationSystem userId={rider.id} userRole="rider" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          {matchedDriver ? (
            <div style={{ width: '100%', maxWidth: '380px', animation: 'scaleIn 0.5s ease' }}>
              {/* Car illustration */}
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ color: 'white', fontSize: '28px', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.2 }}>Finding you<br />a driver...</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 20px' }}>Sit tight! We're finding the best driver for you.</p>
                {/* Car SVG illustration */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <svg width="180" height="80" viewBox="0 0 180 80" fill="none">
                    <defs>
                      <linearGradient id="carGrad" x1="0" y1="0" x2="180" y2="0" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#8B5CF6" /><stop offset="0.5" stopColor="#A855F7" /><stop offset="1" stopColor="#EC4899" />
                      </linearGradient>
                    </defs>
                    <rect x="10" y="38" width="160" height="30" rx="12" fill="url(#carGrad)" />
                    <path d="M35 38 Q42 14 65 12 L118 12 Q140 12 148 38Z" fill="url(#carGrad)" opacity="0.9" />
                    <path d="M42 38 Q48 18 65 16 L115 16 Q133 16 140 38Z" fill="#0d0618" opacity="0.55" />
                    <circle cx="45" cy="68" r="12" fill="#1a0a2e" stroke="#8B5CF6" strokeWidth="3" />
                    <circle cx="45" cy="68" r="5" fill="rgba(139,92,246,0.6)" />
                    <circle cx="132" cy="68" r="12" fill="#1a0a2e" stroke="#EC4899" strokeWidth="3" />
                    <circle cx="132" cy="68" r="5" fill="rgba(236,72,153,0.6)" />
                    <ellipse cx="170" cy="46" rx="8" ry="5" fill="#FCD34D" opacity="0.9" />
                    <ellipse cx="170" cy="46" rx="14" ry="8" fill="rgba(252,211,77,0.12)" />
                    <rect x="8" y="43" width="8" height="10" rx="3" fill="#EF4444" opacity="0.8" />
                  </svg>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderRadius: '24px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(255,255,255,0.15)' }}>
                    {matchedDriver.profilePic ? (
                      <img src={matchedDriver.profilePic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Driver" />
                    ) : (
                      <ProfileAvatar name={matchedDriver.name} size={60} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>{matchedDriver.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <span style={{ color: '#F59E0B', fontSize: '16px' }}>⭐</span>
                      <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>{matchedDriver.rating.toFixed(1)}</span>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 4px' }}>{matchedDriver.vehicle} · {matchedDriver.plate}</p>
                    <div style={{ background: 'rgba(139,92,246,0.12)', borderRadius: '10px', padding: '4px 10px', display: 'inline-block' }}>
                      <span style={{ color: '#C4B5FD', fontSize: '12px', fontWeight: 700 }}>{matchedDriver.eta}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleCancelRide} style={{ flex: 1, padding: '16px', borderRadius: '18px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                  Cancel Ride
                </button>
                <button style={{ flex: 2, padding: '16px', borderRadius: '18px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}
                  onClick={() => { if (navigator.share) navigator.share({ title: 'My RetroBliss Ride', text: `I'm riding with ${matchedDriver.name} (${matchedDriver.plate})` }); else toast.success('Trip info copied!'); }}>
                  Share Trip
                </button>
              </div>
            </div>
          ) : (
            // Searching state
            <div style={{ textAlign: 'center', width: '100%', maxWidth: '360px', animation: 'fadeInUp 0.5s ease' }}>
              <h2 style={{ color: 'white', fontSize: '32px', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.2 }}>Finding you<br />a driver...</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 28px' }}>Sit tight! We're finding the best driver for you.</p>
              {/* Car illustration */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
                <div style={{ position: 'relative' }}>
                  <svg width="180" height="80" viewBox="0 0 180 80" fill="none" style={{ filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.5))' }}>
                    <defs>
                      <linearGradient id="carGrad2" x1="0" y1="0" x2="180" y2="0" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#8B5CF6" /><stop offset="1" stopColor="#EC4899" />
                      </linearGradient>
                    </defs>
                    <rect x="10" y="38" width="160" height="30" rx="12" fill="url(#carGrad2)" />
                    <path d="M35 38 Q42 14 65 12 L118 12 Q140 12 148 38Z" fill="url(#carGrad2)" opacity="0.9" />
                    <path d="M42 38 Q48 18 65 16 L115 16 Q133 16 140 38Z" fill="#0d0618" opacity="0.6" />
                    <circle cx="45" cy="68" r="12" fill="#1a0a2e" stroke="#8B5CF6" strokeWidth="3" />
                    <circle cx="45" cy="68" r="5" fill="rgba(139,92,246,0.7)" />
                    <circle cx="132" cy="68" r="12" fill="#1a0a2e" stroke="#EC4899" strokeWidth="3" />
                    <circle cx="132" cy="68" r="5" fill="rgba(236,72,153,0.7)" />
                    <ellipse cx="170" cy="46" rx="8" ry="5" fill="#FCD34D" opacity="0.95" />
                    <rect x="8" y="43" width="8" height="10" rx="3" fill="#EF4444" opacity="0.8" />
                  </svg>
                  {/* Ping rings */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80px', height: '80px', borderRadius: '50%', border: '2px solid rgba(139,92,246,0.4)', animation: 'ping-ring 1.5s ease-in-out infinite', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120px', height: '120px', borderRadius: '50%', border: '1px solid rgba(139,92,246,0.2)', animation: 'ping-ring 1.5s ease-in-out infinite 0.5s', pointerEvents: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8B5CF6', animation: `float 0.8s ease-in-out ${i * 0.25}s infinite alternate` }} />
                ))}
              </div>
              <button onClick={handleCancelRide} style={{ padding: '15px 40px', borderRadius: '20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
                Cancel Search
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ACTIVE RIDE ──
  if (subView === 'active-ride' && activeRide) {
    const pickupC = NIGERIAN_COORDS[activeRide.pickup] || [3.3792, 6.5244] as [number, number];
    const destC = NIGERIAN_COORDS[activeRide.destination] || [3.4219, 6.4314] as [number, number];

    return (
      <div style={{ minHeight: '100vh', background: '#080612', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif" }}>
        <NotificationSystem userId={rider.id} userRole="rider" />
        <div style={{ position: 'relative', flex: 1 }}>
          <MapboxMap
            height="100%"
            center={pickupC}
            zoom={13}
            activeRideRoute={{ pickup: pickupC, destination: destC, driver: driverLocation }}
            mode="rider"
            containerStyle={{ height: 'calc(100vh - 230px)', borderRadius: '0' }}
          />
          <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10 }}>
            <div className="glass-strong" style={{ borderRadius: '20px', padding: '14px 18px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.08em' }}>ACTIVE RIDE</p>
              <p style={{ color: 'white', fontSize: '14px', fontWeight: 700, margin: '0 0 2px' }}>{activeRide.pickup} → {activeRide.destination}</p>
              <p style={{ color: '#C4B5FD', fontSize: '13px', margin: 0 }}>Fare: ₦{(activeRide.fare || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="glass-dark" style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {matchedDriver && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <ProfileAvatar name={matchedDriver.name} profilePic={matchedDriver.profilePic} size={48} />
              <div style={{ flex: 1 }}>
                <p style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: 0 }}>{matchedDriver.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '2px 0 0' }}>⭐ {matchedDriver.rating.toFixed(1)} · {matchedDriver.vehicle} · {matchedDriver.plate}</p>
              </div>
              <div style={{ background: 'rgba(139,92,246,0.15)', borderRadius: '12px', padding: '6px 12px' }}>
                <p style={{ color: '#C4B5FD', fontSize: '12px', fontWeight: 700, margin: 0 }}>{matchedDriver.eta}</p>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSOS} style={{ flex: 0, padding: '14px 18px', borderRadius: '16px', background: 'linear-gradient(135deg, #EF4444, #B91C1C)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 800, fontFamily: "'Poppins', sans-serif", boxShadow: '0 4px 16px rgba(239,68,68,0.5)' }}>
              🆘 SOS
            </button>
            <button onClick={handleCancelRide} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>
              Cancel Ride
            </button>
            <button style={{ flex: 2, padding: '14px', borderRadius: '16px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}
              onClick={() => { if (navigator.share) navigator.share({ title: 'RetroBliss Ride', text: `Riding with ${matchedDriver?.name} (${matchedDriver?.plate})` }); else toast.success('Link copied!'); }}>
              📍 Share Trip
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN HOME VIEW (matches the attached image exactly) ──
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a18', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif" }}>
      <NotificationSystem userId={rider.id} userRole="rider" />

      {/* Status bar area */}
      <div style={{ padding: '44px 20px 0', maxWidth: '480px', margin: '0 auto', width: '100%' }}>

        {/* Top header - matches image */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            {/* Hamburger */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ width: i === 2 ? '16px' : '22px', height: '2px', background: 'rgba(255,255,255,0.6)', borderRadius: '1px' }} />
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: '0 0 2px', fontWeight: 400 }}>Welcome,</p>
            <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>{rider.fullName.split(' ')[0]}! 👋</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Wallet */}
            <button onClick={() => setSubView('wallet')} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '14px', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px' }}>💰</span>
              <span style={{ color: '#C4B5FD', fontSize: '13px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>₦{walletBalance.toLocaleString()}</span>
            </button>
            {/* Notification bell - matches image style */}
            <button onClick={() => setShowNotifs(!showNotifs)} style={{ position: 'relative', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notifCount > 0 && (
                <div style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
              )}
            </button>
            {/* Profile pic */}
            <button onClick={() => setSubView('profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <ProfileAvatar name={rider.fullName} profilePic={rider.profilePic} size={44} />
            </button>
          </div>
        </div>

        {/* Notification dropdown */}
        {showNotifs && (
          <div className="glass-strong" style={{ borderRadius: '20px', padding: '14px', marginBottom: '16px', maxHeight: '260px', overflowY: 'auto' }}>
            <p style={{ color: 'white', fontSize: '13px', fontWeight: 700, margin: '0 0 10px' }}>Notifications</p>
            {notifications.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', textAlign: 'center', padding: '14px 0', margin: 0 }}>No notifications yet</p>
            ) : notifications.map(n => (
              <div key={n.id} onClick={() => markNotifRead(n.id)} style={{ padding: '10px 12px', borderRadius: '14px', marginBottom: '6px', background: n.read ? 'transparent' : 'rgba(139,92,246,0.08)', border: n.read ? 'none' : '1px solid rgba(139,92,246,0.2)', cursor: 'pointer' }}>
                <p style={{ color: 'white', fontSize: '12px', fontWeight: n.read ? 400 : 600, margin: '0 0 2px' }}>{n.title}</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', margin: 0 }}>{n.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Location inputs card - exact match to image */}
        <div style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '22px',
          padding: '14px 16px',
          marginBottom: '14px',
          position: 'relative',
          zIndex: 20,
        }}>
          {/* Pickup row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#8B5CF6', flexShrink: 0, boxShadow: '0 0 8px rgba(139,92,246,0.6)' }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 600, margin: '0 0 2px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pickup location</p>
              <input
                className="rb-input"
                placeholder="Allen Avenue, Ikeja, Lagos"
                value={pickup}
                onChange={e => handleLocationInput(e.target.value, 'pickup')}
                onFocus={() => { setActiveField('pickup'); setLocationSuggestions(availableLocations); }}
                onBlur={() => setTimeout(() => setActiveField(null), 200)}
                style={{ background: 'transparent', border: 'none', padding: '0', fontSize: '14px', fontWeight: 500, boxShadow: 'none', height: 'auto', color: 'white' }}
              />
            </div>
          </div>

          {/* Destination row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '12px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#EC4899', flexShrink: 0, boxShadow: '0 0 8px rgba(236,72,153,0.6)' }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 600, margin: '0 0 2px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Where to?</p>
              <input
                className="rb-input"
                placeholder="Add drop-off location"
                value={tab === 'share' ? shareLocation : destination}
                onChange={e => handleLocationInput(e.target.value, tab === 'share' ? 'share' : 'destination')}
                onFocus={() => { setActiveField(tab === 'share' ? 'share' : 'destination'); setLocationSuggestions(availableLocations); }}
                onBlur={() => setTimeout(() => setActiveField(null), 200)}
                style={{ background: 'transparent', border: 'none', padding: '0', fontSize: '14px', fontWeight: 500, boxShadow: 'none', height: 'auto', color: 'white' }}
              />
            </div>
            <button style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
          </div>

          {/* Location suggestions */}
          {activeField && locationSuggestions.length > 0 && (
            <div className="glass-strong" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', borderRadius: '18px', padding: '10px', zIndex: 50, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', margin: '4px 8px 8px', textTransform: 'uppercase' }}>Available Locations</p>
              {locationSuggestions.map(loc => (
                <button key={loc} onMouseDown={() => {
                  if (activeField === 'pickup') setPickup(loc);
                  else if (activeField === 'destination') setDestination(loc);
                  else setShareLocation(loc);
                  setActiveField(null);
                  setLocationSuggestions([]);
                }} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'white', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.1)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}>
                  <span style={{ color: '#EC4899' }}>📍</span> {loc}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Schedule inputs */}
        {tab === 'schedule' && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            <input type="date" className="rb-input" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={{ flex: 1, fontSize: '13px', colorScheme: 'dark' }} />
            <input type="time" className="rb-input" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={{ flex: 1, fontSize: '13px', colorScheme: 'dark' }} />
          </div>
        )}
      </div>

      {/* MAP - full width, no padding on sides */}
      <div style={{ flex: 1, padding: '0 20px', maxWidth: '480px', margin: '0 auto', width: '100%', minHeight: '240px' }}>
        <MapboxMap
          height={240}
          center={mapCenter}
          zoom={11}
          markers={onlineDrivers}
          mode="rider"
          containerStyle={{ borderRadius: '20px', width: '100%' }}
        />
        {/* Location crosshair button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-44px', marginRight: '12px', position: 'relative', zIndex: 5 }}>
          <button style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a18" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><line x1="12" y1="2" x2="12" y2="7" /><line x1="12" y1="17" x2="12" y2="22" /><line x1="2" y1="12" x2="7" y2="12" /><line x1="17" y1="12" x2="22" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Request Ride button - prominent, matches image */}
      <div style={{ padding: '16px 20px 8px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
        <button
          onClick={handleRequestRide}
          disabled={searching}
          style={{
            width: '100%',
            padding: '20px',
            borderRadius: '60px',
            background: searching ? 'rgba(139,92,246,0.5)' : 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
            border: 'none',
            color: 'white',
            fontSize: '18px',
            fontWeight: 700,
            fontFamily: "'Poppins', sans-serif",
            cursor: searching ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: searching ? 'none' : '0 8px 32px rgba(139,92,246,0.55)',
            transition: 'all 0.22s ease',
          }}
        >
          {searching ? (
            <><div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} /> Finding Drivers...</>
          ) : tab === 'schedule' ? '📅 Schedule Ride' : tab === 'share' ? '👥 Find Ride Share' : 'Request Ride'}
        </button>
      </div>

      {/* Bottom navigation - exact match to image */}
      <div style={{ padding: '8px 20px 16px', maxWidth: '480px', margin: '0 auto', width: '100%', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
          {([
            { key: 'ride' as Tab, icon: '🛵', label: 'Ride Now' },
            { key: 'schedule' as Tab, icon: '⏰', label: 'Schedule' },
            { key: 'share' as Tab, icon: '👥', label: 'Ride Share' },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1,
              padding: '14px 6px',
              borderRadius: '18px',
              background: tab === t.key ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)',
              border: tab === t.key ? '1.5px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              fontFamily: "'Poppins', sans-serif",
            }}>
              <span style={{ fontSize: '22px' }}>{t.icon}</span>
              <span style={{ color: tab === t.key ? '#C4B5FD' : 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: tab === t.key ? 700 : 500 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RiderHome;
