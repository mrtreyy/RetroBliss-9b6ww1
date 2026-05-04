
import React, { useState, useEffect, useRef } from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';
import { supabase, generateId, sendNotification } from '@/lib/supabase';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  user_id: string;
  user_role: string;
  user_name: string;
  sender: 'user' | 'support' | 'ceo';
  message: string;
  read: boolean;
  created_at: string;
}

const SUPPORT_RESPONSES: Record<string, string> = {
  'ride': "I can help you with your ride inquiry. Could you provide more details about the issue? I've logged your concern and our team will review it shortly.",
  'payment': "For payment issues, please ensure your wallet has sufficient funds. If you were incorrectly charged, provide your ride ID and we'll investigate immediately. Your complaint has been logged.",
  'driver': "We take driver behavior seriously at RetroBliss. I've logged your feedback about this driver. Our team will review the report and take appropriate action within 24 hours.",
  'cancel': "For ride cancellation inquiries, your refund (if applicable) should reflect in your wallet within a few minutes. If not, please provide your ride reference. Complaint logged.",
  'wallet': "For wallet issues including top-ups not reflecting, please provide your transaction reference number. We'll escalate this immediately. Your complaint has been logged.",
  'account': "For account-related issues, our support team has been notified. Please note that account changes may require identity verification. Your request has been logged.",
  'refund': "Refund requests are processed within 1-3 business hours. Your request has been logged and flagged as priority. You'll receive a notification once processed.",
  'safety': "🚨 SAFETY CONCERN LOGGED. This has been escalated to our safety team as HIGH PRIORITY. If you're in immediate danger, please call emergency services (199). We take safety seriously.",
  'late': "We apologize for the delay. I've flagged your driver's location and ETA has been updated. If your driver is unreachable, you can cancel and rebook. Logged.",
  'hello': "Hello! Welcome to RetroBliss Support 👋 I'm here to help with any questions about your ride experience, payments, account, or anything else. How can I assist you today?",
  'hi': "Hi there! Welcome to RetroBliss Support 👋 How can I help you today? You can ask about rides, payments, drivers, your account, or any platform features.",
  'thanks': "You're welcome! 😊 Is there anything else I can help you with? RetroBliss is committed to making your travel experience smooth and safe!",
  'help': "Here's how I can help you:\n🚗 Ride issues - delays, cancellations, navigation\n💰 Payment - wallet, top-ups, refunds\n👤 Account - profile, password, username\n🛡️ Safety - report incidents, SOS\n⭐ Driver feedback - ratings, complaints\n\nWhat do you need help with?",
  'sos': "🚨 EMERGENCY LOGGED. Your SOS has been escalated to our safety team immediately. Please use the SOS button in your active ride screen for fastest response. Stay safe!",
  'lost': "For lost items in a RetroBliss vehicle, your complaint has been logged. We'll contact your driver immediately. Please provide the ride date/time and item description.",
  'promo': "For promotions and discount codes, keep an eye on our broadcast notifications! Promotions are announced platform-wide. Your feedback about wanting more promos has been noted.",
  'review': "Thank you for your interest in leaving a review! After each completed ride, a rating prompt will appear. Your feedback helps improve our service for everyone.",
};

