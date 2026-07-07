import React, { useState, useRef, useCallback } from 'react';
import RetroBlissLogo from '@/components/RetroBlissLogo';
import { supabase, generateId, logAuditDB, getClientIP, sendNotification } from '@/lib/supabase';
import type { Driver } from '@/types';
import { toast } from 'sonner';

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT-Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
const VEHICLE_MAKES = ['Toyota','Honda','Hyundai','Kia','Mercedes-Benz','BMW','Ford','Chevrolet','Nissan','Peugeot','Volkswagen','Mitsubishi','Lexus','Suzuki'];
const BANKS = ['Opay','PalmPay','Kuda MFB','GTBank','Access Bank','First Bank','Zenith Bank','UBA','Wema Bank','Sterling Bank','Polaris Bank','Fidelity Bank'];

interface DriverSignUpProps {
  onSignUp: (driver: Driver) => void;
  onBack: () => void;
}

const DriverSignUp: React.FC<DriverSignUpProps> = ({ onSignUp, onBack }) => {
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
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [idUpload, setIdUpload] = useState<string | null>(null);
  const [idFileName, setIdFileName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
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
        setUsernameSuggestions([`${base}_driver`, `drv_${base}`, `${base}${Math.floor(Math.random()*900)+100}`]);
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

  const handleIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setIdFileName(f.name);
    const r = new FileReader();
    r.onload = ev => setIdUpload(ev.target?.result as string);
    r.readAsDataURL(f);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full name required';
    if (!username.trim() || username.length < 3) errs.username = 'Username must be at least 3 characters';
    if (usernameStatus === 'taken') errs.username = 'Username already taken';
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = 'Valid email required';
    if (!phone.match(/^(\+234|0)[789][01]\d{8}$/)) errs.phone = 'Valid Nigerian number required';
    if (!dob) errs.dob = 'Date of birth required';
    if (!location.trim()) errs.location = 'Location required';
    if (!state) errs.state = 'State required';
    if (!vehicleMake) errs.vehicleMake = 'Vehicle make required';
    if (!vehicleModel.trim()) errs.vehicleModel = 'Vehicle model required';
    if (!vehicleYear) errs.vehicleYear = 'Vehicle year required';
    if (!vehiclePlate.trim()) errs.vehiclePlate = 'License plate required';
    if (!vehicleColor.trim()) errs.vehicleColor = 'Vehicle color required';
    if (!bankName) errs.bankName = 'Bank required';
    if (!bankAccount.match(/^\d{10}$/)) errs.bankAccount = '10-digit account number required';
    if (!bankAccountName.trim()) errs.bankAccountName = 'Account name required';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters';
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

      const driverRow = {
        id, full_name: fullName.trim(), username: uname,
        email: email.trim().toLowerCase(), phone: phone.trim(),
        dob, location: location.trim(), state, country: 'Nigeria',
        profile_pic: profilePic, wallet_balance: 0,
        vehicle_make: vehicleMake, vehicle_model: vehicleModel.trim(),
        vehicle_year: vehicleYear, vehicle_plate: vehiclePlate.trim().toUpperCase(),
        vehicle_color: vehicleColor.trim(), id_upload: idUpload,
        bank_name: bankName, bank_account: bankAccount,
        bank_account_name: bankAccountName.trim(),
        status: 'pending', latitude: 6.5244, longitude: 3.3792,
        is_online: false, created_at: new Date().toISOString(),
      };

      const { error: insertErr } = await supabase.from('rb_drivers').insert(driverRow);
      if (insertErr) { toast.error('Registration failed. Please try again.'); setLoading(false); return; }

      await supabase.from('rb_usernames').insert({ username: uname, role: 'driver', user_id: id, created_at: new Date().toISOString() });
      localStorage.setItem(`rb_pwd_${id}`, password);
      // Also store under username key as durable fallback
      localStorage.setItem(`rb_pwd_u_${uname}`, password);

      const ip = await getClientIP();
      await logAuditDB(uname, 'driver', 'signup', id, { email: email.trim().toLowerCase(), state, vehicle: `${vehicleYear} ${vehicleMake} ${vehicleModel}` }, ip, state);

      // Notify CEO
      await sendNotification('ceo', 'admin', `New Driver Application 🚗`, `${fullName} (@${uname}) has applied to be a RetroBliss driver. Review their application in the admin panel.`);

      const driver: Driver = {
        id, fullName: fullName.trim(), username: uname, email: email.trim().toLowerCase(),
        phone: phone.trim(), dob, location: location.trim(), state, country: 'Nigeria',
        profilePic, walletBalance: 0, vehicleMake, vehicleModel: vehicleModel.trim(),
        vehicleYear, vehiclePlate: vehiclePlate.trim().toUpperCase(), vehicleColor: vehicleColor.trim(),
        idUpload, createdAt: new Date().toISOString(), role: 'driver', status: 'pending',
        bankName, bankAccount, bankAccountName: bankAccountName.trim(),
      };

      toast.success('Application submitted! Awaiting CEO approval. 🎉');
      setLoading(false);
      onSignUp(driver);
    } catch {
      toast.error('Registration failed. Please try again.');
      setLoading(false);
    }
  };

  const FieldError = ({ field }: { field: string }) =>
    errors[field] ? <p style={{ color: '#FCA5A5', fontSize: '11px', marginTop: '5px' }}>⚠ {errors[field]}</p> : null;

  const Section = ({ title }: { title: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 0 4px' }}>
      <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.07)' }} />
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{title}</span>
      <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.07)' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #1a0d08 0%, #0d0618 45%, #080612 100%)', fontFamily: "'Poppins', sans-serif", overflowY: 'auto' }}>
      <div style={{ padding: '48px 24px 100px', maxWidth: '440px', margin: '0 auto' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '24px', fontFamily: "'Poppins', sans-serif", padding: 0 }}>← Back</button>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <RetroBlissLogo size={60} showTagline={false} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(234,88,12,0.15))', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '20px', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🚗</span>
            <span style={{ color: '#FCD34D', fontSize: '13px', fontWeight: 700 }}>Driver Application</span>
          </div>
        </div>

        <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 800, margin: '0 0 4px' }}>Join as a Driver</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 24px' }}>All applications reviewed by our CEO before activation</p>

        {/* Profile pic */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div onClick={() => fileRef.current?.click()} style={{ width: '76px', height: '76px', borderRadius: '50%', background: profilePic ? 'transparent' : 'rgba(245,158,11,0.1)', border: `2px ${profilePic ? 'solid rgba(245,158,11,0.6)' : 'dashed rgba(245,158,11,0.35)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
            {profilePic ? <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '28px' }}>📷</span>}
          </div>
          <div>
            <p style={{ color: 'white', fontSize: '14px', fontWeight: 600, margin: '0 0 3px' }}>Profile Photo</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 8px' }}>Required for verification</p>
            <button onClick={() => fileRef.current?.click()} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', color: '#FCD34D', fontSize: '12px', padding: '6px 12px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
              {profilePic ? '✓ Change photo' : 'Upload photo'}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setProfilePic(ev.target?.result as string); r.readAsDataURL(f); }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Section title="Personal Info" />

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>FULL NAME *</label>
            <input className="rb-input" placeholder="e.g. David Okonkwo" value={fullName} onChange={e => setFullName(e.target.value)} />
            <FieldError field="fullName" />
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>USERNAME *</label>
            <div style={{ position: 'relative' }}>
              <input className="rb-input" placeholder="Unique driver username" value={username} onChange={e => handleUsernameChange(e.target.value)} style={{ paddingRight: '110px' }} />
              {usernameStatus !== 'idle' && (
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '10px', background: usernameStatus === 'available' ? 'rgba(34,197,94,0.2)' : usernameStatus === 'taken' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)', color: usernameStatus === 'available' ? '#4ADE80' : usernameStatus === 'taken' ? '#FCA5A5' : 'rgba(255,255,255,0.5)' }}>
                  {usernameStatus === 'checking' ? '⏳' : usernameStatus === 'available' ? '✓ Available' : '✗ Taken'}
                </div>
              )}
            </div>
            <FieldError field="username" />
            {usernameStatus === 'taken' && usernameSuggestions.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {usernameSuggestions.map(s => <button key={s} onClick={() => { setUsername(s); setUsernameStatus('available'); setUsernameSuggestions([]); }} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', color: '#FCD34D', fontSize: '12px', padding: '5px 12px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>{s}</button>)}
              </div>
            )}
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>EMAIL *</label>
            <input className="rb-input" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            <FieldError field="email" />
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>PHONE (NIGERIA) *</label>
            <input className="rb-input" type="tel" placeholder="08012345678" value={phone} onChange={e => setPhone(e.target.value)} />
            <FieldError field="phone" />
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>DATE OF BIRTH *</label>
            <input className="rb-input" type="date" value={dob} onChange={e => setDob(e.target.value)} style={{ colorScheme: 'dark' }} />
            <FieldError field="dob" />
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>LOCATION *</label>
            <input className="rb-input" placeholder="e.g. Surulere, Lagos" value={location} onChange={e => setLocation(e.target.value)} />
            <button onClick={handleGetLocation} disabled={locating} style={{ marginTop: '8px', width: '100%', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '14px', color: '#FCD34D', fontSize: '13px', padding: '11px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {locating ? '⏳ Locating...' : '📍 Use current location'}
            </button>
            <FieldError field="location" />
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>STATE *</label>
            <select className="rb-input" value={state} onChange={e => setState(e.target.value)}>
              <option value="">Select state</option>
              {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <FieldError field="state" />
          </div>

          <Section title="Vehicle Details" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>MAKE *</label>
              <select className="rb-input" value={vehicleMake} onChange={e => setVehicleMake(e.target.value)}>
                <option value="">Make</option>
                {VEHICLE_MAKES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <FieldError field="vehicleMake" />
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>MODEL *</label>
              <input className="rb-input" placeholder="e.g. Camry" value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} />
              <FieldError field="vehicleModel" />
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>YEAR *</label>
              <select className="rb-input" value={vehicleYear} onChange={e => setVehicleYear(e.target.value)}>
                <option value="">Year</option>
                {Array.from({ length: 20 }, (_, i) => 2024 - i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <FieldError field="vehicleYear" />
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>COLOR *</label>
              <input className="rb-input" placeholder="e.g. Silver" value={vehicleColor} onChange={e => setVehicleColor(e.target.value)} />
              <FieldError field="vehicleColor" />
            </div>
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>LICENSE PLATE *</label>
            <input className="rb-input" placeholder="e.g. ABC 123 XY" value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} />
            <FieldError field="vehiclePlate" />
          </div>

          {/* ID Upload */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>GOVERNMENT ID *</label>
            <div
              onClick={() => idRef.current?.click()}
              className="glass"
              style={{ borderRadius: '18px', padding: '16px', cursor: 'pointer', border: idUpload ? '1.5px solid rgba(34,197,94,0.4)' : '1.5px dashed rgba(245,158,11,0.3)', transition: 'all 0.2s ease' }}
            >
              {idUpload ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '20px' }}>✅</span>
                    <div>
                      <p style={{ color: '#4ADE80', fontSize: '13px', fontWeight: 600, margin: 0 }}>ID uploaded successfully</p>
                      {idFileName && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '2px 0 0' }}>{idFileName}</p>}
                    </div>
                  </div>
                  {/* Show ID image preview */}
                  {idUpload.startsWith('data:image') && (
                    <img src={idUpload} alt="ID Preview" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.3)' }} />
                  )}
                  {!idUpload.startsWith('data:image') && (
                    <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
                      <span style={{ fontSize: '24px' }}>📄</span>
                      <p style={{ color: '#4ADE80', fontSize: '12px', margin: '4px 0 0' }}>Document uploaded</p>
                    </div>
                  )}
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textAlign: 'center', margin: '8px 0 0' }}>Tap to change</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📎</span>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: 500, margin: '0 0 4px' }}>Upload Government ID</p>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', margin: 0 }}>NIN Slip, Driver's License, or Voter's Card</p>
                </div>
              )}
            </div>
            <input ref={idRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleIdUpload} />
          </div>

          <Section title="Bank Details" />

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>BANK *</label>
            <select className="rb-input" value={bankName} onChange={e => setBankName(e.target.value)}>
              <option value="">Select your bank</option>
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <FieldError field="bankName" />
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>ACCOUNT NUMBER *</label>
            <input className="rb-input" type="tel" placeholder="10-digit account number" maxLength={10} value={bankAccount} onChange={e => setBankAccount(e.target.value.replace(/\D/g, ''))} />
            <FieldError field="bankAccount" />
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>ACCOUNT NAME *</label>
            <input className="rb-input" placeholder="Name on your bank account" value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} />
            <FieldError field="bankAccountName" />
          </div>

          <Section title="Security" />

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>PASSWORD *</label>
            <input className="rb-input" type="password" placeholder="Minimum 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
            <FieldError field="password" />
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>CONFIRM PASSWORD *</label>
            <input className="rb-input" type="password" placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            <FieldError field="confirmPassword" />
          </div>

          <div className="glass" style={{ borderRadius: '18px', padding: '16px', cursor: 'pointer' }} onClick={() => setTermsAccepted(!termsAccepted)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '8px', border: `2px solid ${termsAccepted ? '#F59E0B' : 'rgba(255,255,255,0.2)'}`, background: termsAccepted ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s ease' }}>
                {termsAccepted && <span style={{ color: 'white', fontSize: '14px', fontWeight: 800 }}>✓</span>}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
                I accept the <span style={{ color: '#FCD34D', fontWeight: 600 }}>Terms & Conditions</span> and understand my account needs CEO approval before activation.
              </p>
            </div>
          </div>

          <button onClick={handleSignUp} disabled={loading} style={{ width: '100%', padding: '18px', borderRadius: '22px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: loading ? 0.7 : 1, background: 'linear-gradient(135deg, #F59E0B, #EF4444)', border: 'none', color: 'white', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'all 0.2s ease' }}>
            {loading ? (
              <><div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin-smooth 0.8s linear infinite' }} /> Submitting application...</>
            ) : '🚗 Submit Driver Application'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriverSignUp;
