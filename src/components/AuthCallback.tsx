import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verifying your session...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setStatus('Processing secure login authentication...');
        
        // Explicity fetch session to process OAuth hash parameters from rediction
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error fetching session:', error);
          setErrorMsg(error.message);
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        if (data.session) {
          setStatus('Authentication successful! Syncing profile...');
          const authUser = data.session.user;
          
          // Verify or create profile for the newly authenticated User
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          if (!profile) {
            const name = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User';
            const profileData = {
              id: authUser.id,
              uid: authUser.id,
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

            const { error: upsertError } = await supabase.from('users').upsert(profileData);
            if (upsertError) {
              console.error('Callback profile upsert error:', upsertError);
            }
          }

          setStatus('Redirecting to dashboard...');
          navigate('/');
        } else {
          // If no active session, wait a brief duration to let auth listener update, then fallback
          const timeout = setTimeout(async () => {
            const { data: retryData } = await supabase.auth.getSession();
            if (retryData.session) {
              navigate('/');
            } else {
              setStatus('No active session found. Redirecting to login...');
              navigate('/login');
            }
          }, 2000);
          return () => clearTimeout(timeout);
        }
      } catch (err: any) {
        console.error('Auth callback exception:', err);
        setErrorMsg('An unexpected error occurred during auth callback.');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div id="auth-callback-container" className="flex flex-col items-center justify-center p-8 text-center min-h-[70vh]">
      <motion.div
        id="auth-callback-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 border border-white/10 rounded-2xl bg-black/40 backdrop-blur-md"
      >
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* Spinning gradient ring */}
            <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-white/20 border-t-amber-500 animate-spin"></div>
            {/* Inner pulsing circle */}
            <div className="absolute inset-2 bg-amber-500/20 rounded-full animate-pulse flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
        </div>

        <h2 className="mb-2 text-xl font-bold tracking-tight text-white font-sans">
          Secure Authentication
        </h2>

        {errorMsg ? (
          <div id="auth-callback-error" className="p-3 text-xs bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {errorMsg}
          </div>
        ) : (
          <p id="auth-callback-status" className="text-sm text-gray-400 animate-pulse font-sans">
            {status}
          </p>
        )}

        <div className="mt-8 text-[10px] font-mono tracking-widest text-amber-500/60 uppercase">
          Smart Parking System Authentication
        </div>
      </motion.div>
    </div>
  );
}
