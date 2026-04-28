import React, { useState } from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';
import { logAuditDB, getClientIP } from '@/lib/supabase';

const CEO_PASSWORD = 'Retro2026@#$';

interface CEOPasswordEntryProps {
  onSuccess: () => void;
  onBack: () => void;
}

const CEOPasswordEntry: React.FC<CEOPasswordEntryProps> = ({ onSuccess, onBack }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async () => {
    setError('');
    if (!password.trim()) { setError('Please enter the admin password.'); return; }
    setLoading(true);
    setTimeout(async () => {
      setLoading(false);
      if (password !== CEO_PASSWORD) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setError(`Incorrect password. ${newAttempts >= 3 ? 'Multiple failed attempts detected.' : 'Please try again.'}`);
        setPassword('');
        return;
      }
      const ip = await getClientIP();
      logAuditDB('CEO Admin', 'admin', 'ceo_login', 'ceo', { method: 'password' }, ip, 'Nigeria').catch(() => {});
      onSuccess();
    }, 800);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d0618 0%, #1a0a2e 50%, #0d0618 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      fontFamily: "'Poppins', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '60px', left: '-60px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <button onClick={onBack} style={{ position: 'absolute', top: '24px', left: '24px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>

      <div style={{ animation: 'fadeInUp 0.5s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '360px' }}>
        <RetroBlissLogo size={70} showTagline={false} />

        <div className="glass" style={{ width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginTop: '28px', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)' }}>
          🔐
        </div>

        <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 700, margin: '20px 0 4px', textAlign: 'center' }}>CEO Administrative Panel</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 32px', textAlign: 'center' }}>Enter your administrative password to continue</p>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', color: '#FCA5A5', fontSize: '13px', width: '100%' }}>
            {error}
          </div>
        )}

        <div style={{ width: '100%' }}>
          <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Admin Password</label>
          <div style={{ position: 'relative' }}>
            <input
              className="rb-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{ paddingRight: '48px' }}
            />
            <button onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '16px' }}>
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: '100%', marginTop: '20px', padding: '16px', borderRadius: '16px', background: 'linear-gradient(135deg, #F59E0B, #EC4899)', border: 'none', color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease' }}
        >
          {loading ? (
            <><div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} /> Verifying...</>
          ) : '🔓 Access Admin Panel'}
        </button>

        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '20px', textAlign: 'center' }}>
          Unauthorized access is strictly prohibited and logged.
        </p>
      </div>
    </div>
  );
};

export default CEOPasswordEntry;