function getAutoResponse(message: string): string {
  const lower = message.toLowerCase();
  for (const [key, response] of Object.entries(SUPPORT_RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  return `Thank you for reaching out to RetroBliss Support. Your message has been logged and will be reviewed by our team. A representative will respond within 2-4 hours. Reference: #${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
}

const QUICK_TEMPLATES = [
  "My driver hasn't arrived yet",
  "I want to report a payment issue",
  "My ride was cancelled unfairly",
  "I need a refund",
  "Driver was rude/unsafe",
  "I left something in the car",
];

interface ChatSupportProps {
  userId: string;
  userRole: 'rider' | 'driver';
  userName: string;
  onBack: () => void;
}

const ChatSupport: React.FC<ChatSupportProps> = ({ userId, userRole, userName, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel(`chat-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rb_chat_messages', filter: `user_id=eq.${userId}` }, () => {
        fetchMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase.from('rb_chat_messages').select('*').eq('user_id', userId).order('created_at', { ascending: true });
    if (data) setMessages(data as ChatMessage[]);
  };

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setSending(true);
    setInput('');

    const userMsg: Partial<ChatMessage> = {
      id: generateId(),
      user_id: userId,
      user_role: userRole,
      user_name: userName,
      sender: 'user',
      message: msg,
      read: false,
      created_at: new Date().toISOString(),
    };

    await supabase.from('rb_chat_messages').insert(userMsg);

    // Auto-reply after 1.5 seconds
    setTimeout(async () => {
      const autoReply: Partial<ChatMessage> = {
        id: generateId(),
        user_id: userId,
        user_role: 'support',
        user_name: 'RetroBliss Support',
        sender: 'support',
        message: getAutoResponse(msg),
        read: false,
        created_at: new Date().toISOString(),
      };
      await supabase.from('rb_chat_messages').insert(autoReply);
      setSending(false);
    }, 1200 + Math.random() * 800);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#080612', fontFamily: "'Poppins', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: '48px 20px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '14px', padding: '10px 14px', color: 'white', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}>←</button>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
          <img src="/retrobliss-icon.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Support" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: 0 }}>RetroBliss Support</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ADE80' }} />
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', margin: 0 }}>Online · Typically replies in minutes</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        {/* Welcome message */}
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 12px' }}>
              <img src="/retrobliss-icon.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="RetroBliss" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>RetroBliss Support</h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', lineHeight: 1.5, margin: '0 0 20px' }}>
              Hi {userName.split(' ')[0]}! 👋 We're here to help with any questions or concerns about your RetroBliss experience.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {QUICK_TEMPLATES.map(t => (
                <button key={t} onClick={() => sendMessage(t)} style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '16px', padding: '10px 16px', color: '#C4B5FD', cursor: 'pointer', fontSize: '13px', fontFamily: "'Poppins', sans-serif", textAlign: 'left' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex',
            justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: '12px',
          }}>
            {msg.sender !== 'user' && (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', marginRight: '8px', flexShrink: 0, alignSelf: 'flex-end' }}>
                {msg.sender === 'ceo' ? '👑' : '🛡️'}
              </div>
            )}
            <div style={{
              maxWidth: '78%',
              background: msg.sender === 'user'
                ? 'linear-gradient(135deg, #8B5CF6, #EC4899)'
                : 'rgba(255,255,255,0.08)',
              borderRadius: msg.sender === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
              padding: '12px 16px',
              border: msg.sender !== 'user' ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}>
              {msg.sender === 'ceo' && (
                <p style={{ color: '#FCD34D', fontSize: '10px', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.06em' }}>👑 CEO REPLY</p>
              )}
              <p style={{ color: 'white', fontSize: '14px', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{msg.message}</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', margin: '4px 0 0', textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
                {new Date(msg.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {sending && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🛡️</div>
            <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '20px', padding: '12px 18px', display: 'flex', gap: '6px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#8B5CF6', animation: `float 0.6s ease-in-out ${i * 0.2}s infinite alternate` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type your message..."
          rows={1}
          style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: 'white', fontSize: '14px', padding: '12px 16px', fontFamily: "'Poppins', sans-serif", resize: 'none', outline: 'none', maxHeight: '100px', overflowY: 'auto' }}
        />
        <button onClick={() => sendMessage()} disabled={!input.trim() || sending} style={{ width: '44px', height: '44px', borderRadius: '50%', background: input.trim() ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'rgba(255,255,255,0.07)', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '18px', transition: 'all 0.2s ease' }}>
          ➤
        </button>
      </div>
    </div>
  );
};

export default ChatSupport;
