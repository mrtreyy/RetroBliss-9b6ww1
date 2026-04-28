import React, { useState } from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';
import { supabase, generateId, logAuditDB, getClientIP } from '@/lib/supabase';
import CarTransitionAnimation from '@/components/CarTransitionAnimation';
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

      setLoading(false);
      setTransitioning(true);

      const ip = await getClientIP();
      await logAuditDB(d.username, 'driver', 'login', d.id, { email: d.email }, ip, d.state || 'Nigeria');

      setTimeout(() => onLogin(driver), 100);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

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

            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '4px 0 0' }}>
              New driver?{' '}
              <button onClick={onSignUp} style={{ background: 'none', border: 'none', color: '#FCD34D', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}>
                Apply now
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverSignIn;
