import React from 'react';
import logoImg from '@/assets/retrobliss-logo.jpg';

interface RetroBlissLogoProps {
  size?: number;
  showTagline?: boolean;
  className?: string;
}

const RetroBlissLogo: React.FC<RetroBlissLogoProps> = ({ size = 80, showTagline = true, className = '' }) => {
  // We use the actual logo image exactly as provided
  // The image already contains the "R" mark + "RetroBliss" wordmark + tagline
  // We crop to show just the icon part or the full logo based on showTagline

  if (showTagline) {
    // Show full logo image
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img
          src={logoImg}
          alt="RetroBliss"
          style={{
            width: size * 2.2,
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '12px',
            maxWidth: '320px',
          }}
          draggable={false}
        />
      </div>
    );
  }

  // Show just the "R" icon portion (top square portion of the logo)
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: size,
        height: size,
        borderRadius: '22%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: '#0d0d1f',
        boxShadow: '0 0 24px rgba(139,92,246,0.35)',
      }}>
        <img
          src={logoImg}
          alt="RetroBliss"
          style={{
            width: '100%',
            height: 'auto',
            objectFit: 'cover',
            objectPosition: 'top center',
            transform: 'scale(1.15) translateY(-2%)',
          }}
          draggable={false}
        />
      </div>
    </div>
  );
};

export default RetroBlissLogo;
