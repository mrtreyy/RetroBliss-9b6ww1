
import React from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';

interface AboutPageProps {
  onBack: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  return (
    <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif", overflowY: 'auto' }}>
      <div style={{ padding: '52px 24px 60px', maxWidth: '440px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 14px', color: 'white', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}>←</button>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: 0 }}>About RetroBliss</h2>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <RetroBlissLogo size={80} showTagline />
        </div>

        {/* Hero */}
        <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.1))', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '24px', padding: '24px', marginBottom: '24px', textAlign: 'center' }}>
          <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 800, margin: '0 0 10px', background: 'linear-gradient(135deg, #A78BFA, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Nigeria's Premium Ride-Hailing Platform
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>
            Safe. Fast. Reliable. Built for Nigeria.
          </p>
        </div>

        {/* About text */}
        {[
          {
            title: '🚗 Our Story',
            text: "RetroBliss was founded with a singular mission: to transform how Nigerians move from one place to another. Born from the need for a safe, reliable, and premium ride-hailing experience, RetroBliss bridges the gap between discerning riders and professional drivers across Nigeria's bustling cities and towns."
          },
          {
            title: '🛡️ Safety First',
            text: "At RetroBliss, safety isn't an afterthought — it's our foundation. Every driver on our platform undergoes a rigorous vetting and approval process, including identity verification, vehicle inspection, and background review by our administrative team. Riders can track their trips in real-time, share trip details, and access our one-tap SOS emergency feature at any point during their journey."
          },
          {
            title: '⚡ Technology-Driven',
            text: "Powered by real-time GPS technology, RetroBliss provides live location tracking for all active rides. Our intelligent ride-matching system instantly connects riders with the nearest available driver, reducing wait times to under 10 minutes on average. Our platform supports real-time wallet updates, instant payment processing, and live notifications across all devices."
          },
          {
            title: '💰 Fair & Transparent',
            text: "We believe in transparency. RetroBliss operates on a clear commission model — drivers retain the majority of their earnings, while a platform maintenance fee supports continuous improvement of our infrastructure, driver support, and safety systems. Riders are always informed of their fare before confirming a booking."
          },
          {
            title: '🌍 Built for Nigeria',
            text: "RetroBliss is designed specifically for Nigerian roads, cities, and users. Our location system covers every state, LGA, city, landmark, and neighbourhood across the country. From the busy streets of Lagos to the expansive layouts of Abuja, the coastal roads of Port Harcourt to the commercial hubs of Kano — RetroBliss has you covered."
          },
          {
            title: '📱 Available Everywhere',
            text: "RetroBliss is a Progressive Web App (PWA), meaning it can be installed on any iOS or Android device directly from your browser — no app store download required. It works seamlessly on mobile and desktop, with an experience designed to feel native, smooth, and premium on any screen size."
          },
          {
            title: '🤝 Our Promise',
            text: "We promise every RetroBliss user — rider or driver — a platform built on trust, speed, and care. Our 24/7 support team is always available through the in-app chat, ready to resolve any concern promptly. We are committed to continuously improving your experience and expanding our services across Nigeria."
          },
        ].map(section => (
          <div key={section.title} style={{ marginBottom: '20px' }}>
            <h4 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 8px' }}>{section.title}</h4>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.75, margin: 0 }}>{section.text}</p>
          </div>
        ))}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
          {[
            { value: '50K+', label: 'Rides Completed' },
            { value: '4.9⭐', label: 'Avg Rating' },
            { value: '1K+', label: 'Active Drivers' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
              <p style={{ color: '#C4B5FD', fontSize: '17px', fontWeight: 800, margin: '0 0 4px' }}>{stat.value}</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', margin: 0 }}>{stat.label}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: '0 0 4px', letterSpacing: '0.08em' }}>RETROBLISS TECHNOLOGY LTD</p>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', margin: 0 }}>Nigeria's Premium Ride Experience · v2.0</p>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
