import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { AppState } from "@/types";
import type { Rider, Driver } from "@/types";

import SplashScreen from "@/pages/SplashScreen";
import RoleSelect from "@/pages/RoleSelect";
import RiderSignIn from "@/pages/rider/RiderSignIn";
import RiderSignUp from "@/pages/rider/RiderSignUp";
import RiderOnboarding from "@/pages/rider/RiderOnboarding";
import RiderHome from "@/pages/rider/RiderHome";
import DriverSignIn from "@/pages/driver/DriverSignIn";
import DriverSignUp from "@/pages/driver/DriverSignUp";
import DriverPending from "@/pages/driver/DriverPending";
import DriverHome from "@/pages/driver/DriverHome";
import CEOPasswordEntry from "@/pages/ceo/CEOPasswordEntry";
import CEODashboard from "@/pages/ceo/CEODashboard";

const queryClient = new QueryClient();

const App = () => {
  const [appState, setAppState] = useState<AppState>('splash');
  const [currentRider, setCurrentRider] = useState<Rider | null>(null);
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);

  const navigate = (state: AppState) => setAppState(state);

  const handleSplashComplete = () => {
    const storedRider = localStorage.getItem('rb_current_rider');
    const storedDriver = localStorage.getItem('rb_current_driver');
    const adminSession = localStorage.getItem('rb_admin_session');

    if (adminSession === 'true') { navigate('ceo-dashboard'); return; }

    if (storedRider) {
      try {
        const rider = JSON.parse(storedRider) as Rider;
        setCurrentRider(rider);
        navigate('rider-home');
        return;
      } catch { /* ignore */ }
    }
    if (storedDriver) {
      try {
        const driver = JSON.parse(storedDriver) as Driver;
        setCurrentDriver(driver);
        navigate(driver.status === 'pending' ? 'driver-pending' : driver.status === 'declined' ? 'driver-pending' : 'driver-home');
        return;
      } catch { /* ignore */ }
    }
    navigate('role-select');
  };

  const handleLogout = () => {
    localStorage.removeItem('rb_current_rider');
    localStorage.removeItem('rb_current_driver');
    localStorage.removeItem('rb_admin_session');
    setCurrentRider(null);
    setCurrentDriver(null);
    navigate('role-select');
  };

  const renderScreen = () => {
    switch (appState) {
      case 'splash':
        return <SplashScreen onComplete={handleSplashComplete} />;
      case 'role-select':
        return <RoleSelect onSelectRider={() => navigate('rider-signin')} onSelectDriver={() => navigate('driver-signin')} />;
      case 'rider-signin':
        return (
          <RiderSignIn
            onLogin={(rider) => {
              setCurrentRider(rider);
              localStorage.setItem('rb_current_rider', JSON.stringify(rider));
              navigate('rider-home');
            }}
            onSignUp={() => navigate('rider-signup')}
            onBack={() => navigate('role-select')}
            onCEODetected={() => navigate('ceo-password')}
          />
        );
      case 'rider-signup':
        return (
          <RiderSignUp
            onSignUp={(rider) => {
              setCurrentRider(rider);
              localStorage.setItem('rb_current_rider', JSON.stringify(rider));
              navigate('rider-onboarding');
            }}
            onBack={() => navigate('rider-signin')}
          />
        );
      case 'rider-onboarding':
        return <RiderOnboarding rider={currentRider} onComplete={() => navigate('rider-home')} />;
      case 'rider-home':
        return (
          <RiderHome
            rider={currentRider}
            onLogout={handleLogout}
            onUpdateRider={(r) => {
              setCurrentRider(r);
              localStorage.setItem('rb_current_rider', JSON.stringify(r));
            }}
          />
        );
      case 'driver-signin':
        return (
          <DriverSignIn
            onLogin={(driver) => {
              setCurrentDriver(driver);
              localStorage.setItem('rb_current_driver', JSON.stringify(driver));
              if (driver.status === 'pending' || driver.status === 'declined') {
                navigate('driver-pending');
              } else {
                navigate('driver-home');
              }
            }}
            onSignUp={() => navigate('driver-signup')}
            onBack={() => navigate('role-select')}
            onCEODetected={() => navigate('ceo-password')}
          />
        );
      case 'driver-signup':
        return (
          <DriverSignUp
            onSignUp={(driver) => {
              setCurrentDriver(driver);
              localStorage.setItem('rb_current_driver', JSON.stringify(driver));
              navigate('driver-pending');
            }}
            onBack={() => navigate('driver-signin')}
          />
        );
      case 'driver-pending':
        return (
          <DriverPending
            driver={currentDriver}
            onLogout={handleLogout}
            onCheckStatus={(driver) => {
              setCurrentDriver(driver);
              localStorage.setItem('rb_current_driver', JSON.stringify(driver));
              if (driver.status === 'active') navigate('driver-home');
              else if (driver.status === 'declined') navigate('driver-pending');
            }}
          />
        );
      case 'driver-home':
        return (
          <DriverHome
            driver={currentDriver}
            onLogout={handleLogout}
            onUpdateDriver={(d) => {
              setCurrentDriver(d);
              localStorage.setItem('rb_current_driver', JSON.stringify(d));
            }}
          />
        );
      case 'ceo-password':
        return (
          <CEOPasswordEntry
            onSuccess={() => {
              localStorage.setItem('rb_admin_session', 'true');
              navigate('ceo-dashboard');
            }}
            onBack={() => navigate('role-select')}
          />
        );
      case 'ceo-dashboard':
        return <CEODashboard onLogout={handleLogout} />;
      default:
        return <SplashScreen onComplete={handleSplashComplete} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <div style={{ minHeight: '100vh', background: '#080612', fontFamily: "'Poppins', sans-serif" }}>
          {renderScreen()}
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
