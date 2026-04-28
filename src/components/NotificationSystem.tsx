import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface NotifBanner {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface NotificationSystemProps {
  userId: string;
  userRole: string;
}

// Global notification queue
let globalAddNotif: ((n: NotifBanner) => void) | null = null;

export function showNotification(title: string, message: string, type: NotifBanner['type'] = 'info') {
  if (globalAddNotif) {
    globalAddNotif({ id: `${Date.now()}`, title, message, type });
  }
}

const typeColors: Record<string, string> = {
  info: 'linear-gradient(135deg, rgba(139,92,246,0.95), rgba(99,58,206,0.95))',
  success: 'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(16,151,76,0.95))',
  warning: 'linear-gradient(135deg, rgba(245,158,11,0.95), rgba(202,119,0,0.95))',
  error: 'linear-gradient(135deg, rgba(239,68,68,0.95), rgba(185,28,28,0.95))',
};

const typeIcons: Record<string, string> = {
  info: '🔔',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

const NotificationSystem: React.FC<NotificationSystemProps> = ({ userId, userRole }) => {
  const [banners, setBanners] = useState<NotifBanner[]>([]);

  const addBanner = useCallback((n: NotifBanner) => {
    setBanners(prev => [...prev.slice(-2), n]);
    setTimeout(() => {
      setBanners(prev => prev.filter(b => b.id !== n.id));
    }, 5000);
  }, []);

  useEffect(() => {
    globalAddNotif = addBanner;
    return () => { globalAddNotif = null; };
  }, [addBanner]);

  // Subscribe to real-time notifications for this user
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifs-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rb_notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const n = payload.new as { id: string; title: string; message: string };
        addBanner({ id: n.id, title: n.title, message: n.message, type: 'info' });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, addBanner]);

  if (banners.length === 0) return null;

  return (
    <>
      {banners.map((banner, i) => (
        <div
          key={banner.id}
          className="notif-banner"
          style={{ top: `${16 + i * 80}px` }}
          onClick={() => setBanners(prev => prev.filter(b => b.id !== banner.id))}
        >
          <div style={{
            background: typeColors[banner.type || 'info'],
            borderRadius: '20px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            cursor: 'pointer',
          }}>
            <span style={{ fontSize: '22px', flexShrink: 0 }}>{typeIcons[banner.type || 'info']}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'white', fontSize: '13px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{banner.title}</p>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', margin: '2px 0 0', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{banner.message}</p>
            </div>
            <button
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              onClick={e => { e.stopPropagation(); setBanners(prev => prev.filter(b => b.id !== banner.id)); }}
            >✕</button>
          </div>
        </div>
      ))}
    </>
  );
};

export default NotificationSystem;
