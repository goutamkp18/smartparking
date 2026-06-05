import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Mail, 
  Phone, 
  Car, 
  Lock, 
  ArrowRight, 
  Loader2, 
  Chrome, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, withTimeout } from '../lib/supabase';

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // If user is already authenticated via Google but profile incomplete
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[SignUpScreen] Error fetching session:', error);
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
          setCurrentUser(session.user);
          setFullName(session.user.user_metadata?.full_name?.toUpperCase() || '');
          setEmail(session.user.email || '');
        }
      } catch (err) {
        console.error('[SignUpScreen] checkSession error:', err);
      }
    };
    checkSession();
  }, []);

  const handleManualSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !mobile || (!password && !currentUser)) {
      setError('Required fields are missing');
      return;
    }
    if (!currentUser && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let uid = currentUser?.id;
      
      // If not already authenticated, create auth account
      if (!uid) {
        console.log("Creating brand new manual registration for email:", email);
        const signupResponse = await withTimeout<any>(
          supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName.toUpperCase()
              }
            }
          }),
          9000,
          "Secure sign-up server connection timed out. Please verify your internet and try again."
        );
        
        if (signupResponse.error) {
          const errMsg = signupResponse.error.message || '';
          if (
            errMsg.toLowerCase().includes('already registered') || 
            errMsg.toLowerCase().includes('already exists') || 
            errMsg.toLowerCase().includes('email_exists')
          ) {
            console.log("User already registered in Auth. Verifying secure password for profile link...");
            const loginResponse = await withTimeout<any>(
              supabase.auth.signInWithPassword({
                email,
                password,
              }),
              9000,
              "Connection timed out. Please verify your password and try again."
            );

            if (loginResponse.error) {
              throw new Error("This email address is already registered. Please go to the login portal or verify the password to complete registration.");
            }

            uid = loginResponse.data?.user?.id;
            console.log("Direct authentication successful for existing user:", uid);
          } else {
            throw signupResponse.error;
          }
        } else {
          uid = signupResponse.data?.user?.id;
        }
      }

      if (!uid) {
        throw new Error("Could not retrieve User ID from secure auth server.");
      }

      console.log("Upserting profile info for manual registered user:", uid);
      const profileData = {
        id: uid,
        uid: uid, // backward compatibility
        email: email.toLowerCase(),
        fullName: fullName.toUpperCase(),
        displayName: fullName.toUpperCase(),
        mobileNumber: mobile,
        vehicleNumber: vehicle.toUpperCase(),
        vehiclePlate: vehicle.toUpperCase(),
        profileCompleted: true,
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Set cache immediately to prevent async state race delays on dashboard routing
      localStorage.setItem(`user_profile_${uid}`, JSON.stringify(profileData));

      const { error: dbErr } = await withTimeout<any>(
        supabase.from('users').upsert(profileData),
        9000,
        "Profile database update timed out. Your information may have been recorded, please wait or reload the gateway."
      );

      if (dbErr) throw dbErr;

      setSuccess('Account Created Successfully');
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      console.error("Signup process exception:", err);
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAutoFill = async () => {
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

  return (
    <div className="min-h-screen bg-transparent flex flex-col p-6 max-w-lg mx-auto relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-600/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-600/5 blur-[100px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 flex flex-col min-h-full glass p-8 rounded-[2.5rem] border border-white/[0.08]"
      >
        <header className="mb-8 pt-8">
          <button 
            onClick={() => currentUser ? supabase.auth.signOut() : navigate('/login')}
            className="inline-flex items-center gap-2 text-white/40 hover:text-cyan-400 transition-colors mb-6 group"
          >
            <div className="p-2 rounded-lg bg-white/5 group-hover:bg-cyan-500/10">
              <ArrowRight className="w-4 h-4 rotate-180" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] group-hover:text-cyan-400">Back to Portal</span>
          </button>
          <h1 className="text-3xl font-black text-white tracking-tight italic uppercase">Create Identity</h1>
          <p className="text-gradient-cyan-blue text-[10px] font-black uppercase tracking-[0.2em] mt-2">Initialize your driver profile</p>
          {currentUser && (
            <button 
              onClick={() => supabase.auth.signOut()}
              className="mt-4 text-[9px] font-black text-cyan-400 uppercase tracking-[0.2em] hover:text-cyan-300 transition-colors"
            >
              Sign Out / Switch Account
            </button>
          )}
        </header>

        {!currentUser && (
          <button 
            disabled={loading}
            onClick={handleGoogleAutoFill}
            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all mb-8 active:scale-95 text-[10px] uppercase tracking-widest disabled:opacity-50"
          >
            {loading && !fullName ? (
              <>
                <Loader2 className="animate-spin w-4 h-4" />
                <span>Connecting Google Account...</span>
              </>
            ) : (
              <>
                <Chrome className="w-4 h-4" />
                <span>CHOOSE EMAIL</span>
              </>
            )}
          </button>
        )}

        <form onSubmit={handleManualSignup} className="space-y-4 flex-1">
          <div className="grid grid-cols-1 gap-4">
            <InputGroup 
              icon={<User className="w-3.5 h-3.5" />} 
              label="Full Name" 
              value={fullName}
              onChange={(v: string) => setFullName(v.toUpperCase())}
              placeholder="ENTER FULL NAME"
              required
            />
            
            <InputGroup 
              icon={<Mail className="w-3.5 h-3.5" />} 
              label="Email Address" 
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="YOUR@EMAIL.COM"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <InputGroup 
                icon={<Phone className="w-3.5 h-3.5" />} 
                label="Mobile Number" 
                type="tel"
                value={mobile}
                onChange={setMobile}
                placeholder="10 DIGITS"
                required
              />
              <InputGroup 
                icon={<Car className="w-3.5 h-3.5" />} 
                label="Vehicle (Optional)" 
                value={vehicle}
                onChange={(v: string) => setVehicle(v.toUpperCase())}
                placeholder="KA 01 AB 1234"
              />
            </div>

            {!currentUser && (
              <InputGroup 
                icon={<Lock className="w-3.5 h-3.5" />} 
                label="Password" 
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="MIN 6 CHARACTERS"
                required
              />
            )}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-black py-4.5 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.01] transition-all shadow-xl shadow-cyan-500/15 active:scale-95 mt-6 text-xs uppercase tracking-[0.2em] border border-cyan-400/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5 text-white" /> : (
              <>
                <span>Initialize Account</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </>
            )}
          </button>
        </form>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] p-4 rounded-xl flex flex-col gap-2 font-bold uppercase tracking-wider"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
                <p className="flex-1 leading-relaxed">{error}</p>
              </div>
              {error.toLowerCase().includes('already') && (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="mt-1 text-left text-[9px] text-white/50 hover:text-white transition-colors underline decoration-dotted underline-offset-4 pl-7 cursor-pointer"
                >
                  Already have an account? Go to Login portal instead &rarr;
                </button>
              )}
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
            >
              <motion.div 
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="bg-white text-black p-8 rounded-[2.5rem] flex flex-col items-center text-center max-w-xs shadow-2xl"
              >
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-500/20">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-black uppercase mb-2">Success</h3>
                <p className="text-sm font-bold text-black/60 uppercase tracking-widest">{success}</p>
                <div className="mt-8 flex gap-2">
                  <div className="w-2 h-2 bg-black rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-black rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-black rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-[10px] font-bold text-white/20 uppercase tracking-widest mt-8 pb-4">
          By signing up, you agree to our Digital Security Protocols.
        </p>
      </motion.div>
    </div>
  );
}

function InputGroup({ icon, label, type = "text", value, onChange, placeholder, disabled, required }: any) {
  return (
    <div className="space-y-1.5 group">
      <div className="flex items-center gap-2 ml-4">
        <span className="text-white/40 group-focus-within:text-cyan-400 transition-colors">{icon}</span>
        <label className="text-[9px] font-black uppercase tracking-widest text-white/40 group-focus-within:text-cyan-400 transition-colors">
          {label} {required && <span className="text-red-500/50">*</span>}
        </label>
      </div>
      <input 
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full input-premium rounded-2xl py-4 px-6 outline-none text-xs text-white placeholder:text-white/20 disabled:opacity-50"
      />
    </div>
  );
}
