import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const FLW_SECRET = process.env.FLW_SECRET_KEY;
const FLW_BASE = 'https://api.flutterwave.com/v3';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const flwFetch = async (method, path, body) => {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${FLW_SECRET}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${FLW_BASE}${path}`, opts);
  return r.json();
};

const sbFetch = async (method, path, body) => {
  const opts = {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=minimal' : '',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, opts);
  if (r.status === 204 || r.headers.get('content-length') === '0') return null;
  return r.json();
};

// POST /api/flw/bank-transfer — initiate bank transfer
app.post('/api/flw/bank-transfer', async (req, res) => {
  try {
    const { tx_ref, amount, email, fullname } = req.body;
    const data = await flwFetch('POST', '/charges?type=bank_transfer', {
      tx_ref: String(tx_ref),
      amount: String(amount),
      email,
      currency: 'NGN',
      fullname,
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /api/flw/verify-bank/:tx_ref
app.get('/api/flw/verify-bank/:tx_ref', async (req, res) => {
  try {
    const data = await flwFetch('GET', `/transactions?tx_ref=${encodeURIComponent(req.params.tx_ref)}`);
    res.json(data);
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /api/flw/verify-card/:id
app.get('/api/flw/verify-card/:id', async (req, res) => {
  try {
    const data = await flwFetch('GET', `/transactions/${req.params.id}/verify`);
    res.json(data);
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /api/flw/credit-wallet — credit rider wallet after confirmed payment
app.post('/api/flw/credit-wallet', async (req, res) => {
  try {
    const { riderId, creditedAmount, depositAmount, txRef } = req.body;

    // Get current balance
    const riders = await sbFetch('GET', `/rb_riders?id=eq.${riderId}&select=wallet_balance`);
    const currentBalance = Number(riders?.[0]?.wallet_balance || 0);
    const newBalance = currentBalance + Number(creditedAmount);

    // Update balance
    await sbFetch('PATCH', `/rb_riders?id=eq.${riderId}`, { wallet_balance: newBalance });

    // Insert transaction
    const txId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
    await sbFetch('POST', '/rb_transactions', {
      id: txId,
      user_id: riderId,
      user_role: 'rider',
      type: 'credit',
      amount: Number(creditedAmount),
      description: `Wallet top-up via Flutterwave (deposit ₦${Number(depositAmount).toLocaleString('en-NG')})`,
      reference: txRef,
      created_at: new Date().toISOString(),
    });

    res.json({ success: true, newBalance });
  } catch (e) {
    console.error('credit-wallet error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.listen(3001, '0.0.0.0', () => {
  console.log('[RetroBliss] Payment server running on port 3001');
});
