
import React, { useState, useEffect, useRef } from 'react';
import MapboxMap from '@/components/MapboxMap';
import NotificationSystem from '@/components/NotificationSystem';
import ProfileAvatar from '@/components/ProfileAvatar';
import ChatSupport from '@/pages/ChatSupport';
import ContactOfficials from '@/pages/ContactOfficials';
import AboutPage from '@/pages/AboutPage';
import { supabase, generateId, logAuditDB, getClientIP, sendNotification, getPlatformSetting } from '@/lib/supabase';
import { searchLocations, getLocationCoords, getLocationsForStates, ALL_NIGERIAN_STATES } from '@/lib/nigerianLocations';
import type { Rider, Ride, Transaction } from '@/types';
import { toast } from 'sonner';
import { showLocalNotification, startReEngagementNotifications } from '@/lib/pushNotifications';

interface RiderHomeProps {
  rider: Rider | null;
  onLogout: () => void;
  onUpdateRider: (r: Rider) => void;
}

type Tab = 'ride' | 'schedule' | 'share';
type SubView = 'home' | 'wallet' | 'history' | 'profile' | 'matching' | 'active-ride' | 'rating' | 'chat' | 'contact' | 'about' | 'profile-edit';

interface DriverMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
}

const NIGERIAN_COORDS: Record<string, [number, number]> = {
  'Lagos': [3.3792, 6.5244], 'Abuja': [7.4898, 9.0579], 'FCT': [7.4898, 9.0579],
  'Rivers': [7.0134, 4.8156], 'Kano': [8.5120, 12.0022], 'Oyo': [3.9470, 7.3776],
  'Ikeja': [3.3488, 6.6018], 'Victoria Island': [3.4219, 6.4314],
  'Lekki': [3.5561, 6.4478], 'Surulere': [3.3494, 6.5057],
  'Yaba': [3.3796, 6.5159], 'Ajah': [3.5857, 6.4649],
  'Maitama': [7.5053, 9.0781], 'Wuse II': [7.4697, 9.0722],
  'Garki': [7.4842, 9.0424], 'Asokoro': [7.5234, 9.0429],
  'Port Harcourt': [7.0134, 4.8156], 'Ibadan': [3.9470, 7.3776],
  'Benin City': [5.6037, 6.3350], 'Abeokuta': [3.3450, 7.1551],
};

