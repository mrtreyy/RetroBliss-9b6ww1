
import React, { useState, useEffect } from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ContactSetting {
  id: string;
  platform: string;
  label: string;
  value: string;
  is_active: boolean;
}

interface ContactOfficialsProps {
  onBack: () => void;
}

const PLATFORM_ICONS: Record<string, { icon: string; color: string; prefix: string }> = {
  whatsapp: { icon: '💬', color: '#25D366', prefix: 'https://wa.me/' },
  telegram: { icon: '✈️', color: '#2AABEE', prefix: 'https://t.me/' },
  instagram: { icon: '📸', color: '#E1306C', prefix: 'https://instagram.com/' },
  twitter: { icon: '🐦', color: '#1DA1F2', prefix: 'https://twitter.com/' },
  email: { icon: '📧', color: '#8B5CF6', prefix: 'mailto:' },
  phone: { icon: '📞', color: '#4ADE80', prefix: 'tel:' },
  facebook: { icon: '👥', color: '#1877F2', prefix: 'https://facebook.com/' },
  youtube: { icon: '▶️', color: '#FF0000', prefix: 'https://youtube.com/' },
  tiktok: { icon: '🎵', color: '#69C9D0', prefix: 'https://tiktok.com/@' },
  linkedin: { icon: '💼', color: '#0A66C2', prefix: 'https://linkedin.com/in/' },
};

const ContactOfficials: React.FC<ContactOfficialsProps> = ({ onBack }) => {
  const [contacts, setContacts] = useState<ContactSetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContacts();
    // Poll for updates every 30s
    const poll = setInterval(fetchContacts, 30000);
    return () => clearInterval(poll);
  }, []);

  const fetchContacts = async () => {
    const { data } = await supabase.from('rb_contact_settings').select('*').eq('is_active', true).order('created_at');
    if (data) setContacts(data as ContactSetting[]);
    setLoading(false);
  };

  const handleContact = (contact: ContactSetting) => {
    const info = PLATFORM_ICONS[contact.platform.toLowerCase()];
    if (!info) {
      toast.info(`Contact via ${contact.label}: ${contact.value}`);
      return;
    }

    let url = '';
    if (contact.platform.toLowerCase() === 'whatsapp') {
      const cleaned = contact.value.replace(/\D/g, '');
      url = `https://wa.me/${cleaned}`;
    } else if (contact.platform.toLowerCase() === 'email') {
      url = `mailto:${contact.value}`;
    } else if (contact.platform.toLowerCase() === 'phone') {
      url = `tel:${contact.value}`;
    } else {
      url = contact.value.startsWith('http') ? contact.value : `${info.prefix}${contact.value}`;
    }

    window.open(url, '_blank');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif", overflowY: 'auto' }}>
      <div style={{ padding: '52px 24px 60px', maxWidth: '440px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 14px', color: 'white', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}>←</button>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: 0 }}>Contact Officials</h2>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <RetroBlissLogo size={60} />
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '20px', marginBottom: '24px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
            Reach the RetroBliss team directly through any of the official channels below. We're available to address your concerns, feedback, and inquiries.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(139,92,246,0.2)', borderTopColor: '#8B5CF6', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: '48px', margin: '0 0 12px' }}>📭</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No contact details set yet.</p>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', marginTop: '8px' }}>The CEO hasn't configured contact channels yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {contacts.map(contact => {
              const info = PLATFORM_ICONS[contact.platform.toLowerCase()];
              return (
                <button key={contact.id} onClick={() => handleContact(contact)} style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: '20px', padding: '16px 18px',
                  cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
                  textAlign: 'left', transition: 'all 0.2s ease',
                  width: '100%',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: `${info?.color || '#8B5CF6'}22`, border: `1px solid ${info?.color || '#8B5CF6'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                    {info?.icon || '🔗'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'white', fontSize: '15px', fontWeight: 600, margin: '0 0 3px' }}>{contact.label}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>{contact.value}</p>
                  </div>
                  <span style={{ color: info?.color || '#8B5CF6', fontSize: '18px' }}>›</span>
                </button>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '28px' }}>
          RetroBliss Official Support · Available 24/7
        </p>
      </div>
    </div>
  );
};

export default ContactOfficials;
