import React, { useState } from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';
import { supabase, generateId, logAuditDB, getClientIP } from '@/lib/supabase';
import CarTransitionAnimation from '@/components/CarTransitionAnimation';
import type { Rider } from '@/types';
import { toast } from 'sonner';

const CEO_USERNAME = 'retrobilss admin';
const CEO_USERNAME_ALT = 'retrobliss admin';

interface RiderSignInProps {
  onLogin: (rider: Rider) => void;
  onSignUp: () => void;
  onBack: () => void;
  onCEODetected: () => void;
}

const RiderSignIn: React.FC<RiderSignInProps> = ({ onLogin, onSignUp, onBack, onCEODetected }) => {
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
      const { data: riders, error: err } = await supabase.from('rb_riders').select('*')
        .or(`username.eq.${lcId},email.eq.${lcId}`).limit(1);

      if (err || !riders || riders.length === 0) {
        setError('Username or password is incorrect. Please try again.');
        setLoading(false); return;
      }

      const r = riders[0];
      const storedPwd = localStorage.getItem(`rb_pwd_${r.id}`);

      if (storedPwd !== password) {
        setError('Username or password is incorrect. Please try again.');
        setLoading(false); return;
      }

      if (r.status === 'frozen') { setError('Your account has been frozen. Contact support.'); setLoading(false); return; }
      if (r.status === 'closed') { setError('This account has been closed.'); setLoading(false); return; }

      // Drivers can't login as riders
      const { data: driverCheck } = await supabase.from('rb_drivers').select('id').or(`username.eq.${lcId},email.eq.${lcId}`).limit(1);
      if (driverCheck && driverCheck.length > 0) {
        setError('Driver credentials cannot be used to sign in as a rider.');
        setLoading(false); return;
      }

      setLoading(false);
      setTransitioning(true);

      const ip = await getClientIP();
      await logAuditDB(r.username, 'rider', 'login', r.id, { email: r.email }, ip, r.state || 'Nigeria');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleTransitionComplete = async () => {
    const lcId = identifier.trim().toLowerCase();
    const { data: riders } = await supabase.from('rb_riders').select('*').or(`username.eq.${lcId},email.eq.${lcId}`).limit(1);
    if (riders && riders.length > 0) {
      const r = riders[0];
      const rider: Rider = {
        id: r.id, fullName: r.full_name, username: r.username, email: r.email,
        phone: r.phone, dob: r.dob, location: r.location, state: r.state,
        country: r.country, profilePic: r.profile_pic, walletBalance: r.wallet_balance,
        createdAt: r.created_at, role: 'rider', status: r.status,
      };
      onLogin(rider);
    }
  };

  if (transitioning) return <CarTransitionAnimation onComplete={handleTransitionComplete} loadingText="Welcome back! Fetching your ride..." />;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #1e0a3c 0%, #0d0618 45%, #080612 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Poppins', sans-serif",
      overflowY: 'auto',
    }}>
      <div style={{ padding: '52px 28px 40px', maxWidth: '440px', margin: '0 auto', width: '100%' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '28px', fontFamily: "'Poppins', sans-serif', padding: 0" }}>
          ← Back
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px', animation: 'fadeInDown 0.5s ease' }}>
          <RetroBlissLogo size={65} showTagline />
        </div>

        <div style={{ animation: 'fadeInUp 0.5s 0.1s ease both' }}>
          <h2 style={{ color: 'white', fontSize: '26px', fontWeight: 800, margin: '0 0 6px' }}>Welcome back 👋</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '0 0 32px' }}>Sign in to your rider account</p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <p style={{ color: '#FCA5A5', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>{error}</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>USERNAME OR EMAIL</label>
              <input
                className="rb-input"
                placeholder="Enter username or email"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                autoComplete="username"
              />
            </div>

            <div>
              <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="rb-input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                  autoComplete="current-password"
                  style={{ paddingRight: '52px' }}
                />
                <button onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: 1 }}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              onClick={handleSignIn}
              disabled={loading}
              className="btn-gradient"
              style={{ width: '100%', padding: '17px', borderRadius: '20px', fontSize: '16px', fontWeight: 700, marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <><div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} /> Signing in...</>
              ) : '🚀 Sign In'}
            </button>

            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '8px 0 0' }}>
              Don't have an account?{' '}
              <button onClick={onSignUp} style={{ background: 'none', border: 'none', color: '#A78BFA', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}>
                Sign up now
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiderSignIn;
