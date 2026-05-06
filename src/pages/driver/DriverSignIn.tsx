import React, { useState } from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';
import { supabase, generateId, logAuditDB, getClientIP } from '@/lib/supabase';
import CarTransitionAnimation from '@/components/CarTransitionAnimation';
import RiderOnboarding from '@/pages/rider/RiderOnboarding';
import type { Driver } from '@/types';
import { toast } from 'sonner';

const CEO_USERNAME = 'retrobilss admin';
const CEO_USERNAME_ALT = 'retrobliss admin';

interface DriverSignInProps {
  onLogin: (driver: Driver) => void;
  onSignUp: () => void;
  onBack: () => void;
  onCEODetected: () => void;
}

const DriverSignIn: React.FC<DriverSignInProps> = ({ onLogin, onSignUp, onBack, onCEODetected }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingDriver, setOnboardingDriver] = useState<Driver | null>(null);
  const [forgotMode, setForgotMode] = useState<'off' | 'find' | 'reset'>('off');
  const [forgotId, setForgotId] = useState('');
  const [foundUserId, setFoundUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPwd, setConfirmNewPwd] = useState('');

  const handleSignIn = async () => {
    setError('');
    if (!identifier.trim() || !password.trim()) { setError('Please enter your credentials.'); return; }

    const lcId = identifier.trim().toLowerCase();
    if (lcId === CEO_USERNAME || lcId === CEO_USERNAME_ALT) {
      if (password === 'Admin') { onCEODetected(); return; }
      else { setError('Invalid credentials.'); return; }
    }

    setLoading(true);
    try {
      const { data: drivers, error: err } = await supabase.from('rb_drivers').select('*')
        .or(`username.eq.${lcId},email.eq.${lcId}`).limit(1);

      if (err || !drivers || drivers.length === 0) {
        setError('Username or password is incorrect. Please try again.');
        setLoading(false); return;
      }

      const d = drivers[0];
      const storedPwd = localStorage.getItem(`rb_pwd_${d.id}`);

      if (storedPwd !== password) {
        setError('Username or password is incorrect. Please try again.');
        setLoading(false); return;
      }

      // Riders can't login as drivers
      const { data: riderCheck } = await supabase.from('rb_riders').select('id').or(`username.eq.${lcId},email.eq.${lcId}`).limit(1);
      if (riderCheck && riderCheck.length > 0) {
        setError('Rider credentials cannot be used to sign in as a driver.');
        setLoading(false); return;
      }

      if (d.status === 'frozen') { setError('Your account has been frozen. Contact support.'); setLoading(false); return; }

      const driver: Driver = {
        id: d.id, fullName: d.full_name, username: d.username, email: d.email,
        phone: d.phone, dob: d.dob, location: d.location, state: d.state,
        country: d.country, profilePic: d.profile_pic, walletBalance: d.wallet_balance,
        vehicleMake: d.vehicle_make, vehicleModel: d.vehicle_model, vehicleYear: d.vehicle_year,
        vehiclePlate: d.vehicle_plate, vehicleColor: d.vehicle_color, idUpload: d.id_upload,
        createdAt: d.created_at, role: 'driver', status: d.status,
        bankName: d.bank_name, bankAccount: d.bank_account, bankAccountName: d.bank_account_name,
      };

      if (d.status === 'pending' || d.status === 'declined') {
        setLoading(false);
        onLogin(driver);
        return;
      }

      // Check if driver has seen onboarding (first login after approval)
      const hasSeenOnboarding = localStorage.getItem(`rb_driver_onboarded_${d.id}`);
      
      setLoading(false);
      setTransitioning(true);

      const ip = await getClientIP();
      await logAuditDB(d.username, 'driver', 'login', d.id, { email: d.email }, ip, d.state || 'Nigeria');

      if (!hasSeenOnboarding) {
        // Show 3 onboarding pages for newly approved drivers
        setOnboardingDriver(driver);
        setTimeout(() => {
          setTransitioning(false);
          setShowOnboarding(true);
        }, 2200);
      } else {
        setTimeout(() => onLogin(driver), 100);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleForgotFind = async () => {
    if (!forgotId.trim()) { setError('Enter your email or username.'); return; }
    setLoading(true); setError('');
    const q = forgotId.trim().toLowerCase();
    const { data } = await supabase.from('rb_drivers').select('id').or(`username.eq.${q},email.eq.${q}`).limit(1);
    if (data && data.length > 0) { setFoundUserId(data[0].id); setForgotMode('reset'); setLoading(false); return; }
    setError('No driver account found with that email or username.');
    setLoading(false);
  };

  const handleResetPassword = () => {
    if (!newPassword || newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmNewPwd) { setError('Passwords do not match.'); return; }
    localStorage.setItem(`rb_pwd_${foundUserId}`, newPassword);
    setForgotMode('off'); setForgotId(''); setNewPassword(''); setConfirmNewPwd(''); setFoundUserId('');
    toast.success('Password reset! Sign in with your new password.');
  };

  if (forgotMode === 'find') {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #1a0d08 0%, #0d0618 45%, #080612 100%)', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ padding: '52px 28px 40px', maxWidth: '440px', margin: '0 auto', width: '100%' }}>
          <button onClick={() => { setForgotMode('off'); setError(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '14px', marginBottom: '28px', fontFamily: "'Poppins', sans-serif", padding: 0 }}>← Back</button>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}><RetroBlissLogo size={60} /></div>
          <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 800, margin: '0 0 6px' }}>Reset Driver Password 🔐</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '0 0 24px' }}>Enter your driver email or username</p>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '14px 18px', marginBottom: '16px' }}><p style={{ color: '#FCA5A5', fontSize: '13px', margin: 0 }}>{error}</p></div>}
          <input className="rb-input" placeholder="Email or username" value={forgotId} onChange={e => setForgotId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleForgotFind()} style={{ marginBottom: '16px' }} />
          <button onClick={handleForgotFind} disabled={loading} style={{ width: '100%', padding: '17px', borderRadius: '20px', background: 'linear-gradient(135deg, #F59E0B, #EF4444)', border: 'none', color: 'white', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            {loading ? <><div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} />Searching...</> : '🔍 Find My Account'}
          </button>
        </div>
      </div>
    );
  }

  if (forgotMode === 'reset') {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #1a0d08 0%, #0d0618 45%, #080612 100%)', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ padding: '52px 28px 40px', maxWidth: '440px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}><RetroBlissLogo size={60} /></div>
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '16px', padding: '14px 18px', marginBottom: '20px' }}><p style={{ color: '#4ADE80', fontSize: '13px', margin: 0 }}>✅ Driver account found! Set your new password.</p></div>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '14px 18px', marginBottom: '16px' }}><p style={{ color: '#FCA5A5', fontSize: '13px', margin: 0 }}>{error}</p></div>}
          <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 800, margin: '0 0 20px' }}>Set New Password</h2>
          <input className="rb-input" type="password" placeholder="New password (min 6 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ marginBottom: '12px' }} />
          <input className="rb-input" type="password" placeholder="Confirm new password" value={confirmNewPwd} onChange={e => setConfirmNewPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleResetPassword()} style={{ marginBottom: '16px' }} />
          <button onClick={handleResetPassword} style={{ width: '100%', padding: '17px', borderRadius: '20px', background: 'linear-gradient(135deg, #F59E0B, #EF4444)', border: 'none', color: 'white', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>🔐 Reset Password</button>
        </div>
      </div>
    );
  }

  if (showOnboarding && onboardingDriver) {
    return (
      <RiderOnboarding
        rider={null}
        onComplete={() => {
          localStorage.setItem(`rb_driver_onboarded_${onboardingDriver.id}`, 'true');
          onLogin(onboardingDriver);
        }}
      />
    );
  }

  if (transitioning) return <CarTransitionAnimation onComplete={() => {}} loadingText="Starting your shift..." />;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #1a0d08 0%, #0d0618 45%, #080612 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Poppins', sans-serif",
    }}>
      <div style={{ padding: '52px 28px 40px', maxWidth: '440px', margin: '0 auto', width: '100%' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '28px', fontFamily: "'Poppins', sans-serif", padding: 0 }}>
          ← Back
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px', animation: 'fadeInDown 0.5s ease' }}>
          <RetroBlissLogo size={65} showTagline />
        </div>

        {/* Driver badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(234,88,12,0.15))', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '20px', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🚗</span>
            <span style={{ color: '#FCD34D', fontSize: '13px', fontWeight: 700 }}>Driver Portal</span>
          </div>
        </div>

        <div style={{ animation: 'fadeInUp 0.5s 0.1s ease both' }}>
          <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 800, margin: '0 0 6px' }}>Driver Sign In</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '0 0 28px' }}>Access your driver dashboard</p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <p style={{ color: '#FCA5A5', fontSize: '13px', margin: 0 }}>{error}</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>USERNAME OR EMAIL</label>
              <input className="rb-input" placeholder="Enter username or email" value={identifier} onChange={e => setIdentifier(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
            </div>

            <div>
              <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input className="rb-input" type={showPwd ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSignIn()} style={{ paddingRight: '52px' }} />
                <button onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '18px' }}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              onClick={handleSignIn}
              disabled={loading}
              style={{ width: '100%', padding: '17px', borderRadius: '20px', fontSize: '16px', fontWeight: 700, marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: loading ? 0.7 : 1, background: 'linear-gradient(135deg, #F59E0B, #EF4444)', border: 'none', color: 'white', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'all 0.2s ease' }}
            >
              {loading ? (
                <><div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} /> Signing in...</>
              ) : '🚗 Start My Shift'}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>
                New driver?{' '}
                <button onClick={onSignUp} style={{ background: 'none', border: 'none', color: '#FCD34D', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}>Apply now</button>
              </p>
              <button onClick={() => { setForgotMode('find'); setError(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '13px', fontFamily: "'Poppins', sans-serif", padding: 0 }}>Forgot password?</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverSignIn;
