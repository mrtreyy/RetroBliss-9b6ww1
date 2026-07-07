import React, { useState, useRef, useCallback, useEffect } from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';
import { supabase, generateId, logAuditDB, getClientIP, sendNotification } from '@/lib/supabase';
import type { Rider } from '@/types';
import { toast } from 'sonner';

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT-Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

interface RiderSignUpProps {
  onSignUp: (rider: Rider) => void;
  onBack: () => void;
}

const RiderSignUp: React.FC<RiderSignUpProps> = ({ onSignUp, onBack }) => {
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [location, setLocation] = useState('');
  const [state, setState] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const usernameTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleUsernameChange = useCallback(async (val: string) => {
    setUsername(val);
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (!val.trim() || val.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    usernameTimer.current = setTimeout(async () => {
      const { data } = await supabase.from('rb_usernames').select('username').eq('username', val.toLowerCase()).limit(1);
      if (data && data.length > 0) {
        setUsernameStatus('taken');
        const base = fullName.toLowerCase().replace(/\s+/g, '') || val.toLowerCase();
        setUsernameSuggestions([`${base}_rides`, `${base}${Math.floor(Math.random()*900)+100}`, `ride_${base}`]);
      } else {
        setUsernameStatus('available');
        setUsernameSuggestions([]);
      }
    }, 600);
  }, [fullName]);

  const handleGetLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
        const d = await res.json();
        const city = d.address?.city || d.address?.town || d.address?.suburb || '';
        const st = d.address?.state || '';
        setLocation(`${city}, ${st}`);
        const matched = NIGERIAN_STATES.find(s => st.toLowerCase().includes(s.toLowerCase()));
        if (matched) setState(matched);
      } catch { toast.error('Could not get location'); }
      setLocating(false);
    }, () => { toast.error('Location access denied'); setLocating(false); });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full name required';
    if (!username.trim() || username.length < 3) errs.username = 'Username must be at least 3 characters';
    if (usernameStatus === 'taken') errs.username = 'Username already taken';
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = 'Valid email required';
    if (!phone.match(/^(\+234|0)[789][01]\d{8}$/)) errs.phone = 'Valid Nigerian number required (e.g. 08012345678)';
    if (!dob) errs.dob = 'Date of birth required';
    if (!location.trim()) errs.location = 'Location required';
    if (!state) errs.state = 'State required';
    if (password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    return errs;
  };

  const handleSignUp = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error('Please fix the errors below.'); return; }
    if (!termsAccepted) { toast.error('You must accept Terms & Conditions to proceed.'); return; }

    setLoading(true);
    try {
      const id = generateId();
      const uname = username.trim().toLowerCase();

      // Check email uniqueness
      const { data: existing } = await supabase.from('rb_riders').select('id').eq('email', email.trim().toLowerCase()).limit(1);
      if (existing && existing.length > 0) {
        setErrors({ email: 'Email already registered' });
        setLoading(false); return;
      }

      const riderRow = {
        id, full_name: fullName.trim(), username: uname,
        email: email.trim().toLowerCase(), phone: phone.trim(),
        dob, location: location.trim(), state, country: 'Nigeria',
        profile_pic: profilePic, wallet_balance: 0,
        status: 'active', created_at: new Date().toISOString(),
      };

      const { error: insertErr } = await supabase.from('rb_riders').insert(riderRow);
      if (insertErr) { toast.error('Registration failed. Please try again.'); setLoading(false); return; }

      await supabase.from('rb_usernames').insert({ username: uname, role: 'rider', user_id: id, created_at: new Date().toISOString() });
      localStorage.setItem(`rb_pwd_${id}`, password);
      // Also store under username key as durable fallback
      localStorage.setItem(`rb_pwd_u_${uname}`, password);

      const ip = await getClientIP();
      await logAuditDB(uname, 'rider', 'signup', id, { email: email.trim().toLowerCase(), state }, ip, state);

      await sendNotification(id, 'rider', 'Welcome to RetroBliss! 🎉', 'Your account is ready. Book your first ride today!');

      const rider: Rider = {
        id, fullName: fullName.trim(), username: uname, email: email.trim().toLowerCase(),
        phone: phone.trim(), dob, location: location.trim(), state, country: 'Nigeria',
        profilePic, walletBalance: 0, createdAt: new Date().toISOString(), role: 'rider', status: 'active',
      };

      toast.success('Account created! Welcome to RetroBliss 🚀');
      setLoading(false);
      onSignUp(rider);
    } catch {
      toast.error('Registration failed. Please try again.');
      setLoading(false);
    }
  };

  const FieldError = ({ field }: { field: string }) =>
    errors[field] ? <p style={{ color: '#FCA5A5', fontSize: '11px', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}><span>⚠</span> {errors[field]}</p> : null;

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #1e0a3c 0%, #0d0618 45%, #080612 100%)', fontFamily: "'Poppins', sans-serif", overflowY: 'auto' }}>
      <div style={{ padding: '48px 24px 100px', maxWidth: '440px', margin: '0 auto', animation: 'fadeInUp 0.5s ease' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '24px', fontFamily: "'Poppins', sans-serif", padding: 0 }}>
          ← Back
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <RetroBlissLogo size={60} showTagline={false} />
        </div>

        <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 800, margin: '0 0 4px' }}>Create Account</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 28px' }}>Join RetroBliss — Nigeria's premier ride experience</p>

        {/* Profile pic */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{ width: '76px', height: '76px', borderRadius: '50%', background: profilePic ? 'transparent' : 'rgba(139,92,246,0.1)', border: `2px ${profilePic ? 'solid rgba(139,92,246,0.6)' : 'dashed rgba(139,92,246,0.35)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, transition: 'all 0.2s ease' }}
          >
            {profilePic ? <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '28px' }}>📸</span>}
          </div>
          <div>
            <p style={{ color: 'white', fontSize: '14px', fontWeight: 600, margin: '0 0 3px' }}>Profile Photo</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 8px' }}>Optional but recommended</p>
            <button onClick={() => fileRef.current?.click()} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '10px', color: '#C4B5FD', fontSize: '12px', padding: '6px 12px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
              {profilePic ? '✓ Change photo' : 'Upload photo'}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
            const f = e.target.files?.[0]; if (!f) return;
            const r = new FileReader();
            r.onload = ev => setProfilePic(ev.target?.result as string);
            r.readAsDataURL(f);
          }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Full name */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>FULL NAME *</label>
            <input className="rb-input" placeholder="e.g. Adeola Johnson" value={fullName} onChange={e => setFullName(e.target.value)} />
            <FieldError field="fullName" />
          </div>

          {/* Username */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>USERNAME *</label>
            <div style={{ position: 'relative' }}>
              <input className="rb-input" placeholder="Choose a unique username" value={username} onChange={e => handleUsernameChange(e.target.value)} style={{ paddingRight: '110px' }} />
              {usernameStatus !== 'idle' && (
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '10px', background: usernameStatus === 'available' ? 'rgba(34,197,94,0.2)' : usernameStatus === 'taken' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)', color: usernameStatus === 'available' ? '#4ADE80' : usernameStatus === 'taken' ? '#FCA5A5' : 'rgba(255,255,255,0.5)' }}>
                  {usernameStatus === 'checking' ? '⏳ Checking' : usernameStatus === 'available' ? '✓ Available' : '✗ Taken'}
                </div>
              )}
            </div>
            <FieldError field="username" />
            {usernameStatus === 'taken' && usernameSuggestions.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 6px' }}>Suggestions:</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {usernameSuggestions.map(s => (
                    <button key={s} onClick={() => { setUsername(s); setUsernameStatus('available'); setUsernameSuggestions([]); }} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '10px', color: '#C4B5FD', fontSize: '12px', padding: '5px 12px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>EMAIL *</label>
            <input className="rb-input" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            <FieldError field="email" />
          </div>

          {/* Phone */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>PHONE (NIGERIA) *</label>
            <input className="rb-input" type="tel" placeholder="08012345678" value={phone} onChange={e => setPhone(e.target.value)} />
            <FieldError field="phone" />
          </div>

          {/* DOB */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>DATE OF BIRTH *</label>
            <input className="rb-input" type="date" value={dob} onChange={e => setDob(e.target.value)} style={{ colorScheme: 'dark' }} />
            <FieldError field="dob" />
          </div>

          {/* Location */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>LOCATION *</label>
            <input className="rb-input" placeholder="e.g. Lekki, Lagos" value={location} onChange={e => setLocation(e.target.value)} />
            <button onClick={handleGetLocation} disabled={locating} style={{ marginTop: '10px', width: '100%', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '14px', color: '#C4B5FD', fontSize: '13px', padding: '11px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease' }}>
              {locating ? <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(139,92,246,0.4)', borderTopColor: '#8B5CF6', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} /> Locating...</> : <><span>📍</span> Use my current location</>}
            </button>
            <FieldError field="location" />
          </div>

          {/* State */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>STATE *</label>
            <select className="rb-input" value={state} onChange={e => setState(e.target.value)}>
              <option value="">Select your state</option>
              {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <FieldError field="state" />
          </div>

          {/* Country - auto set */}
          <div className="glass" style={{ borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>🇳🇬</span>
            <div>
              <p style={{ color: 'white', fontSize: '14px', fontWeight: 500, margin: 0 }}>Nigeria</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0 }}>Country (auto-set)</p>
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>PASSWORD *</label>
            <input className="rb-input" type="password" placeholder="Minimum 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
            <FieldError field="password" />
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>CONFIRM PASSWORD *</label>
            <input className="rb-input" type="password" placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            <FieldError field="confirmPassword" />
          </div>

          {/* Terms */}
          <div className="glass" style={{ borderRadius: '18px', padding: '16px 18px', cursor: 'pointer' }} onClick={() => setTermsAccepted(!termsAccepted)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '8px', border: `2px solid ${termsAccepted ? '#8B5CF6' : 'rgba(255,255,255,0.2)'}`, background: termsAccepted ? 'linear-gradient(135deg, #8B5CF6, #EC4899)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', transition: 'all 0.2s ease' }}>
                {termsAccepted && <span style={{ color: 'white', fontSize: '14px', fontWeight: 800 }}>✓</span>}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
                I accept the <span style={{ color: '#C4B5FD', fontWeight: 600 }}>Terms & Conditions</span> and <span style={{ color: '#C4B5FD', fontWeight: 600 }}>Privacy Policy</span> of RetroBliss.
              </p>
            </div>
          </div>

          {/* Sign up button */}
          <button onClick={handleSignUp} disabled={loading} className="btn-gradient" style={{ width: '100%', padding: '18px', borderRadius: '22px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: loading ? 0.7 : 1 }}>
            {loading ? (
              <><div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} /> Creating account...</>
            ) : '✨ Create My Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RiderSignUp;
