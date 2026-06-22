import React, { useState, useEffect, useRef } from 'react';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';
import type { Rider } from '@/types';
import { generateId } from '@/lib/supabase';
import { toast } from 'sonner';

// ─── Fee Calculation ────────────────────────────────────────────────────────
// FLW raw fee: ₦10.75 for ≤ ₦2,500; ₦26.88 for ≤ ₦50,000
// User pays: deposit + Math.floor(rawFLWFee)
// FLW deducts full fee incl. kobo → arrived = totalToSend − rawFLWFee
// Admin fee: (deposit / 500) × 20
// Credited = arrived − adminFee

const DEPOSIT_OPTIONS = [500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];

function calcFees(deposit: number) {
  const rawFLWFee = deposit <= 2500 ? 10.75 : 26.88;
  const floorFee = Math.floor(rawFLWFee);
  const totalToSend = deposit + floorFee;
  const arrived = totalToSend - rawFLWFee;
  const adminFee = (deposit / 500) * 20;
  const credited = arrived - adminFee;
  return { rawFLWFee, floorFee, totalToSend, arrived, adminFee, credited };
}

type PaymentStep = 'select' | 'breakdown' | 'bank-transfer' | 'confirming' | 'success' | 'card-confirming';

interface BankSession {
  txRef: string;
  deposit: number;
  totalToSend: number;
  credited: number;
  adminFee: number;
  floorFee: number;
  accountNumber: string;
  bankName: string;
  expiresAt: number;
}

const SESSION_KEY = 'rb_flw_bank_session';
const SESSION_TTL = 2 * 60 * 60 * 1000; // 2 hours

interface Props {
  rider: Rider;
  onSuccess: (newBalance: number, credited: number) => void;
  onBack: () => void;
}

// ── Inner component that uses the Flutterwave hook ───────────────────────────
// The hook must be called at the top level of this component so React rules are satisfied.
const FlutterwavePaymentInner: React.FC<Props & { deposit: number; txRef: string; onCardResult: (response: { status: string; transaction_id: number; tx_ref: string }) => void; onCardClose: () => void; }> = ({
  rider, deposit, txRef, onCardResult, onCardClose,
}) => {
  const fees = calcFees(deposit);
  const initializePayment = useFlutterwave({
    public_key: import.meta.env.VITE_FLW_PUBLIC_KEY || '',
    tx_ref: txRef,
    amount: fees.totalToSend,
    currency: 'NGN',
    payment_options: 'card',
    customer: {
      email: rider.email,
      name: rider.fullName,
      phone_number: rider.phone,
    },
    customizations: {
      title: 'RetroBliss Wallet',
      description: `Deposit ₦${deposit.toLocaleString('en-NG')} to wallet`,
    },
  });

  useEffect(() => {
    initializePayment({
      callback: (response) => {
        closePaymentModal();
        onCardResult(response as { status: string; transaction_id: number; tx_ref: string });
      },
      onClose: onCardClose,
    });
  }, []);

  return null;
};

