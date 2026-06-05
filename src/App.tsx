import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { SlotStatus } from './types';

// Screens
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import Dashboard from './screens/Dashboard';
import BookingScreen from './screens/BookingScreen';
import GateControlScreen from './screens/GateControlScreen';
import NavigationScreen from './screens/NavigationScreen';
import PaymentScreen from './screens/PaymentScreen';
import ExitScreen from './screens/ExitScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';

// Components
import BottomNav from './components/BottomNav';
import Notifications from './components/Notifications';
import Background from './components/Background';
import AuthCallback from './components/AuthCallback';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let unsubProfile: (() => void) | undefined;

    // Check for stale session and invalid refresh tokens to recover gracefully
    const verifyAndRecoverSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[Session Recovery] Error fetching session:', error);
          if (error.message && (
            error.message.includes('Refresh Token') || 
            error.message.includes('refresh_token') ||
            error.message.includes('Invalid Refresh Token') ||
            error.message.includes('not found') ||
            error.message.includes('refresh token')
          )) {
            console.log('[Session Recovery] Invalid/stale refresh token detected. Clearing local session state...');
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (key && (key.includes('supabase.auth') || key.includes('sb-') || key.includes('token'))) {
                localStorage.removeItem(key);
              }
            }
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              // ignore
            }
            setUser(null);
            setProfileComplete(false);
            setLoading(false);
          }
        } else if (!data.session) {
          setLoading(false);
        }
      } catch (err) {
        console.error('[Session Recovery] Exception during session check:', err);
        setLoading(false);
      }
    };
    verifyAndRecoverSession();

    // Supabase auth subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const authUser = session?.user || null;
      if (authUser) {
        // Safe backward-compatuid
        (authUser as any).uid = authUser.id;
      }
      setUser(authUser);
      
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = undefined;
      }

      if (authUser) {
        // Run system initialization only after authentication
        initSystem();

        // Listen for profile changes to ensure system access only when profile is complete
        const syncProfile = async () => {
          try {
            const { data, error: fetchError } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle();
            if (fetchError) {
              console.error("Profile fetch error:", fetchError);
            }

            if (!data) {
              const isEmailProvider = authUser.app_metadata?.provider === 'email' || authUser.identities?.some((id: any) => id.provider === 'email');
              
              if (!isEmailProvider) {
                // Create default profile for newly registered Google/social users
                const name = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User';
                const profileData = {
                  id: authUser.id,
                  uid: authUser.id, // backward compatibility
                  email: authUser.email?.toLowerCase() || '',
                  fullName: name.toUpperCase(),
                  displayName: name.toUpperCase(),
                  mobileNumber: '',
                  vehicleNumber: '',
                  vehiclePlate: '',
                  profileCompleted: true,
                  role: 'user',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };

                console.log("Auto-creating basic profile for OAuth sign-in:", profileData);
                const { error: upsertError } = await supabase.from('users').upsert(profileData);
                if (upsertError) {
                  console.error("Error auto-creating profile:", upsertError);
                }
                setProfileComplete(true);
              } else {
                // For manual email/password auth, wait for the signup form to insert the complete profile
                console.log("Waiting for SignUpScreen to insert complete profile for email authentication.");
                setProfileComplete(false);
              }
            } else {
              setProfileComplete(data.profileCompleted === true);
            }
            setLoading(false);
          } catch (e) {
            console.error("Profile sync exception:", e);
            setProfileComplete(false);
            setLoading(false);
          }
        };

        syncProfile();

        // Realtime profile channel listener
        const profileChannel = supabase
          .channel('user-profile-rt')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'users', filter: `id=eq.${authUser.id}` },
            (payload) => {
              const data = payload.new as any;
              if (data && data.profileCompleted === true) {
                setProfileComplete(true);
              } else {
                setProfileComplete(false);
              }
              setLoading(false);
            }
          )
          .subscribe();

        unsubProfile = () => {
          supabase.removeChannel(profileChannel);
        };
      } else {
        setProfileComplete(false);
        setLoading(false);
      }
    });

    // Auto-initialize system tables
    async function initSystem() {
      try {
        // 1. Initialize or Ensure Slots S1-S4
        const { data: slotsSnap } = await supabase.from('slots').select('*');
        const requiredIds = ['slot-S1', 'slot-S2', 'slot-S3', 'slot-S4'];
        
        // Delete slots that are not in our required list
        if (slotsSnap) {
          const deleteIds = slotsSnap
            .filter(slot => !requiredIds.includes(slot.id))
            .map(slot => slot.id);
          
          if (deleteIds.length > 0) {
            await supabase.from('slots').delete().in('id', deleteIds);
          }
        }

        // Upsert standard slots
        for (const id of requiredIds) {
          const num = id.replace('slot-', '');
          const existing = slotsSnap?.find(d => d.id === id);
          if (!existing) {
            await supabase.from('slots').insert({
              id,
              number: num,
              floor: 'Ground',
              status: SlotStatus.EMPTY,
              lastUpdated: new Date().toISOString(),
              sensorActive: false
            });
          } else if (existing.number !== num || existing.floor !== 'Ground') {
            await supabase.from('slots').update({
              number: num,
              floor: 'Ground'
            }).eq('id', id);
          }
        }

        // 2. Initialize Gate state in public.system table if absent
        const { data: gateSnap } = await supabase.from('system').select('*').eq('id', 'gate').maybeSingle();
        if (!gateSnap) {
          await supabase.from('system').insert({
            id: 'gate',
            status: 'Closed',
            lastChangedBy: 'system',
            timestamp: new Date().toISOString(),
            sensorEntry: false,
            sensorExit: false
          });
        }
      } catch (e) {
        console.error("Initialization error", e);
      }
    };

    const splashTimer = setTimeout(() => setShowSplash(false), 3000);
    return () => {
      subscription.unsubscribe();
      if (unsubProfile) unsubProfile();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(splashTimer);
    };
  }, []);

  if (showSplash || loading) return <SplashScreen />;

  return (
    <Router>
      <Background />
      <div className="min-h-screen bg-transparent text-[var(--text)] flex flex-col font-sans transition-colors duration-300">
        {!isOnline && (
          <div className="bg-red-600 text-white text-[10px] font-black uppercase py-1.5 text-center sticky top-0 z-[101] tracking-[0.2em] shadow-lg animate-pulse border-b border-white/10">
            Current Status: Offline • Data Sync Paused
          </div>
        )}
        <Notifications />
        <main className="flex-1 pb-20 overflow-y-auto">
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            {!user ? (
              <>
                <Route path="/login" element={<LoginScreen />} />
                <Route path="/signup" element={<SignUpScreen />} />
                <Route path="*" element={<Navigate to="/login" />} />
              </>
            ) : !profileComplete ? (
              <>
                <Route path="/signup" element={<SignUpScreen />} />
                <Route path="*" element={<Navigate to="/signup" />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/book" element={<BookingScreen />} />
                <Route path="/gate" element={<GateControlScreen />} />
                <Route path="/navigation" element={<NavigationScreen />} />
                <Route path="/payment" element={<PaymentScreen />} />
                <Route path="/exit" element={<ExitScreen />} />
                <Route path="/history" element={<HistoryScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="*" element={<Navigate to="/" />} />
              </>
            )}
          </Routes>
        </main>
        {user && profileComplete && <BottomNav />}
      </div>
    </Router>
  );
}
