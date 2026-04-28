import React, { useState, useEffect } from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';
import type { Rider } from '@/types';

interface RiderOnboardingProps {
  rider: Rider | null;
  onComplete: () => void;
}

const slides = [
  {
    icon: '🛡️',
    title: 'Your Safety\nComes First',
    subtitle: 'Every driver is verified',
    description: 'All RetroBliss drivers undergo thorough background checks, vehicle inspections, and CEO approval before they can accept rides. Your safety is our top priority.',
    gradient: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,58,206,0.1))',
    accent: '#8B5CF6',
    features: ['CEO-verified drivers', 'Live ride tracking', 'Emergency SOS button', 'Trip sharing'],
  },
  {
    icon: '⚡',
    title: 'Smooth &\nFast Pickups',
    subtitle: 'On time, every time',
    description: 'Get matched with the nearest driver in seconds. Real-time GPS tracking shows you exactly where your driver is, from the moment they accept your request.',
    gradient: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(168,36,96,0.1))',
    accent: '#EC4899',
    features: ['Real-time GPS tracking', 'Instant driver matching', 'Live ETA updates', 'Route optimization'],
  },
  {
    icon: '💳',
    title: 'Pay Your\nWay',
    subtitle: 'Fast, secure payments',
    description: 'Fund your RetroBliss wallet instantly via bank transfer. Pay for rides directly from your wallet — no cash needed. Track every transaction in real time.',
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(202,119,0,0.1))',
    accent: '#F59E0B',
    features: ['Instant wallet funding', 'Cashless payments', 'Transaction history', 'Transfer to drivers'],
  },
];

const RiderOnboarding: React.FC<RiderOnboardingProps> = ({ rider, onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goToNext = () => {
    if (currentSlide < slides.length - 1) {
      setAnimating(true);
      setTimeout(() => {
        setCurrentSlide(prev => prev + 1);
        setAnimating(false);
      }, 200);
    } else {
      onComplete();
    }
  };

  const slide = slides[currentSlide];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080612',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Poppins', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '350px', height: '350px', borderRadius: '50%', background: `radial-gradient(circle, ${slide.accent}22 0%, transparent 65%)`, transition: 'all 0.5s ease', pointerEvents: 'none' }} />

      {/* Skip button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '52px 24px 0' }}>
        <button onClick={onComplete} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '8px 20px', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>
          Skip
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 32px', opacity: animating ? 0 : 1, transform: animating ? 'translateY(16px)' : 'translateY(0)', transition: 'opacity 0.2s ease, transform 0.2s ease' }}>
        {/* Slide count */}
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em', margin: '0 0 32px' }}>
          {currentSlide + 1} OF {slides.length}
        </p>

        {/* Icon */}
        <div style={{ width: '100px', height: '100px', borderRadius: '32px', background: slide.gradient, border: `1.5px solid ${slide.accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', marginBottom: '32px', animation: 'float 4s ease-in-out infinite', boxShadow: `0 0 40px ${slide.accent}25` }}>
          {slide.icon}
        </div>

        {/* Badge */}
        <div style={{ background: `${slide.accent}22`, border: `1px solid ${slide.accent}44`, borderRadius: '20px', padding: '6px 16px', marginBottom: '20px' }}>
          <span style={{ color: slide.accent, fontSize: '12px', fontWeight: 700 }}>{slide.subtitle}</span>
        </div>

        {/* Title */}
        <h2 style={{ color: 'white', fontSize: '32px', fontWeight: 800, textAlign: 'center', margin: '0 0 16px', lineHeight: 1.2, whiteSpace: 'pre-line' }}>{slide.title}</h2>

        {/* Description */}
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textAlign: 'center', lineHeight: 1.7, margin: '0 0 32px', maxWidth: '320px' }}>{slide.description}</p>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', maxWidth: '340px' }}>
          {slide.features.map(f => (
            <div key={f} className="glass" style={{ borderRadius: '14px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: slide.accent, flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', fontWeight: 500, lineHeight: 1.3 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dots + CTA */}
      <div style={{ padding: '0 32px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              style={{
                width: i === currentSlide ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: i === currentSlide ? slide.accent : 'rgba(255,255,255,0.2)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              }}
            />
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={goToNext}
          style={{ width: '100%', maxWidth: '380px', padding: '18px', borderRadius: '22px', background: currentSlide < slides.length - 1 ? `linear-gradient(135deg, ${slide.accent}, ${slide.accent}cc)` : 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", boxShadow: `0 8px 32px ${slide.accent}50`, transition: 'all 0.3s ease' }}
        >
          {currentSlide < slides.length - 1 ? 'Next →' : `Let's Ride, ${rider?.fullName?.split(' ')[0] || 'Rider'}! 🚀`}
        </button>
      </div>
    </div>
  );
};

export default RiderOnboarding;