const MAPBOX_TOKEN = 'pk.eyJ1IjoicGVhY2U1NDMiLCJhIjoiY21vaHMwYzI2MDc3NjJycXZhdzFsb2ZyeiJ9.9nX4dOizNfUbny-D06iOBQ';

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
  const [matchedDriver, setMatchedDriver] = useState<{ id: string; name: string; rating: number; vehicle: string; plate: string; eta: string; profilePic?: string } | null>(null);
  const [onlineDrivers, setOnlineDrivers] = useState<DriverMarker[]>([]);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [activeStates, setActiveStates] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; read: boolean; created_at: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchCountdown, setSearchCountdown] = useState(0);
  const [activeField, setActiveField] = useState<'pickup' | 'destination' | 'share' | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<{ name: string; state: string; type: string }[]>([]);
  const [starRating, setStarRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [driverLocation, setDriverLocation] = useState<[number, number] | undefined>(undefined);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>([3.3792, 6.5244]);
  const [mapZoom, setMapZoom] = useState(11);
  const [pendingRides, setPendingRides] = useState<Ride[]>([]);
  const [showPendingList, setShowPendingList] = useState(false);
  const [scheduledRides, setScheduledRides] = useState<Record<string, unknown>[]>([]);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!rider) return;
    fetchBalance();
    fetchTransactions();
    fetchOnlineDrivers();
    fetchActiveStates();
    fetchNotifications();
    checkActiveRide();
    checkScheduledRideReminders();
    fetchScheduledRides();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Start re-engagement notifications
    startReEngagementNotifications();

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
          const driverName = ride.driver_name as string || 'Your driver';
          showLocalNotification('🚗 Driver Found!', `${driverName} has accepted your ride. Please wait at your pickup location.`);
          sendNotification(rider.id, 'rider', '🚗 Driver Found!', `${driverName} accepted your ride. They're on their way!`);
        } else if (ride.status === 'completed') {
          const mappedRide = mapRideRow(ride);
          setCompletedRideForRating(mappedRide);
          setActiveRide(null);
          setMatchedDriver(null);
          setSubView('rating');
          fetchBalance();
          fetchTransactions();
          showLocalNotification('✅ Ride Complete!', `You've arrived safely. Rate your driver!`);
        } else if (ride.status === 'cancelled') {
          setActiveRide(null);
          setMatchedDriver(null);
          setSubView('home');
          toast.info('Ride was cancelled.');
        }
      })
      .subscribe();

    const driverLocChannel = supabase.channel(`driver-loc-${rider.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rb_drivers' }, (payload) => {
        const d = payload.new as Record<string, unknown>;
        if (matchedDriver && d.id === matchedDriver.id) {
          setDriverLocation([d.longitude as number, d.latitude as number]);
        }
      })
      .subscribe();

    const notifChannel = supabase.channel(`rider-notifs-${rider.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rb_notifications', filter: `user_id=eq.${rider.id}` }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      clearInterval(driverPoll);
      clearInterval(balancePoll);
      clearInterval(reminderPoll);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
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
        lat: (d.latitude as number) || 6.5244,
        lng: (d.longitude as number) || 3.3792,
        label: `${d.full_name} · ${d.vehicle_make} ${d.vehicle_model}`,
        color: '#8B5CF6',
      })));
    }
  };

  const fetchActiveStates = async () => {
    const locs = await getPlatformSetting('available_states');
    if (Array.isArray(locs) && locs.length > 0) {
      setActiveStates(locs);
    } else {
      // Fallback to available_locations for backward compatibility
      const oldLocs = await getPlatformSetting('available_locations');
      if (Array.isArray(oldLocs) && oldLocs.length > 0) {
        setActiveStates(oldLocs);
      }
    }
  };

  const fetchScheduledRides = async () => {
    if (!rider) return;
    const { data } = await supabase.from('rb_scheduled_rides').select('*').eq('rider_id', rider.id).order('scheduled_at');
    if (data) setScheduledRides(data);
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
        startDriverSearchTimer(ride);
      }
    }
  };

  const checkScheduledRideReminders = async () => {
    if (!rider) return;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60000);
    const { data } = await supabase.from('rb_scheduled_rides')
      .select('*').eq('rider_id', rider.id).eq('status', 'pending')
      .gte('scheduled_at', now.toISOString()).lte('scheduled_at', in30.toISOString());
    if (data && data.length > 0) {
      data.forEach((r: Record<string, unknown>) => {
        const time = new Date(r.scheduled_at as string).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
        showLocalNotification(`⏰ Ride Reminder`, `Your ride to ${r.destination} is scheduled at ${time}!`);
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
        id: data.id, name: data.full_name,
        rating: Math.round(avgRating * 10) / 10,
        vehicle: `${data.vehicle_make} ${data.vehicle_model}`,
        plate: data.vehicle_plate,
        eta: `${Math.floor(Math.random() * 5) + 2} mins away`,
        profilePic: data.profile_pic,
      });
      if (data.latitude && data.longitude) setDriverLocation([data.longitude, data.latitude]);
    }
  };

  const handleLocationInput = (value: string, field: 'pickup' | 'destination' | 'share') => {
    if (field === 'pickup') setPickup(value);
    if (field === 'destination') setDestination(value);
    if (field === 'share') setShareLocation(value);
    setActiveField(field);
    const results = searchLocations(value, activeStates);
    setLocationSuggestions(results.map(l => ({ name: l.name, state: l.state, type: l.type })));
  };

  const validateLocation = (loc: string): boolean => {
    const available = getLocationsForStates(activeStates);
    return available.some(l =>
      l.name.toLowerCase() === loc.toLowerCase() ||
      l.name.toLowerCase().includes(loc.toLowerCase()) ||
      loc.toLowerCase().includes(l.name.toLowerCase())
    );
  };

  const getAvailableStatesMsg = () => {
    if (activeStates.length === 0) return 'all states';
    return activeStates.join(', ');
  };

  // Map search using Mapbox Geocoding
  const handleMapSearch = async () => {
    if (!mapSearchQuery.trim()) return;
    try {
      const q = encodeURIComponent(mapSearchQuery + ', Nigeria');
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${MAPBOX_TOKEN}&country=NG&limit=1`);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        setMapCenter([lng, lat]);
        setMapZoom(14);
        toast.success(`Found: ${data.features[0].place_name}`);
      } else {
        toast.error('Place not found. Try a different search term.');
      }
    } catch {
      toast.error('Search failed. Check your connection.');
    }
  };

  // 10-second driver search logic
  const startDriverSearchTimer = (ride: Ride) => {
    let countdown = 10;
    setSearchCountdown(countdown);
    const interval = setInterval(() => {
      countdown -= 1;
      setSearchCountdown(countdown);
      if (countdown <= 0) {
        clearInterval(interval);
        // After 10 seconds, broadcast to ALL drivers
        broadcastToAllDrivers(ride);
      }
    }, 1000);
    searchTimerRef.current = setTimeout(() => clearInterval(interval), 12000);
  };

  const broadcastToAllDrivers = async (ride: Ride) => {
    // Get all active (approved) drivers
    const { data: allDrivers } = await supabase.from('rb_drivers').select('id,full_name,latitude,longitude').eq('status', 'active');
    if (!allDrivers || allDrivers.length === 0) {
      setShowPendingList(true);
      return;
    }

    // Sort by proximity if we have location
    const sortedDrivers = allDrivers.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const aLat = Number(a.latitude) || 6.5244;
      const aLng = Number(a.longitude) || 3.3792;
      const bLat = Number(b.latitude) || 6.5244;
      const bLng = Number(b.longitude) || 3.3792;
      const pickupLat = ride.pickupLat || 6.5244;
      const pickupLng = ride.pickupLng || 3.3792;
      const aDist = Math.sqrt(Math.pow(aLat - pickupLat, 2) + Math.pow(aLng - pickupLng, 2));
      const bDist = Math.sqrt(Math.pow(bLat - pickupLat, 2) + Math.pow(bLng - pickupLng, 2));
      return aDist - bDist;
    });

    // Send notification to all drivers
    for (const driver of sortedDrivers) {
      const distKm = Math.random() * 5 + 0.5;
      const nearbyMsg = distKm < 2 ? `You're ${distKm.toFixed(1)}km away — NEARBY! ` : '';
      await sendNotification(
        driver.id as string, 'driver',
        `🚨 New Ride Request ${nearbyMsg}`,
        `${ride.pickup} → ${ride.destination} · ₦${ride.fare?.toLocaleString()}. ${nearbyMsg}Accept now!`,
        ride.id
      );
    }

    toast.info('Request sent to all drivers! Waiting for acceptance...');
    setPendingRides(prev => [...prev, ride]);
    setShowPendingList(false);
  };

  const handleRequestRide = async () => {
    if (!rider) return;
    const pickupVal = pickup.trim();
    const destVal = (tab === 'share' ? shareLocation : destination).trim();

    if (!pickupVal || !destVal) { toast.error('Please enter pickup and destination.'); return; }

    if (activeStates.length > 0) {
      if (!validateLocation(pickupVal)) {
        toast.error(`"${pickupVal}" is not available. Available: ${getAvailableStatesMsg()}`);
        return;
      }
      if (!validateLocation(destVal)) {
        toast.error(`"${destVal}" is not available. Available: ${getAvailableStatesMsg()}`);
        return;
      }
    }

    if (pickupVal.toLowerCase() === destVal.toLowerCase()) {
      toast.error('Pickup and destination cannot be the same!');
      return;
    }

    const fare = 800 + Math.floor(Math.random() * 2200);

    if (tab === 'schedule') {
      if (!scheduleDate || !scheduleTime) { toast.error('Please set date and time.'); return; }
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
      if (scheduledAt <= new Date()) { toast.error('Scheduled time must be in the future.'); return; }

      const rideId = generateId();
      await supabase.from('rb_scheduled_rides').insert({
        id: rideId, rider_id: rider.id, rider_name: rider.fullName,
        pickup: pickupVal, destination: destVal,
        scheduled_at: scheduledAt.toISOString(), fare, status: 'pending', ride_type: 'schedule',
        created_at: new Date().toISOString(),
      });
      await sendNotification(rider.id, 'rider', '📅 Ride Scheduled!', `Ride from ${pickupVal} to ${destVal} at ${scheduledAt.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}.`);
      showLocalNotification('📅 Ride Scheduled!', `Your ride to ${destVal} is confirmed!`);
      toast.success("Ride scheduled! You'll get a reminder 30 mins before.");
      setPickup(''); setDestination(''); setShareLocation('');
      fetchScheduledRides();
      return;
    }

    setSearching(true);
    const rideId = generateId();
    const pickupCoords = getLocationCoords(pickupVal, activeStates) || [3.3792, 6.5244] as [number, number];
    const destCoords = getLocationCoords(destVal, activeStates) || [3.4219, 6.4314] as [number, number];

    const rideRow = {
      id: rideId, rider_id: rider.id, rider_name: rider.fullName,
      driver_id: null, driver_name: null,
      pickup: pickupVal, destination: destVal, fare,
      pickup_lat: pickupCoords[1], pickup_lng: pickupCoords[0],
      dest_lat: destCoords[1], dest_lng: destCoords[0],
      status: 'searching', ride_type: tab,
      created_at: new Date().toISOString(),
      rider_paid: 0, driver_received: 0, commission_amount: 0,
    };

    await supabase.from('rb_rides').insert(rideRow);

    const ip = await getClientIP();
    await logAuditDB(rider.username, 'rider', 'ride_request', rideId, { pickup: pickupVal, destination: destVal, fare }, ip, rider.state || 'Nigeria');

    const mappedRide = mapRideRow({ ...rideRow, rider_id: rider.id, driver_id: null, driver_name: null });
    setActiveRide(mappedRide);
    setSubView('matching');
    setSearching(false);

    // Start 10-second timer — after it fires, redirect rider back to home
    startDriverSearchTimer(mappedRide);
    // After 10s, redirect rider back to home dashboard
    setTimeout(() => {
      setSubView('home');
      setSearching(false);
    }, 11000);
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    // Use atomic cancel function
    await supabase.rpc('cancel_ride_with_refund', { p_ride_id: activeRide.id, p_cancelled_by: rider?.id || 'rider' });
    setActiveRide(null); setMatchedDriver(null); setDriverLocation(undefined);
    setSearchCountdown(0);
    setSubView('home');
    toast.info('Ride cancelled.');
  };

  const handleSOS = async () => {
    if (!rider || !activeRide) return;
    const ip = await getClientIP();
    await sendNotification('ceo', 'admin', '🚨 SOS EMERGENCY!',
      `URGENT: Rider ${rider.fullName} triggered SOS! Ride: ${activeRide.id}. Driver: ${activeRide.driverName || 'Unknown'}. ${activeRide.pickup} → ${activeRide.destination}`
    );
    await logAuditDB(rider.username, 'rider', 'sos_triggered', activeRide.id, {
      rider: rider.fullName, driver: activeRide.driverName, ride: activeRide.id
    }, ip, rider.state || 'Nigeria');
    showLocalNotification('🚨 SOS Sent', 'RetroBliss safety team has been alerted!');
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
    if (!rider || !completedRideForRating || starRating === 0) { toast.error('Please select a star rating.'); return; }
    await supabase.from('rb_ratings').insert({
      id: generateId(), ride_id: completedRideForRating.id, rider_id: rider.id,
      driver_id: completedRideForRating.driverId, rating: starRating, comment: ratingComment,
      created_at: new Date().toISOString(),
    });
    toast.success('Thanks for your rating! ⭐');
    setCompletedRideForRating(null); setStarRating(0); setRatingComment('');
    setSubView('home');
    fetchBalance(); fetchTransactions();
  };

  const markNotifRead = async (id: string) => {
    await supabase.from('rb_notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setNotifCount(prev => Math.max(0, prev - 1));
  };

  if (!rider) return null;

  // ── CHAT SUPPORT ──
  if (subView === 'chat') {
    return <ChatSupport userId={rider.id} userRole="rider" userName={rider.fullName} onBack={() => setSubView('home')} />;
  }

  // ── CONTACT OFFICIALS ──
  if (subView === 'contact') {
    return <ContactOfficials onBack={() => setSubView('home')} />;
  }

  // ── ABOUT ──
  if (subView === 'about') {
    return <AboutPage onBack={() => setSubView('home')} />;
  }

  // ── RATING SCREEN ──
  if (subView === 'rating' && completedRideForRating) {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #1e0a3c 0%, #0d0618 45%, #080612 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', fontFamily: "'Poppins', sans-serif" }}>
        <NotificationSystem userId={rider.id} userRole="rider" />
        <div style={{ width: '100%', maxWidth: '380px', animation: 'scaleIn 0.5s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '64px', marginBottom: '12px' }}>🎉</div>
            <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 800, margin: '0 0 8px' }}>Ride Complete!</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>{completedRideForRating.pickup} → {completedRideForRating.destination}</p>
            <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.1))', borderRadius: '16px', padding: '12px 20px', marginTop: '12px', display: 'inline-block' }}>
              <p style={{ color: '#C4B5FD', fontSize: '20px', fontWeight: 800, margin: 0 }}>₦{(completedRideForRating.fare || 0).toLocaleString()}</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '2px 0 0' }}>charged from wallet</p>
            </div>
          </div>
          <div className="glass-card" style={{ padding: '24px', marginBottom: '20px', borderRadius: '24px' }}>
            <p style={{ color: 'white', fontSize: '16px', fontWeight: 700, textAlign: 'center', margin: '0 0 20px' }}>Rate your driver</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setStarRating(star)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '36px', transition: 'transform 0.15s ease', transform: star <= starRating ? 'scale(1.2)' : 'scale(1)', filter: star <= starRating ? 'drop-shadow(0 0 8px rgba(245,158,11,0.8))' : 'grayscale(1) opacity(0.3)' }}>⭐</button>
              ))}
            </div>
            <textarea placeholder="Leave a comment (optional)..." value={ratingComment} onChange={e => setRatingComment(e.target.value)} style={{ width: '100%', minHeight: '80px', background: 'rgba(255,255,255,0.055)', border: '1.5px solid rgba(255,255,255,0.09)', borderRadius: '16px', color: 'white', fontSize: '14px', padding: '12px 16px', fontFamily: "'Poppins', sans-serif", resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <button onClick={handleSubmitRating} className="btn-gradient" style={{ width: '100%', padding: '18px', borderRadius: '20px', fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>⭐ Submit Rating</button>
          <button onClick={() => { setCompletedRideForRating(null); setSubView('home'); }} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>Skip</button>
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

          {/* Edit username */}
          <div className="glass-card" style={{ padding: '20px', marginBottom: '16px', borderRadius: '24px' }}>
            <h4 style={{ color: 'white', fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>✏️ Change Username</h4>
            <input className="rb-input" placeholder="New username" value={editUsername} onChange={e => setEditUsername(e.target.value)} style={{ marginBottom: '10px' }} />
            <input className="rb-input" type="password" placeholder="Confirm with your password" value={editPassword} onChange={e => setEditPassword(e.target.value)} style={{ marginBottom: '10px' }} />
            <button onClick={async () => {
              if (!editUsername.trim() || !editPassword) { toast.error('Fill all fields.'); return; }
              const storedPwd = localStorage.getItem(`rb_pwd_${rider.id}`);
              if (storedPwd !== editPassword) { toast.error('Incorrect password.'); return; }
              const { error } = await supabase.from('rb_riders').update({ username: editUsername.trim() }).eq('id', rider.id);
              if (error) { toast.error('Username taken or invalid.'); return; }
              toast.success('Username updated!');
              setEditUsername(''); setEditPassword('');
            }} style={{ width: '100%', padding: '12px', borderRadius: '14px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 600, fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}>
              Update Username
            </button>
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
          <button onClick={onLogout} style={{ width: '100%', padding: '16px', borderRadius: '18px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>🚪 Sign Out</button>
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
            <div style={{ textAlign: 'center', padding: '60px 20px' }}><p style={{ fontSize: '48px', margin: '0 0 12px' }}>💳</p><p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No transactions yet</p></div>
          ) : transactions.map(tx => (
            <div key={tx.id} className="glass-card" style={{ padding: '16px 18px', borderRadius: '18px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '14px', background: tx.type === 'credit' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{tx.type === 'credit' ? '⬇️' : '⬆️'}</div>
                  <div>
                    <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, margin: 0 }}>{tx.description}</p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '2px 0 0' }}>{new Date(tx.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <p style={{ color: tx.type === 'credit' ? '#4ADE80' : '#FCA5A5', fontSize: '15px', fontWeight: 700, margin: 0 }}>{tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}</p>
              </div>
            </div>
          ))}
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
                <button key={amt} onClick={() => setTopUpAmount(String(amt))} style={{ padding: '11px 6px', borderRadius: '14px', background: topUpAmount === String(amt) ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(255,255,255,0.06)', border: `1px solid ${topUpAmount === String(amt) ? 'transparent' : 'rgba(255,255,255,0.08)'}`, color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>₦{amt.toLocaleString()}</button>
              ))}
            </div>
            <input className="rb-input" type="number" placeholder="Or enter custom amount..." value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} style={{ marginBottom: '12px' }} />
            <button onClick={handleTopUp} className="btn-gradient" style={{ width: '100%', padding: '15px', borderRadius: '16px', fontSize: '15px', fontWeight: 700 }}>💳 Top Up via Bank Transfer</button>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>Powered by Paystack · Instant credit</p>
          </div>
          <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 12px' }}>Recent</h3>
          {transactions.slice(0, 5).map(tx => (
            <div key={tx.id} className="glass" style={{ borderRadius: '16px', padding: '14px 16px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: 'white', fontSize: '13px', fontWeight: 500, margin: 0 }}>{tx.description}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '2px 0 0' }}>{new Date(tx.created_at).toLocaleDateString()}</p>
              </div>
              <p style={{ color: tx.type === 'credit' ? '#4ADE80' : '#FCA5A5', fontSize: '15px', fontWeight: 700, margin: 0 }}>{tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}</p>
            </div>
          ))}
          <button onClick={() => setSubView('history')} style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: '14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '13px', fontFamily: "'Poppins', sans-serif" }}>View All Transactions →</button>
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
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ color: 'white', fontSize: '28px', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.2 }}>Finding you<br />a driver...</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 20px' }}>Sit tight! We're finding the best driver for you.</p>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <svg width="180" height="80" viewBox="0 0 180 80" fill="none"><defs><linearGradient id="cg" x1="0" y1="0" x2="180" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#8B5CF6"/><stop offset="1" stopColor="#EC4899"/></linearGradient></defs><rect x="10" y="38" width="160" height="30" rx="12" fill="url(#cg)"/><path d="M35 38 Q42 14 65 12 L118 12 Q140 12 148 38Z" fill="url(#cg)" opacity="0.9"/><path d="M42 38 Q48 18 65 16 L115 16 Q133 16 140 38Z" fill="#0d0618" opacity="0.55"/><circle cx="45" cy="68" r="12" fill="#1a0a2e" stroke="#8B5CF6" strokeWidth="3"/><circle cx="45" cy="68" r="5" fill="rgba(139,92,246,0.6)"/><circle cx="132" cy="68" r="12" fill="#1a0a2e" stroke="#EC4899" strokeWidth="3"/><circle cx="132" cy="68" r="5" fill="rgba(236,72,153,0.6)"/><ellipse cx="170" cy="46" rx="8" ry="5" fill="#FCD34D" opacity="0.9"/><rect x="8" y="43" width="8" height="10" rx="3" fill="#EF4444" opacity="0.8"/></svg>
                </div>
              </div>
              <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', borderRadius: '24px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <ProfileAvatar name={matchedDriver.name} profilePic={matchedDriver.profilePic} size={60} />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>{matchedDriver.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}><span style={{ color: '#F59E0B', fontSize: '16px' }}>⭐</span><span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>{matchedDriver.rating.toFixed(1)}</span></div>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 4px' }}>{matchedDriver.vehicle} · {matchedDriver.plate}</p>
                    <div style={{ background: 'rgba(139,92,246,0.12)', borderRadius: '10px', padding: '4px 10px', display: 'inline-block' }}><span style={{ color: '#C4B5FD', fontSize: '12px', fontWeight: 700 }}>{matchedDriver.eta}</span></div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleCancelRide} style={{ flex: 1, padding: '16px', borderRadius: '18px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>Cancel Ride</button>
                <button style={{ flex: 2, padding: '16px', borderRadius: '18px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }} onClick={() => { if (navigator.share) navigator.share({ title: 'My RetroBliss Ride', text: `I'm riding with ${matchedDriver.name} (${matchedDriver.plate})` }); else toast.success('Trip info copied!'); }}>Share Trip</button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', width: '100%', maxWidth: '360px', animation: 'fadeInUp 0.5s ease' }}>
              <h2 style={{ color: 'white', fontSize: '32px', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.2 }}>Finding you<br />a driver...</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 28px' }}>Sit tight! We're finding the best driver for you.</p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <svg width="180" height="80" viewBox="0 0 180 80" fill="none" style={{ filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.5))' }}><defs><linearGradient id="cg2" x1="0" y1="0" x2="180" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#8B5CF6"/><stop offset="1" stopColor="#EC4899"/></linearGradient></defs><rect x="10" y="38" width="160" height="30" rx="12" fill="url(#cg2)"/><path d="M35 38 Q42 14 65 12 L118 12 Q140 12 148 38Z" fill="url(#cg2)" opacity="0.9"/><path d="M42 38 Q48 18 65 16 L115 16 Q133 16 140 38Z" fill="#0d0618" opacity="0.6"/><circle cx="45" cy="68" r="12" fill="#1a0a2e" stroke="#8B5CF6" strokeWidth="3"/><circle cx="45" cy="68" r="5" fill="rgba(139,92,246,0.7)"/><circle cx="132" cy="68" r="12" fill="#1a0a2e" stroke="#EC4899" strokeWidth="3"/><circle cx="132" cy="68" r="5" fill="rgba(236,72,153,0.7)"/><ellipse cx="170" cy="46" rx="8" ry="5" fill="#FCD34D" opacity="0.95"/><rect x="8" y="43" width="8" height="10" rx="3" fill="#EF4444" opacity="0.8"/></svg>
              </div>
              {searchCountdown > 0 && (
                <div style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '20px', padding: '10px 24px', marginBottom: '20px', display: 'inline-block' }}>
                  <p style={{ color: '#C4B5FD', fontSize: '16px', fontWeight: 700, margin: 0 }}>Searching... {searchCountdown}s</p>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
                {[0, 1, 2].map(i => (<div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8B5CF6', animation: `float 0.8s ease-in-out ${i * 0.25}s infinite alternate` }} />))}
              </div>
              <button onClick={handleCancelRide} style={{ padding: '15px 40px', borderRadius: '20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>Cancel Search</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ACTIVE RIDE ──
  if (subView === 'active-ride' && activeRide) {
    const pickupC = getLocationCoords(activeRide.pickup, activeStates) || [3.3792, 6.5244] as [number, number];
    const destC = getLocationCoords(activeRide.destination, activeStates) || [3.4219, 6.4314] as [number, number];
    return (
      <div style={{ minHeight: '100vh', background: '#080612', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif" }}>
        <NotificationSystem userId={rider.id} userRole="rider" />
        <div style={{ position: 'relative', flex: 1 }}>
          <MapboxMap height="100%" center={pickupC} zoom={13} activeRideRoute={{ pickup: pickupC, destination: destC, driver: driverLocation }} mode="rider" containerStyle={{ height: 'calc(100vh - 230px)', borderRadius: '0' }} />
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
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSOS} style={{ flex: 0, padding: '14px 18px', borderRadius: '16px', background: 'linear-gradient(135deg, #EF4444, #B91C1C)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 800, fontFamily: "'Poppins', sans-serif", boxShadow: '0 4px 16px rgba(239,68,68,0.5)' }}>🆘 SOS</button>
            <button onClick={handleCancelRide} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>Cancel</button>
            <button style={{ flex: 2, padding: '14px', borderRadius: '16px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }} onClick={() => { if (navigator.share) navigator.share({ title: 'RetroBliss Ride', text: `Riding with ${matchedDriver?.name} (${matchedDriver?.plate})` }); else toast.success('Link copied!'); }}>📍 Share Trip</button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN HOME VIEW ──
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a18', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif", position: 'relative', overflow: 'hidden' }}>
      <NotificationSystem userId={rider.id} userRole="rider" />

      {/* Side Menu Overlay */}
      {sideMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
          {/* Backdrop */}
          <div onClick={() => setSideMenuOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          {/* Drawer - slides from left, doesn't cover full screen */}
          <div style={{ position: 'relative', width: '72%', maxWidth: '300px', height: '100%', background: 'rgba(10,6,24,0.97)', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', padding: '56px 0 24px', animation: 'slideInLeft 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
            {/* User info */}
            <div style={{ padding: '0 24px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <ProfileAvatar name={rider.fullName} profilePic={rider.profilePic} size={52} />
              <div>
                <p style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: 0 }}>{rider.fullName}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '2px 0 0' }}>@{rider.username}</p>
              </div>
            </div>

            {/* Menu items */}
            <div style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
              {[
                { icon: '👤', label: 'Profile', action: () => { setSideMenuOpen(false); setSubView('profile'); } },
                { icon: '💬', label: 'RetroBliss Chat Support', action: () => { setSideMenuOpen(false); setSubView('chat'); } },
                { icon: '📞', label: 'Contact Officials', action: () => { setSideMenuOpen(false); setSubView('contact'); } },
                { icon: 'ℹ️', label: 'About RetroBliss', action: () => { setSideMenuOpen(false); setSubView('about'); } },
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'background 0.15s', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}>
                  <span style={{ fontSize: '20px', width: '28px', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontWeight: 500 }}>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Wallet balance in drawer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', marginBottom: '8px' }}>
              <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '14px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Wallet Balance</span>
                <span style={{ color: '#C4B5FD', fontWeight: 700, fontSize: '14px' }}>₦{walletBalance.toLocaleString()}</span>
              </div>
            </div>

            {/* Logout */}
            <button onClick={() => { setSideMenuOpen(false); onLogout(); }} style={{ margin: '0 24px', padding: '14px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              🚪 Log Out
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: '44px 20px 0', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
        {/* Top header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            {/* Hamburger - clickable */}
            <button onClick={() => setSideMenuOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[22, 16, 22].map((w, i) => (
                <div key={i} style={{ width: `${w}px`, height: '2px', background: 'rgba(255,255,255,0.6)', borderRadius: '1px', transition: 'all 0.2s' }} />
              ))}
            </button>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: '0 0 2px', fontWeight: 400 }}>Welcome,</p>
            <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>{rider.fullName.split(' ')[0]}! 👋</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setSubView('wallet')} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '14px', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px' }}>💰</span>
              <span style={{ color: '#C4B5FD', fontSize: '13px', fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>₦{walletBalance.toLocaleString()}</span>
            </button>
            <button onClick={() => setShowNotifs(!showNotifs)} style={{ position: 'relative', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {notifCount > 0 && <div style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />}
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

        {/* Active states notice */}
        {activeStates.length > 0 && (
          <div style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: '14px', padding: '8px 14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>📍</span>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: 0 }}>Rides available in: <strong style={{ color: '#C4B5FD' }}>{activeStates.join(', ')}</strong></p>
          </div>
        )}

        {/* Location inputs card */}
        <div style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '22px', padding: '14px 16px', marginBottom: '14px', position: 'relative', zIndex: 20 }}>
          {/* Pickup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#8B5CF6', flexShrink: 0, boxShadow: '0 0 8px rgba(139,92,246,0.6)' }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 600, margin: '0 0 2px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pickup location</p>
              <input className="rb-input" placeholder="Allen Avenue, Ikeja, Lagos" value={pickup} onChange={e => handleLocationInput(e.target.value, 'pickup')} onFocus={() => { setActiveField('pickup'); setLocationSuggestions(searchLocations('', activeStates).slice(0, 12).map(l => ({ name: l.name, state: l.state, type: l.type }))); }} onBlur={() => setTimeout(() => setActiveField(null), 200)} style={{ background: 'transparent', border: 'none', padding: '0', fontSize: '14px', fontWeight: 500, boxShadow: 'none', height: 'auto', color: 'white' }} />
            </div>
          </div>
          {/* Destination */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '12px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#EC4899', flexShrink: 0, boxShadow: '0 0 8px rgba(236,72,153,0.6)' }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 600, margin: '0 0 2px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Where to?</p>
              <input className="rb-input" placeholder="Add drop-off location" value={tab === 'share' ? shareLocation : destination} onChange={e => handleLocationInput(e.target.value, tab === 'share' ? 'share' : 'destination')} onFocus={() => { setActiveField(tab === 'share' ? 'share' : 'destination'); setLocationSuggestions(searchLocations('', activeStates).slice(0, 12).map(l => ({ name: l.name, state: l.state, type: l.type }))); }} onBlur={() => setTimeout(() => setActiveField(null), 200)} style={{ background: 'transparent', border: 'none', padding: '0', fontSize: '14px', fontWeight: 500, boxShadow: 'none', height: 'auto', color: 'white' }} />
            </div>
            <button style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
          </div>

          {/* Location suggestions dropdown */}
          {activeField && locationSuggestions.length > 0 && (
            <div className="glass-strong" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', borderRadius: '18px', padding: '10px', zIndex: 50, maxHeight: '220px', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>
              {activeStates.length > 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', margin: '4px 8px 8px', textTransform: 'uppercase' }}>Available Locations — {activeStates.join(', ')}</p>}
              {locationSuggestions.map(loc => (
                <button key={`${loc.name}-${loc.state}`} onMouseDown={() => {
                  if (activeField === 'pickup') setPickup(loc.name);
                  else if (activeField === 'destination') setDestination(loc.name);
                  else setShareLocation(loc.name);
                  setActiveField(null); setLocationSuggestions([]);
                }} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'white', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', gap: '10px' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.1)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}>
                  <span style={{ color: '#EC4899', fontSize: '16px' }}>{loc.type === 'landmark' ? '🏛️' : loc.type === 'market' ? '🛒' : '📍'}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px' }}>{loc.name}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{loc.state} · {loc.type}</p>
                  </div>
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

        {/* Scheduled rides list (when on schedule tab) */}
        {tab === 'schedule' && scheduledRides.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>YOUR SCHEDULED RIDES</p>
            {scheduledRides.map((r: Record<string, unknown>) => (
              <div key={r.id as string} className="glass" style={{ borderRadius: '16px', padding: '12px 14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, margin: 0 }}>{r.pickup as string} → {r.destination as string}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '2px 0 0' }}>{new Date(r.scheduled_at as string).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div style={{ background: 'rgba(139,92,246,0.12)', borderRadius: '10px', padding: '4px 10px' }}>
                  <p style={{ color: '#C4B5FD', fontSize: '11px', fontWeight: 700, margin: 0 }}>{r.status as string}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MAP with search */}
      <div style={{ padding: '0 20px', maxWidth: '480px', margin: '0 auto', width: '100%', minHeight: '240px' }}>
        {/* Map search bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            className="rb-input"
            placeholder="🔍 Search any place in Nigeria..."
            value={mapSearchQuery}
            onChange={e => setMapSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleMapSearch()}
            style={{ flex: 1, fontSize: '13px', padding: '11px 16px' }}
          />
          <button onClick={handleMapSearch} style={{ padding: '11px 16px', borderRadius: '18px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif", fontWeight: 600, flexShrink: 0 }}>Go</button>
        </div>
        <MapboxMap
          height={240}
          center={mapCenter}
          zoom={mapZoom}
          markers={onlineDrivers}
          mode="rider"
          containerStyle={{ borderRadius: '20px', width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-44px', marginRight: '12px', position: 'relative', zIndex: 5 }}>
          <button style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a18" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="22"/><line x1="2" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="22" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* Request Ride button */}
      <div style={{ padding: '16px 20px 8px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
        <button onClick={handleRequestRide} disabled={searching} style={{ width: '100%', padding: '20px', borderRadius: '60px', background: searching ? 'rgba(139,92,246,0.5)' : 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)', border: 'none', color: 'white', fontSize: '18px', fontWeight: 700, fontFamily: "'Poppins', sans-serif", cursor: searching ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: searching ? 'none' : '0 8px 32px rgba(139,92,246,0.55)', transition: 'all 0.22s ease' }}>
          {searching ? (<><div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} /> Finding Drivers...</>) : tab === 'schedule' ? '📅 Schedule Ride' : tab === 'share' ? '👥 Find Ride Share' : 'Request Ride'}
        </button>
      </div>

      {/* Bottom navigation */}
      <div style={{ padding: '8px 20px 16px', maxWidth: '480px', margin: '0 auto', width: '100%', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
          {([
            { key: 'ride' as Tab, icon: '🛵', label: 'Ride Now' },
            { key: 'schedule' as Tab, icon: '⏰', label: 'Schedule' },
            { key: 'share' as Tab, icon: '👥', label: 'Ride Share' },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '14px 6px', borderRadius: '18px', background: tab === t.key ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)', border: tab === t.key ? '1.5px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease', fontFamily: "'Poppins', sans-serif" }}>
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