// ── Main component ────────────────────────────────────────────────────────────
const FlutterwavePayment: React.FC<Props> = ({ rider, onSuccess, onBack }) => {
  const [step, setStep] = useState<PaymentStep>('select');
  const [selectedDeposit, setSelectedDeposit] = useState<number | null>(null);
  const [payMethod, setPayMethod] = useState<'card' | 'bank'>('card');
  const [bankSession, setBankSession] = useState<BankSession | null>(null);
  const [loadingTransfer, setLoadingTransfer] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [pollResult, setPollResult] = useState<'success' | 'timeout' | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ credited: number; newBalance: number } | null>(null);
  const [cardTxRef, setCardTxRef] = useState<string>('');
  const [cardDeposit, setCardDeposit] = useState<number>(0);
  const [showCardModal, setShowCardModal] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore bank session from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const s: BankSession = JSON.parse(raw);
        if (s.expiresAt > Date.now()) {
          setBankSession(s);
          setStep('bank-transfer');
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const fees = selectedDeposit ? calcFees(selectedDeposit) : null;

  const fmt = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtInt = (n: number) => `₦${Math.floor(n).toLocaleString('en-NG')}`;

  // ── Bank transfer ────────────────────────────────────────────────────────
  const handleBankTransfer = async () => {
    if (!selectedDeposit || !fees) return;
    setLoadingTransfer(true);
    try {
      const txRef = `RB-BTR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const res = await fetch('/api/flw/bank-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx_ref: txRef,
          amount: fees.totalToSend,
          email: rider.email,
          fullname: rider.fullName,
        }),
      });
      const data = await res.json();

      if (data.status === 'success' || data.meta?.authorization) {
        const auth = data.meta?.authorization || data.data?.meta?.authorization;
        const accountNumber = auth?.transfer_account || auth?.account_number || '—';
        const bankName = auth?.transfer_bank || auth?.bank_name || 'Any Nigerian Bank';

        const session: BankSession = {
          txRef,
          deposit: selectedDeposit,
          totalToSend: fees.totalToSend,
          credited: fees.credited,
          adminFee: fees.adminFee,
          floorFee: fees.floorFee,
          accountNumber,
          bankName,
          expiresAt: Date.now() + SESSION_TTL,
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        setBankSession(session);
        setStep('bank-transfer');
      } else {
        toast.error(data.message || 'Failed to get transfer account. Try card instead.');
      }
    } catch {
      toast.error('Network error. Check your connection.');
    } finally {
      setLoadingTransfer(false);
    }
  };

  // ── Card payment ─────────────────────────────────────────────────────────
  const handleCardPay = () => {
    if (!selectedDeposit || !fees) return;
    const txRef = `RB-CARD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    setCardTxRef(txRef);
    setCardDeposit(selectedDeposit);
    setShowCardModal(true);
  };

  const handleCardResult = async (response: { status: string; transaction_id: number; tx_ref: string }) => {
    setShowCardModal(false);
    if (response.status === 'successful') {
      setStep('card-confirming');
      await verifyCard(response.transaction_id, response.tx_ref, calcFees(cardDeposit).credited, cardDeposit);
    } else {
      toast.error('Payment was not completed.');
    }
  };

  const handleCardClose = () => {
    setShowCardModal(false);
    toast.info('Payment cancelled.');
  };

  // ── Verify card ──────────────────────────────────────────────────────────
  const verifyCard = async (txId: number, txRef: string, credited: number, deposit: number) => {
    try {
      const res = await fetch(`/api/flw/verify-card/${txId}`);
      const data = await res.json();
      if (data.data?.status === 'successful' && data.data?.tx_ref === txRef) {
        await creditWallet(txRef, credited, deposit);
      } else {
        toast.error('Card payment verification failed. Contact support if charged.');
      }
    } catch {
      toast.error('Verification error. Contact support if money was deducted.');
    }
  };

  // ── Poll verify (bank transfer) ──────────────────────────────────────────
  const startPolling = () => {
    if (!bankSession) return;
    setPollCount(0);
    setPollResult(null);
    setStep('confirming');

    let count = 0;
    pollRef.current = setInterval(async () => {
      count++;
      setPollCount(count);
      try {
        const res = await fetch(`/api/flw/verify-bank/${encodeURIComponent(bankSession.txRef)}`);
        const data = await res.json();
        const txList = data.data;
        if (Array.isArray(txList) && txList[0]?.status === 'successful') {
          clearInterval(pollRef.current!);
          setPollResult('success');
          await creditWallet(bankSession.txRef, bankSession.credited, bankSession.deposit);
          return;
        }
      } catch { /* keep polling */ }

      if (count >= 12) {
        clearInterval(pollRef.current!);
        setPollResult('timeout');
      }
    }, 5000);
  };

  // ── Credit wallet ────────────────────────────────────────────────────────
  const creditWallet = async (txRef: string, credited: number, deposit: number) => {
    try {
      const res = await fetch('/api/flw/credit-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: rider.id,
          creditedAmount: credited,
          depositAmount: deposit,
          txRef,
        }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem(SESSION_KEY);
        setBankSession(null);
        setSuccessInfo({ credited, newBalance: data.newBalance });
        setStep('success');
      } else {
        toast.error('Failed to credit wallet. Contact support with your reference.');
      }
    } catch {
      toast.error('Server error crediting wallet. Contact support.');
    }
  };

  const handleCheckAgain = () => {
    setPollCount(0);
    setPollResult(null);
    startPolling();
  };

  const bgStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#080612',
    fontFamily: "'Poppins', sans-serif",
    overflowY: 'auto',
  };

  const contentStyle: React.CSSProperties = {
    padding: '52px 24px 80px',
    maxWidth: '440px',
    margin: '0 auto',
  };

  const backBtn = (label = 'Top Up Wallet') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
      <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>
      <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: 0 }}>{label}</h2>
    </div>
  );

  // ── SUCCESS ──────────────────────────────────────────────────────────────
  if (step === 'success' && successInfo) {
    return (
      <div style={bgStyle}>
        <div style={contentStyle}>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '72px', marginBottom: '20px', filter: 'drop-shadow(0 0 20px rgba(74,222,128,0.5))' }}>✅</div>
            <h2 style={{ color: 'white', fontSize: '26px', fontWeight: 800, margin: '0 0 8px' }}>Payment Confirmed!</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 28px' }}>Your wallet has been credited</p>
            <div style={{ background: 'linear-gradient(135deg, rgba(74,222,128,0.12), rgba(34,197,94,0.08))', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '24px', padding: '24px', marginBottom: '24px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 8px' }}>Amount Credited</p>
              <p style={{ color: '#4ADE80', fontSize: '40px', fontWeight: 800, margin: '0 0 16px' }}>{fmt(successInfo.credited)}</p>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 4px' }}>New Wallet Balance</p>
                <p style={{ color: 'white', fontSize: '24px', fontWeight: 700, margin: 0 }}>₦{successInfo.newBalance.toLocaleString('en-NG')}</p>
              </div>
            </div>
            <button
              onClick={() => onSuccess(successInfo.newBalance, successInfo.credited)}
              style={{ width: '100%', padding: '18px', borderRadius: '20px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}
            >
              Back to Dashboard 🏠
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── CARD CONFIRMING ──────────────────────────────────────────────────────
  if (step === 'card-confirming') {
    return (
      <div style={bgStyle}>
        <div style={{ ...contentStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div style={{ width: '64px', height: '64px', border: '4px solid rgba(139,92,246,0.2)', borderTopColor: '#8B5CF6', borderRadius: '50%', animation: 'spin-smooth 0.9s linear infinite', marginBottom: '24px' }} />
          <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 700, margin: '0 0 10px', textAlign: 'center' }}>Confirming your payment...</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0, textAlign: 'center' }}>Verifying card payment with Flutterwave…</p>
        </div>
      </div>
    );
  }

  // ── CONFIRMING (bank polling) ─────────────────────────────────────────────
  if (step === 'confirming') {
    return (
      <div style={bgStyle}>
        <div style={{ ...contentStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          {pollResult === null && (
            <>
              <div style={{ width: '64px', height: '64px', border: '4px solid rgba(139,92,246,0.2)', borderTopColor: '#8B5CF6', borderRadius: '50%', animation: 'spin-smooth 0.9s linear infinite', marginBottom: '24px' }} />
              <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 700, margin: '0 0 10px', textAlign: 'center' }}>Confirming your payment...</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '0 0 8px', textAlign: 'center' }}>Checking payment status ({pollCount}/12)...</p>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', margin: 0, textAlign: 'center' }}>Do not close this screen</p>
            </>
          )}
          {pollResult === 'timeout' && (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <div style={{ fontSize: '56px', marginBottom: '20px' }}>⏳</div>
              <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: '0 0 10px' }}>Payment not detected yet</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '0 0 28px' }}>If you've sent the money, tap "Check Again" — it may take a few minutes to arrive.</p>
              <button onClick={handleCheckAgain} style={{ width: '100%', padding: '18px', borderRadius: '20px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", marginBottom: '12px' }}>
                🔄 Check Again
              </button>
              <button onClick={() => { setBankSession(null); localStorage.removeItem(SESSION_KEY); setStep('select'); }} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── BANK TRANSFER SCREEN ─────────────────────────────────────────────────
  if (step === 'bank-transfer' && bankSession) {
    const minutesLeft = Math.max(0, Math.round((bankSession.expiresAt - Date.now()) / 60000));
    return (
      <div style={bgStyle}>
        <div style={contentStyle}>
          {backBtn('Bank Transfer')}

          <div style={{ background: 'rgba(255,191,0,0.06)', border: '1.5px solid rgba(255,191,0,0.35)', borderRadius: '18px', padding: '14px 18px', marginBottom: '20px' }}>
            <p style={{ color: '#FCD34D', fontSize: '13px', fontWeight: 700, margin: '0 0 4px' }}>⚠️ IMPORTANT — Send the EXACT amount</p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', margin: 0, lineHeight: 1.6 }}>
              Transfer <strong style={{ color: 'white' }}>exactly {fmtInt(bankSession.totalToSend)}</strong> — not ₦{bankSession.deposit.toLocaleString('en-NG')} or any other amount. Wrong amounts cannot be processed.
            </p>
          </div>

          <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(236,72,153,0.08))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '24px', padding: '24px', marginBottom: '20px' }}>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 6px' }}>Bank Name</p>
            <p style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: '0 0 20px' }}>{bankSession.bankName}</p>

            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 6px' }}>Account Number</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <p style={{ color: '#C4B5FD', fontSize: '28px', fontWeight: 800, margin: 0, letterSpacing: '0.04em', flex: 1 }}>{bankSession.accountNumber}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(bankSession.accountNumber); toast.success('Account number copied!'); }}
                style={{ padding: '8px 14px', borderRadius: '12px', background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#C4B5FD', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: "'Poppins', sans-serif", flexShrink: 0 }}
              >
                📋 Copy
              </button>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              {[
                { label: 'Send exactly', value: fmtInt(bankSession.totalToSend), color: 'white', bold: true },
                { label: 'You will receive', value: fmt(bankSession.credited), color: '#4ADE80', bold: true },
                { label: 'Flutterwave fee included', value: fmtInt(bankSession.floorFee), color: 'rgba(255,255,255,0.35)', bold: false },
                { label: 'Admin fee', value: fmtInt(bankSession.adminFee), color: 'rgba(255,255,255,0.35)', bold: false },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>{r.label}</span>
                  <span style={{ color: r.color, fontSize: r.bold ? '15px' : '13px', fontWeight: r.bold ? 700 : 400 }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>Expires in ~{minutesLeft} min</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>Ref: {bankSession.txRef.slice(-12)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={startPolling}
            style={{ width: '100%', padding: '18px', borderRadius: '20px', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", marginBottom: '12px' }}
          >
            ✅ I've Sent the Money
          </button>
          <button
            onClick={() => { setBankSession(null); localStorage.removeItem(SESSION_KEY); setStep('select'); }}
            style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}
          >
            Cancel Transfer
          </button>
        </div>
      </div>
    );
  }

  // ── BREAKDOWN ────────────────────────────────────────────────────────────
  if (step === 'breakdown' && selectedDeposit && fees) {
    return (
      <div style={bgStyle}>
        {/* Card payment modal — rendered when showCardModal is true */}
        {showCardModal && (
          <FlutterwavePaymentInner
            rider={rider}
            deposit={cardDeposit}
            txRef={cardTxRef}
            onCardResult={handleCardResult}
            onCardClose={handleCardClose}
            onSuccess={onSuccess}
            onBack={onBack}
          />
        )}
        <div style={contentStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
            <button onClick={() => setStep('select')} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}>← Back</button>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: 0 }}>Payment Breakdown</h2>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '24px', marginBottom: '24px' }}>
            {[
              { label: 'Deposit amount', value: `₦${selectedDeposit.toLocaleString('en-NG')}`, color: 'white', bold: false },
              { label: 'Flutterwave fee', value: fmtInt(fees.floorFee), color: 'rgba(255,255,255,0.6)', bold: false, note: '(shown as whole naira)' },
              { label: 'Admin fee', value: fmtInt(fees.adminFee), color: 'rgba(255,255,255,0.6)', bold: false },
              { label: 'Total to send', value: fmtInt(fees.totalToSend), color: '#C4B5FD', bold: true },
              { label: 'Amount you will receive', value: fmt(fees.credited), color: '#4ADE80', bold: true },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                  {row.label}
                  {'note' in row && row.note && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}> {row.note}</span>}
                </span>
                <span style={{ color: row.color, fontSize: row.bold ? '16px' : '14px', fontWeight: row.bold ? 700 : 500 }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Payment method */}
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 700, margin: '0 0 10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Choose payment method</p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            {(['card', 'bank'] as const).map(m => (
              <button key={m} onClick={() => setPayMethod(m)} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: payMethod === m ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${payMethod === m ? '#8B5CF6' : 'rgba(255,255,255,0.08)'}`, color: payMethod === m ? '#C4B5FD' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {m === 'card' ? '💳 Card' : '🏦 Bank Transfer'}
              </button>
            ))}
          </div>

          <button
            onClick={() => { if (payMethod === 'bank') handleBankTransfer(); else handleCardPay(); }}
            disabled={loadingTransfer}
            style={{ width: '100%', padding: '18px', borderRadius: '20px', background: loadingTransfer ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg, #8B5CF6, #EC4899)', border: 'none', color: 'white', fontSize: '16px', fontWeight: 700, cursor: loadingTransfer ? 'not-allowed' : 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            {loadingTransfer
              ? <><div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} /> Getting Account...</>
              : payMethod === 'bank' ? '🏦 Get Transfer Account' : `💳 Pay ${fmtInt(fees.totalToSend)}`
            }
          </button>
        </div>
      </div>
    );
  }

  // ── SELECT AMOUNT ────────────────────────────────────────────────────────
  return (
    <div style={bgStyle}>
      {/* Card modal rendered at root so hook is always valid */}
      {showCardModal && cardTxRef && cardDeposit > 0 && (
        <FlutterwavePaymentInner
          rider={rider}
          deposit={cardDeposit}
          txRef={cardTxRef}
          onCardResult={handleCardResult}
          onCardClose={handleCardClose}
          onSuccess={onSuccess}
          onBack={onBack}
        />
      )}
      <div style={contentStyle}>
        {backBtn()}

        {/* Balance card */}
        <div style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)', borderRadius: '28px', padding: '28px', marginBottom: '28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 600, margin: '0 0 8px', letterSpacing: '0.06em' }}>WALLET BALANCE</p>
          <p style={{ color: 'white', fontSize: '36px', fontWeight: 800, margin: 0 }}>₦{rider.walletBalance?.toLocaleString('en-NG') || '0'}</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '4px 0 0' }}>Non-withdrawable · Used for rides only</p>
        </div>

        <h3 style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: '0 0 16px' }}>Select Deposit Amount</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
          {DEPOSIT_OPTIONS.map(amt => (
            <button
              key={amt}
              onClick={() => setSelectedDeposit(amt)}
              style={{
                padding: '14px 6px',
                borderRadius: '16px',
                background: selectedDeposit === amt ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${selectedDeposit === amt ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                color: 'white',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.15s ease',
              }}
            >
              ₦{amt.toLocaleString('en-NG')}
            </button>
          ))}
        </div>

        {selectedDeposit && fees && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', padding: '14px 18px', marginBottom: '20px' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700, margin: '0 0 8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Quick Summary</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>You pay</span>
              <span style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>{fmtInt(fees.totalToSend)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>You receive</span>
              <span style={{ color: '#4ADE80', fontSize: '14px', fontWeight: 700 }}>{fmt(fees.credited)}</span>
            </div>
          </div>
        )}

        <button
          onClick={() => { if (selectedDeposit) setStep('breakdown'); else toast.error('Please select a deposit amount.'); }}
          style={{ width: '100%', padding: '18px', borderRadius: '20px', background: selectedDeposit ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(255,255,255,0.08)', border: 'none', color: selectedDeposit ? 'white' : 'rgba(255,255,255,0.3)', fontSize: '16px', fontWeight: 700, cursor: selectedDeposit ? 'pointer' : 'not-allowed', fontFamily: "'Poppins', sans-serif" }}
        >
          Continue →
        </button>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', textAlign: 'center', marginTop: '12px' }}>
          Powered by Flutterwave · Card &amp; Bank Transfer · Secure
        </p>
      </div>
    </div>
  );
};

export default FlutterwavePayment;
