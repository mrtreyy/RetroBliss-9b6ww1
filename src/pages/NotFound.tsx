import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0618', fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 800, background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 8px' }}>404</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', marginBottom: '24px' }}>Page not found</p>
        <a href="/" style={{ padding: '12px 28px', borderRadius: '14px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', color: 'white', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
          Return to RetroBliss
        </a>
      </div>
    </div>
  );
};

export default NotFound;
