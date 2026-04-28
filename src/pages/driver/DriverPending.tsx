import React, { useEffect, useState } from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';
import { supabase, sendNotification, generateId } from '@/lib/supabase';
import type { Driver } from '@/types';
import { toast } from 'sonner';

interface DriverPendingProps {
  driver: Driver | null;
  onLogout: () => void;
  onCheckStatus: (driver: Driver) => void;
}

const DriverPending: React.FC<DriverPendingProps> = ({ driver, onLogout, onCheckStatus }) => {
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    if (!driver) return;

    // Poll every 8 seconds for status change
    const interval = setInterval(async () => {
      const { data } = await supabase.from('rb_drivers').select('*').eq('id', driver.id).single();
      if (!data) return;

      if (data.status === 'active') {
        clearInterval(interval);
        const updated: Driver = {
          ...driver,
          status: 'active',
          walletBalance: data.wallet_balance,
        };
        onCheckStatus(updated);
      } else if (data.status === 'declined') {
        clearInterval(interval);
        const updated: Driver = {
          ...driver,
          status: 'declined',
          declineReason: data.decline_reason,
        };
        onCheckStatus(updated);
      }
    }, 8000);

    // Real-time subscription
    const channel = supabase
      .channel(`driver-status-${driver.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rb_drivers',
        filter: `id=eq.${driver.id}`,
      }, (payload) => {
        const d = payload.new as { status: string; decline_reason?: string; wallet_balance: number };
        if (d.status === 'active') {
          clearInterval(interval);
          onCheckStatus({ ...driver, status: 'active', walletBalance: d.wallet_balance });
        } else if (d.status === 'declined') {
          clearInterval(interval);
          onCheckStatus({ ...driver, status: 'declined', declineReason: d.decline_reason });
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [driver, onCheckStatus]);

  const handleManualCheck = async () => {
    if (!driver) return;
    setCheckingStatus(true);
    const { data } = await supabase.from('rb_drivers').select('*').eq('id', driver.id).single();
    setCheckingStatus(false);
    if (!data) { toast.error('Could not check status'); return; }
    if (data.status === 'active') {
      toast.success('Your account has been approved! 🎉');
      onCheckStatus({ ...driver, status: 'active', walletBalance: data.wallet_balance });
    } else if (data.status === 'declined') {
      toast.error('Your application was declined.');
      onCheckStatus({ ...driver, status: 'declined', declineReason: data.decline_reason });
    } else {
      toast.info('Still pending review. Check back soon!');
    }
  };

  if (!driver) return null;

  if (driver.status === 'declined') {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #1a0808 0%, #0d0618 45%, #080612 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ animation: 'scaleIn 0.5s ease', textAlign: 'center', maxWidth: '360px', width: '100%' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', margin: '0 auto 20px' }}>❌</div>
          <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 800, margin: '0 0 8px' }}>Application Declined</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: 1.6, margin: '0 0 20px' }}>Unfortunately your driver application was not approved at this time.</p>
          {driver.declineReason && (
            <div className="glass" style={{ borderRadius: '18px', padding: '16px', marginBottom: '20px', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'left' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 6px' }}>REASON FROM CEO:</p>
              <p style={{ color: '#FCA5A5', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>{driver.declineReason}</p>
            </div>
          )}
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', marginBottom: '24px' }}>You may sign up again with corrected information.</p>
          <button onClick={onLogout} style={{ width: '100%', padding: '16px', borderRadius: '20px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #1a1208 0%, #0d0618 45%, #080612 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', fontFamily: "'Poppins', sans-serif", position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)', pointerEvents: 'none', animation: 'glow-pulse 4s ease-in-out infinite' }} />

      <div style={{ animation: 'fadeInUp 0.6s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '380px', width: '100%' }}>
        <RetroBlissLogo size={70} showTagline={false} />

        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', margin: '28px 0 20px', animation: 'float 3s ease-in-out infinite' }}>
          ⏳
        </div>

        <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 800, margin: '0 0 8px', textAlign: 'center' }}>Application Under Review</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textAlign: 'center', lineHeight: 1.7, margin: '0 0 28px', maxWidth: '300px' }}>
          Hi <strong style={{ color: '#FCD34D' }}>{driver.fullName.split(' ')[0]}</strong>! Your application is being reviewed by our CEO. You'll be notified once approved.
        </p>

        <div className="glass" style={{ borderRadius: '22px', padding: '20px', width: '100%', marginBottom: '20px' }}>
          {[
            { label: 'Full Name', value: driver.fullName },
            { label: 'Vehicle', value: `${driver.vehicleYear} ${driver.vehicleMake} ${driver.vehicleModel}` },
            { label: 'Plate', value: driver.vehiclePlate },
            { label: 'Phone', value: driver.phone },
            { label: 'Status', value: '⏳ Pending CEO Approval' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</span>
              <span style={{ color: item.label === 'Status' ? '#F59E0B' : 'white', fontSize: '13px', fontWeight: 500, maxWidth: '55%', textAlign: 'right' }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', animation: 'ping-ring 1.5s ease-in-out infinite', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#F59E0B', animation: 'ping-ring 1.5s ease-in-out infinite' }} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0 }}>Auto-checking status every 8 seconds</p>
        </div>

        <button onClick={handleManualCheck} disabled={checkingStatus} className="btn-gradient" style={{ width: '100%', padding: '15px', borderRadius: '18px', fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: checkingStatus ? 0.7 : 1 }}>
          {checkingStatus ? <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} /> Checking...</> : '🔄 Check Status Now'}
        </button>

        <button onClick={onLogout} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '14px', padding: '12px 28px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px', fontFamily: "'Poppins', sans-serif" }}>
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default DriverPending;
