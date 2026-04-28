import React, { useEffect, useState } from 'react';

interface CarTransitionAnimationProps {
  onComplete: () => void;
  loadingText?: string;
}

const CarTransitionAnimation: React.FC<CarTransitionAnimationProps> = ({ onComplete, loadingText = 'Loading...' }) => {
  const [carPos, setCarPos] = useState(-15);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const carInterval = setInterval(() => {
      setCarPos(prev => {
        if (prev >= 115) { clearInterval(carInterval); return 115; }
        return prev + 1.2;
      });
    }, 16);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(onComplete, 300);
          return 100;
        }
        return Math.min(100, prev + 3.2);
      });
    }, 35);

    return () => { clearInterval(carInterval); clearInterval(progressInterval); };
  }, [onComplete]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #1e0a3c 0%, #0d0618 45%, #080612 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Poppins', sans-serif", position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', pointerEvents: 'none', animation: 'glow-pulse 3s ease-in-out infinite' }} />

      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '40px', animation: 'fadeIn 0.5s ease' }}>
        {loadingText}
      </p>

      {/* Car strip */}
      <div style={{ width: '100%', maxWidth: '380px', height: '60px', position: 'relative', marginBottom: '32px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: '8px', left: '3%', width: '94%', height: '14px', background: 'rgba(255,255,255,0.04)', borderRadius: '7px' }} />
        <div style={{ position: 'absolute', bottom: '10px', left: '3%', width: '94%', height: '2px', backgroundImage: 'repeating-linear-gradient(90deg, #F59E0B 0px, #F59E0B 14px, transparent 14px, transparent 28px)', opacity: 0.5, animation: 'road-dash 0.5s linear infinite' }} />
        <div style={{ position: 'absolute', bottom: '17px', left: `${carPos}%`, filter: 'drop-shadow(0 0 10px rgba(139,92,246,0.9))', transition: 'left 0.016s linear' }}>
          <svg width="58" height="26" viewBox="0 0 58 26" fill="none">
            <defs>
              <linearGradient id="cg3" x1="0" y1="0" x2="58" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8B5CF6" /><stop offset="1" stopColor="#EC4899" />
              </linearGradient>
            </defs>
            <rect x="2" y="11" width="54" height="11" rx="5" fill="url(#cg3)" />
            <path d="M11 11 Q15 2 24 2 L36 2 Q45 2 49 11Z" fill="url(#cg3)" opacity="0.9" />
            <path d="M14 11 Q17 5 24 5 L34 5 Q41 5 44 11Z" fill="#0d0618" opacity="0.65" />
            <circle cx="14" cy="22" r="4.5" fill="#0d0618" stroke="#8B5CF6" strokeWidth="2" />
            <circle cx="42" cy="22" r="4.5" fill="#0d0618" stroke="#EC4899" strokeWidth="2" />
            <ellipse cx="56" cy="15" rx="2.5" ry="1.5" fill="#FCD34D" opacity="0.9" />
            <rect x="1" y="14" width="3" height="4" rx="1" fill="#EF4444" opacity="0.9" />
          </svg>
        </div>
        {carPos > 8 && (
          <div style={{ position: 'absolute', bottom: '24px', left: `${Math.max(0, carPos - 10)}%`, display: 'flex', flexDirection: 'column', gap: '4px', opacity: Math.min(0.7, (carPos - 8) / 25) }}>
            {[16, 24, 14].map((w, i) => (
              <div key={i} style={{ width: `${w}px`, height: '1.5px', background: `linear-gradient(90deg, transparent, rgba(139,92,246,0.7))`, borderRadius: '1px' }} />
            ))}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: '280px' }}>
        <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #8B5CF6, #EC4899, #F59E0B)', borderRadius: '10px', transition: 'width 0.035s linear', boxShadow: '0 0 12px rgba(139,92,246,0.7)' }} />
        </div>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', textAlign: 'center', marginTop: '12px', letterSpacing: '0.1em' }}>
          {progress < 40 ? 'REVVING ENGINE...' : progress < 80 ? 'SYNCING DATA...' : progress < 100 ? 'ALMOST THERE...' : 'READY! ✦'}
        </p>
      </div>
    </div>
  );
};

export default CarTransitionAnimation;
