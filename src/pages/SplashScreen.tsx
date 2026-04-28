import React, { useEffect, useState } from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [carPos, setCarPos] = useState(-15);
  const [logoVisible, setLogoVisible] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);
  const [statusText, setStatusText] = useState('IGNITING ENGINE...');

  const statuses = [
    'IGNITING ENGINE...',
    'PLOTTING YOUR ROUTE...',
    'SYNCING DRIVERS...',
    'WARMING UP...',
    "LET'S RIDE ✦",
  ];

  useEffect(() => {
    const t1 = setTimeout(() => setLogoVisible(true), 200);
    const t2 = setTimeout(() => setTaglineVisible(true), 700);

    // Car animation
    const carInterval = setInterval(() => {
      setCarPos(prev => {
        if (prev >= 115) { clearInterval(carInterval); return 115; }
        return prev + 0.6;
      });
    }, 16);

    // Progress
    const startDelay = setTimeout(() => {
      let p = 0;
      const progressInterval = setInterval(() => {
        const inc = p < 50 ? 2.2 : p < 80 ? 1.4 : p < 95 ? 0.6 : 0.3;
        p = Math.min(100, p + inc);
        setProgress(p);
        const idx = Math.floor((p / 100) * (statuses.length - 1));
        setStatusText(statuses[Math.min(idx, statuses.length - 1)]);
        if (p >= 100) {
          clearInterval(progressInterval);
          setTimeout(onComplete, 500);
        }
      }, 38);
    }, 500);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(startDelay);
      clearInterval(carInterval);
    };
  }, [onComplete]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #1e0a3c 0%, #0d0618 40%, #080612 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Poppins', sans-serif",
    }}>
      {/* Background orbs */}
      <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '360px', height: '360px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.13) 0%, transparent 65%)', pointerEvents: 'none', animation: 'glow-pulse 3s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '60%', left: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: `${3 + i % 3}px`, height: `${3 + i % 3}px`,
          borderRadius: '50%',
          background: i % 3 === 0 ? '#8B5CF6' : i % 3 === 1 ? '#EC4899' : '#F59E0B',
          opacity: 0.4,
          left: `${15 + i * 14}%`,
          top: `${20 + (i % 4) * 15}%`,
          animation: `particle-rise ${2 + i * 0.3}s ease-in-out infinite`,
          animationDelay: `${i * 0.4}s`,
        }} />
      ))}

      {/* Logo */}
      <div style={{
        opacity: logoVisible ? 1 : 0,
        transform: logoVisible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.88)',
        transition: 'opacity 0.8s cubic-bezier(0.34,1.56,0.64,1), transform 0.8s cubic-bezier(0.34,1.56,0.64,1)',
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '52px',
      }}>
        <RetroBlissLogo size={90} showTagline={taglineVisible} />
      </div>

      {/* Car animation strip */}
      <div style={{ width: '100%', maxWidth: '400px', height: '64px', position: 'relative', marginBottom: '36px', overflow: 'hidden' }}>
        {/* Road surface */}
        <div style={{ position: 'absolute', bottom: '4px', left: '3%', width: '94%', height: '14px', background: 'rgba(255,255,255,0.04)', borderRadius: '7px' }} />
        {/* Road marking */}
        <div style={{
          position: 'absolute', bottom: '10px', left: '3%', width: '94%', height: '2px',
          backgroundImage: 'repeating-linear-gradient(90deg, #F59E0B 0px, #F59E0B 14px, transparent 14px, transparent 28px)',
          opacity: 0.5,
          animation: 'road-dash 0.5s linear infinite',
        }} />

        {/* Car */}
        <div style={{
          position: 'absolute', bottom: '17px', left: `${carPos}%`,
          transition: 'left 0.016s linear',
          filter: 'drop-shadow(0 0 10px rgba(139,92,246,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
        }}>
          <svg width="58" height="26" viewBox="0 0 58 26" fill="none">
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="58" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8B5CF6" /><stop offset="0.5" stopColor="#A855F7" /><stop offset="1" stopColor="#EC4899" />
              </linearGradient>
              <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6D28D9" /><stop offset="1" stopColor="#9333EA" />
              </linearGradient>
            </defs>
            {/* Body */}
            <rect x="2" y="11" width="54" height="11" rx="5" fill="url(#cg)" />
            {/* Roof */}
            <path d="M11 11 Q15 2 24 2 L36 2 Q45 2 49 11Z" fill="url(#cg)" opacity="0.95" />
            {/* Window */}
            <path d="M14 11 Q17 5 24 5 L34 5 Q41 5 44 11Z" fill="#0d0618" opacity="0.65" />
            {/* Window shine */}
            <path d="M16 11 Q18 7 22 6 L28 6 Q33 7 35 9" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" fill="none" />
            {/* Wheels */}
            <circle cx="14" cy="22" r="4.5" fill="#0d0618" stroke="#8B5CF6" strokeWidth="2" />
            <circle cx="14" cy="22" r="2" fill="rgba(139,92,246,0.6)" />
            <circle cx="42" cy="22" r="4.5" fill="#0d0618" stroke="#EC4899" strokeWidth="2" />
            <circle cx="42" cy="22" r="2" fill="rgba(236,72,153,0.6)" />
            {/* Headlights */}
            <ellipse cx="56" cy="15" rx="2.5" ry="1.5" fill="#FCD34D" opacity="0.95" />
            <ellipse cx="56" cy="15" rx="5" ry="2.5" fill="rgba(252,211,77,0.15)" />
            {/* Tail lights */}
            <rect x="1" y="14" width="3" height="4" rx="1" fill="#EF4444" opacity="0.9" />
            {/* Door line */}
            <line x1="29" y1="11" x2="29" y2="22" stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />
            {/* Side detail */}
            <line x1="8" y1="16" x2="50" y2="16" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Speed lines */}
        {carPos > 8 && (
          <div style={{ position: 'absolute', bottom: '24px', left: `${Math.max(0, carPos - 10)}%`, display: 'flex', flexDirection: 'column', gap: '4px', opacity: Math.min(0.7, (carPos - 8) / 25) }}>
            {[16, 24, 14, 8].map((w, i) => (
              <div key={i} style={{ width: `${w}px`, height: '1.5px', background: `linear-gradient(90deg, transparent, rgba(${i % 2 === 0 ? '139,92,246' : '236,72,153'},0.7))`, borderRadius: '1px' }} />
            ))}
          </div>
        )}
      </div>

      {/* Loading bar */}
      <div style={{ width: '100%', maxWidth: '300px', padding: '0 16px' }}>
        <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #6D28D9, #8B5CF6, #EC4899, #F59E0B)',
            backgroundSize: '200% 100%',
            borderRadius: '10px',
            transition: 'width 0.038s linear',
            position: 'relative',
            boxShadow: '0 0 14px rgba(139,92,246,0.75)',
            animation: 'shimmer-move 2s linear infinite',
          }}>
            {/* Glow tip */}
            <div style={{ position: 'absolute', right: '-1px', top: '-1px', bottom: '-1px', width: '8px', background: 'rgba(255,255,255,0.9)', borderRadius: '4px', filter: 'blur(2px)' }} />
          </div>
        </div>

        {/* Segment markers */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          {[0, 25, 50, 75, 100].map(pct => (
            <div key={pct} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            }}>
              <div style={{ width: '2px', height: '6px', background: progress >= pct ? '#8B5CF6' : 'rgba(255,255,255,0.12)', borderRadius: '1px', transition: 'background 0.4s' }} />
              <span style={{ color: progress >= pct ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.12)', fontSize: '9px', fontWeight: 600, transition: 'color 0.4s' }}>{pct}%</span>
            </div>
          ))}
        </div>

        <p style={{
          color: progress === 100 ? '#F59E0B' : 'rgba(255,255,255,0.35)',
          fontSize: '10px',
          textAlign: 'center',
          marginTop: '16px',
          letterSpacing: '0.14em',
          fontWeight: 600,
          transition: 'color 0.4s ease',
        }}>
          {statusText}
        </p>
      </div>

      <p style={{ position: 'absolute', bottom: '24px', color: 'rgba(255,255,255,0.15)', fontSize: '10px', letterSpacing: '0.1em', fontWeight: 500 }}>
        RETROBLISS v2.0 · NIGERIA
      </p>
    </div>
  );
};

export default SplashScreen;
