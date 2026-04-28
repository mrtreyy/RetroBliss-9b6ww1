import React from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';

interface RoleSelectProps {
  onSelectRider: () => void;
  onSelectDriver: () => void;
}

const RoleSelect: React.FC<RoleSelectProps> = ({ onSelectRider, onSelectDriver }) => {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #1e0a3c 0%, #0d0618 45%, #080612 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: "'Poppins', sans-serif",
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Background elements */}
      <div style={{ position: 'absolute', top: '10%', left: '-80px', width: '260px', height: '260px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ padding: '60px 32px 32px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeInDown 0.6s ease' }}>
        <RetroBlissLogo size={75} showTagline />
      </div>

      {/* Feature pills */}
      <div style={{ display: 'flex', gap: '8px', padding: '0 24px 32px', flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeInUp 0.6s 0.1s ease both' }}>
        {[
          { icon: '🛡️', label: 'Safe Rides' },
          { icon: '⚡', label: 'Fast Pickup' },
          { icon: '⭐', label: 'Top Drivers' },
          { icon: '💳', label: 'Easy Pay' },
        ].map(f => (
          <div key={f.label} className="glass" style={{ borderRadius: '24px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>{f.icon}</span>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', fontWeight: 500 }}>{f.label}</span>
          </div>
        ))}
      </div>

      {/* Main cards */}
      <div style={{ padding: '0 24px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeInUp 0.6s 0.2s ease both' }}>

        {/* Rider card */}
        <button
          onClick={onSelectRider}
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(236,72,153,0.12) 100%)',
            border: '1.5px solid rgba(139,92,246,0.35)',
            borderRadius: '28px',
            padding: '24px',
            cursor: 'pointer',
            fontFamily: "'Poppins', sans-serif",
            textAlign: 'left',
            transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            position: 'relative',
            overflow: 'hidden',
            backdropFilter: 'blur(20px)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02) translateY(-2px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 16px 48px rgba(139,92,246,0.4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1) translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '20px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0, boxShadow: '0 8px 24px rgba(139,92,246,0.5)' }}>
              🛵
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ color: 'white', fontSize: '19px', fontWeight: 700, margin: '0 0 4px' }}>RetroBliss Rider</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>Book a ride · Track your trip · Pay seamlessly</p>
            </div>
            <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.4)' }}>›</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            {['Book Now', 'Schedule', 'Ride Share'].map(t => (
              <span key={t} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '4px 10px', color: 'rgba(255,255,255,0.55)', fontSize: '11px', fontWeight: 500 }}>{t}</span>
            ))}
          </div>
        </button>

        {/* Driver card */}
        <button
          onClick={onSelectDriver}
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(234,88,12,0.1) 100%)',
            border: '1.5px solid rgba(245,158,11,0.3)',
            borderRadius: '28px',
            padding: '24px',
            cursor: 'pointer',
            fontFamily: "'Poppins', sans-serif",
            textAlign: 'left',
            transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            position: 'relative',
            overflow: 'hidden',
            backdropFilter: 'blur(20px)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02) translateY(-2px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 16px 48px rgba(245,158,11,0.35)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1) translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '20px', background: 'linear-gradient(135deg, #F59E0B, #EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0, boxShadow: '0 8px 24px rgba(245,158,11,0.5)' }}>
              🚗
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ color: 'white', fontSize: '19px', fontWeight: 700, margin: '0 0 4px' }}>Driver Sign In</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>Accept rides · Navigate · Earn money</p>
            </div>
            <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.4)' }}>›</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            {['Flexible Hours', 'Daily Earnings', 'GPS Navigation'].map(t => (
              <span key={t} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '4px 10px', color: 'rgba(255,255,255,0.55)', fontSize: '11px', fontWeight: 500 }}>{t}</span>
            ))}
          </div>
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '32px', animation: 'fadeInUp 0.6s 0.3s ease both' }}>
        {[
          { value: '50K+', label: 'Rides' },
          { value: '4.9★', label: 'Rating' },
          { value: '1K+', label: 'Drivers' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <p style={{ color: 'white', fontSize: '18px', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.value}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0, fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <p style={{ position: 'absolute', bottom: '20px', color: 'rgba(255,255,255,0.15)', fontSize: '10px', letterSpacing: '0.08em' }}>
        Nigeria's Premium Ride Experience
      </p>
    </div>
  );
};

export default RoleSelect;
