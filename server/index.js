import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const FLW_SECRET = process.env.FLW_SECRET_KEY;
const FLW_BASE = 'https://api.flutterwave.com/v3';
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const flw = async (method, path, body) => {
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

// POST /api/flw/bank-transfer — initiate bank transfer
app.post('/api/flw/bank-transfer', async (req, res) => {
  try {
    const { tx_ref, amount, email, fullname } = req.body;
    const data = await flw('POST', '/charges?type=bank_transfer', {
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

// GET /api/flw/verify-bank/:tx_ref — verify bank transfer
app.get('/api/flw/verify-bank/:tx_ref', async (req, res) => {
  try {
    const data = await flw('GET', `/transactions?tx_ref=${encodeURIComponent(req.params.tx_ref)}`);
    res.json(data);
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /api/flw/verify-card/:id — verify card payment
app.get('/api/flw/verify-card/:id', async (req, res) => {
  try {
    const data = await flw('GET', `/transactions/${req.params.id}/verify`);
    res.json(data);
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// POST /api/flw/credit-wallet — credit rider wallet after confirmed payment
app.post('/api/flw/credit-wallet', async (req, res) => {
  try {
    const { riderId, creditedAmount, depositAmount, txRef } = req.body;

    const { data: rider } = await supabase
      .from('rb_riders')
      .select('wallet_balance')
      .eq('id', riderId)
      .single();

    const newBalance = Number(rider?.wallet_balance || 0) + Number(creditedAmount);

    await supabase
      .from('rb_riders')
      .update({ wallet_balance: newBalance })
      .eq('id', riderId);

    const txId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
    await supabase.from('rb_transactions').insert({
      id: txId,
      user_id: riderId,
      user_role: 'rider',
      type: 'credit',
      amount: creditedAmount,
      description: `Wallet top-up via Flutterwave (deposit ₦${Number(depositAmount).toLocaleString('en-NG')})`,
      reference: txRef,
      created_at: new Date().toISOString(),
    });

    res.json({ success: true, newBalance });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.listen(3001, 'localhost', () => {
  console.log('[RetroBliss] Payment server running on port 3001');
});
