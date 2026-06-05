import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Mail, 
  Lock, 
  Chrome, 
  ArrowRight, 
  Loader2, 
  ShieldCheck, 
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[LoginScreen] Error fetching session:', error);
          if (error.message && (
            error.message.includes('Refresh Token') || 
            error.message.includes('refresh_token') ||
            error.message.includes('Invalid Refresh Token') ||
            error.message.includes('not found') ||
            error.message.includes('refresh token')
          )) {
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
          }
          return;
        }
        if (session?.user) {
          navigate('/');
        }
      } catch (err) {
        console.error('[LoginScreen] checkUser check error:', err);
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate('/');
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your credentials');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (loginErr) throw loginErr;
      // App.tsx auth listener handles navigation
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: false
      }
    })

    if (error) {
      console.error(error)
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
      if (resetErr) throw resetErr;
      setSuccess('Password reset link sent to your email');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col p-6 justify-center max-w-md mx-auto relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-[50%] bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass p-8 rounded-[2.5rem] space-y-8 relative z-10 border border-white/[0.08]"
      >
        <header className="space-y-4 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-cyan-400/20 mx-auto border border-cyan-400/10">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black italic tracking-tight text-white mb-1 uppercase">Welcome Back</h1>
            <p className="text-gradient-cyan-blue text-xs font-black uppercase tracking-[0.2em] leading-none mb-1">Secure Auto-Console</p>
          </div>
        </header>

        <form onSubmit={handleEmailLogin} className="space-y-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 ml-4">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <label className="text-[9px] font-black uppercase tracking-widest text-cyan-400">Email Address</label>
              </div>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="YOUR EMAIL"
                className="w-full input-premium rounded-2xl py-4 px-6 outline-none text-sm text-white placeholder:text-white/20"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 ml-4">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <label className="text-[9px] font-black uppercase tracking-widest text-cyan-400">Password</label>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full input-premium rounded-2xl py-4 px-6 outline-none text-sm text-white placeholder:text-white/20 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-cyan-400 transition-colors"
                >
                  <AlertCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button 
              type="button"
              onClick={handleForgotPassword}
              className="text-[10px] font-extrabold text-cyan-400 hover:text-cyan-300 uppercase tracking-widest transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-black py-4.5 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.01] transition-all shadow-xl shadow-cyan-500/15 active:scale-95 text-xs uppercase tracking-widest border border-cyan-400/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5 text-white" /> : (
              <>
                <span>Secure Login</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </>
            )}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/[0.06]" />
          </div>
          <div className="relative flex justify-center text-[8px] uppercase font-black tracking-widest">
            <span className="bg-[#03010b] px-4 text-white/40">Or Connect Protocol</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          type="button"
          disabled={loading}
          className="w-full bg-white text-black font-black py-4 rounded-xl flex items-center justify-center gap-4 hover:bg-white/90 hover:scale-[1.01] transition-all shadow-lg active:scale-95 text-[10px] uppercase tracking-[0.2em] disabled:opacity-50"
        >
          {loading && !email ? (
            <>
              <Loader2 className="animate-spin w-5 h-5 text-black" />
              <span>Connecting Google...</span>
            </>
          ) : (
            <>
              <Chrome className="w-5 h-5" />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div className="text-center pt-2">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
            Don't have an account? {' '}
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 font-extrabold transition-colors">Sign Up</Link>
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] p-4 rounded-xl flex items-center gap-3 font-bold uppercase tracking-wider"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] p-4 rounded-xl flex items-center gap-3 font-bold uppercase tracking-wider text-center"
          >
            <p className="w-full">{success}</p>
          </motion.div>
        )}
      </motion.div>

      <footer className="mt-8 text-center py-4">
        <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.4em]">Integrated Secure Interface</p>
      </footer>
    </div>
  );
}
