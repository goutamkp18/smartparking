import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User as UserIcon, 
  Mail, 
  Car, 
  Clock, 
  History, 
  Bell, 
  Moon, 
  Sun, 
  HelpCircle, 
  MessageSquare, 
  ChevronDown, 
  LogOut,
  Send,
  CheckCircle2,
  Lock,
  Smartphone,
  CreditCard,
  Sparkles,
  ShieldCheck,
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { parkingService } from '../services/parkingService';
import { Booking, BookingStatus, UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editVehicle, setEditVehicle] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [updating, setUpdating] = useState(false);
  
  // Custom modal/alert states instead of window.alert/confirm
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Notification States
  const [notifs, setNotifs] = useState({
    bookingAlerts: true,
    paymentAlerts: true,
    parkingReminders: false
  });
  const [showStatusToast, setShowStatusToast] = useState<{ show: boolean, enabled: boolean } | null>(null);

  // Support Form State
  const [supportForm, setSupportForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [sending, setSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // FAQ State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const p = await parkingService.getUserProfile();
      setProfile(p);
      if (p) {
        setEditName(p.fullName || p.displayName || '');
        setEditVehicle(p.vehiclePlate || p.vehicleNumber || '');
        setEditPhone(p.mobileNumber || '');
        setIsDarkMode(p.theme !== 'light'); 
        if (p.notifications) {
          setNotifs(p.notifications);
        }
      }
      
      const unsub = parkingService.subscribeToUserBookings((bookings) => {
        const active = bookings.find(b => 
          [BookingStatus.RESERVED, BookingStatus.ACTIVE, BookingStatus.PAID].includes(b.status)
        );
        setActiveBooking(active || null);
      });
      
      setLoading(false);
      return () => unsub();
    };
    fetchData();
  }, []);

  const handleToggleNotif = async (key: keyof typeof notifs) => {
    const newVal = !notifs[key];
    const newNotifs = { ...notifs, [key]: newVal };
    setNotifs(newNotifs);
    
    setShowStatusToast({ show: true, enabled: newVal });
    setTimeout(() => setShowStatusToast(null), 3500);

    try {
      await parkingService.updateProfile({ notifications: newNotifs });
    } catch (err) {
      console.error('Failed to save notification preference', err);
    }
  };

  const handleThemeToggle = async (newDarkMode: boolean) => {
    setIsDarkMode(newDarkMode);
    try {
      await parkingService.updateProfile({ theme: newDarkMode ? 'dark' : 'light' });
    } catch (err) {
      console.error('Failed to save theme preference', err);
    }
  };

  const handleLogoutActual = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveProfile = async () => {
    setUpdating(true);
    setErrorMessage('');
    try {
      await parkingService.updateProfile({
        displayName: editName,
        fullName: editName,
        vehicleNumber: editVehicle.toUpperCase(),
        vehiclePlate: editVehicle.toUpperCase(),
        mobileNumber: editPhone
      });
      setProfile(prev => prev ? { 
        ...prev, 
        displayName: editName,
        fullName: editName,
        vehicleNumber: editVehicle.toUpperCase(),
        vehiclePlate: editVehicle.toUpperCase(),
        mobileNumber: editPhone
      } : null);
      setIsEditing(false);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to update profile settings.');
    } finally {
      setUpdating(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportForm.name || !supportForm.email || !supportForm.message) return;
    
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('support_tickets').insert({
        ...supportForm,
        userId: session?.user?.id || 'guest',
        status: 'new',
        createdAt: new Date().toISOString(),
        targetEmail: 'twosidecoderss@gmail.com'
      });
      
      setShowSuccess(true);
      setSupportForm({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to submit ticket request.');
    } finally {
      setSending(false);
    }
  };

  const faqs = [
    {
      q: "How to book a slot?",
      a: "Go to the 'Book' tab, select your preferred floor/zone, choose an empty slot (green), select your vehicle type and duration, then confirm your reservation."
    },
    {
      q: "How payment works?",
      a: "Charges are calculated hourly based on vehicle type. You can pay via Smart Credits in the app once your session is ready for checkout."
    },
    {
      q: "Why gate access denied?",
      a: "Access is granted only for active reservations. Ensure your vehicle matches the registered number and you are within your booked time slot."
    },
    {
      q: "How to cancel booking?",
      a: "Currently, bookings can be cancelled before arrival. Contact support if you need a refund for a pre-paid reservation."
    }
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
    </div>
  );

  return (
    <div className="p-6 space-y-10 pb-32 max-w-md mx-auto">
      {/* Profile Header */}
      <section className="space-y-6">
        <header className="flex justify-between items-center bg-white/[0.02] border border-white/[0.05] p-5 rounded-[2rem] backdrop-blur-xl">
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400">Settings Pane</p>
            <h1 className="text-2xl font-black italic uppercase tracking-tight text-white">System Config</h1>
          </div>
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="w-11 h-11 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 active:scale-90 transition-all rounded-2xl flex items-center justify-center text-rose-400"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>
      </section>

      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3">
          <Info className="w-4 h-4 text-rose-400 shrink-0" />
          <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Profile Section */}
      <section className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] px-2 text-white/30">User Profile</h3>
        <div className="border border-white/10 rounded-[2.5rem] p-6 relative overflow-hidden backdrop-blur-xl bg-white/[0.02] shadow-2xl">
           <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
             <UserIcon className="w-24 h-24 text-cyan-400" />
           </div>
           
           <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-4">
               <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg border border-cyan-400/20">
                  <span className="text-2xl font-black text-white">{(editName[0] || profile?.displayName?.[0] || 'U').toUpperCase()}</span>
               </div>
               {isEditing ? (
                 <div className="space-y-2 flex-1">
                    <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="border rounded-xl px-3 py-1.5 text-xs font-extrabold outline-none bg-white/10 border-white/20 text-white w-full uppercase tracking-wider focus:border-cyan-400"
                      placeholder="FULL NAME"
                      autoFocus
                    />
                    <p className="text-[10px] tracking-wider font-extrabold text-white/40">{profile?.email}</p>
                  </div>
               ) : (
                  <div className="flex-1">
                    <h2 className="text-lg font-extrabold text-white flex items-center gap-1.5 leading-tight">{profile?.fullName || profile?.displayName || 'Active Member'} <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" /></h2>
                    <p className="text-[10px] tracking-wider font-extrabold text-white/40">{profile?.email}</p>
                  </div>
               )}
             </div>
             
             <button 
              onClick={() => {
                if (isEditing) {
                  handleSaveProfile();
                } else {
                  setEditName(profile?.fullName || profile?.displayName || '');
                  setEditVehicle(profile?.vehiclePlate || profile?.vehicleNumber || '');
                  setEditPhone(profile?.mobileNumber || '');
                  setIsEditing(true);
                }
              }}
              disabled={updating}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 z-20 ${isEditing ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border border-emerald-400/20' : 'bg-white/10 text-white hover:bg-white/15'}`}
             >
               {updating ? 'Saving...' : isEditing ? 'Save' : 'Edit'}
             </button>
           </div>

           <div className="grid grid-cols-1 gap-3 mb-3">
              <div className="bg-white/[0.01] p-4 rounded-2xl border border-white/5 space-y-3 shadow-inner">
                <div>
                  <label className="text-[9px] uppercase font-black tracking-widest mb-1 block text-white/25">Vehicle Plate</label>
                  {isEditing ? (
                    <input 
                      type="text"
                      value={editVehicle}
                      onChange={(e) => setEditVehicle(e.target.value.toUpperCase())}
                      className="text-sm font-extrabold outline-none w-full border-b border-cyan-500/20 py-1 bg-transparent text-cyan-400 uppercase tracking-widest focus:border-cyan-400"
                    />
                  ) : (
                    <p className="text-sm font-black text-cyan-400 uppercase tracking-widest leading-none">{profile?.vehiclePlate || profile?.vehicleNumber || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="text-[9px] uppercase font-black tracking-widest mb-1 block text-white/25">Mobile Contact</label>
                  {isEditing ? (
                    <input 
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
                      className="text-sm font-extrabold outline-none w-full border-b border-cyan-500/20 py-1 bg-transparent text-cyan-400 tracking-wider focus:border-cyan-400"
                    />
                  ) : (
                    <p className="text-sm font-black text-slate-300 tracking-wider leading-none">{profile?.mobileNumber || 'N/A'}</p>
                  )}
                </div>
              </div>
           </div>

           <div className="grid grid-cols-1 gap-3">
              <div className="bg-white/[0.01] p-3 rounded-2xl border border-white/5 shadow-inner">
                 <p className="text-[9px] uppercase font-black tracking-widest mb-1 text-white/25">Active Safe Slot</p>
                 <div className="flex items-center gap-2">
                   <div className={`w-2.5 h-2.5 rounded-full ${activeBooking ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-white/20'}`} />
                   <p className="text-xs font-black uppercase text-emerald-400">{activeBooking && activeBooking.slotId ? `S${activeBooking.slotId.split('-').pop()}` : 'No Active Session'}</p>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Parking Status */}
      <section className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] px-2 text-white/30">Analytics Portal</h3>
        <div className="border border-white/10 rounded-[2.5rem] p-6 space-y-6 bg-gradient-to-br from-cyan-500/5 to-indigo-500/5 backdrop-blur-xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/20">
                <Smartphone className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-extrabold text-white">Smart Status</p>
                <p className="text-[10px] uppercase font-black tracking-widest text-cyan-400/80">
                  {activeBooking ? activeBooking.status : 'No Active Session'}
                </p>
              </div>
            </div>
            {activeBooking && (
               <div className="text-right">
                 <p className="text-sm font-black text-cyan-400">₹{activeBooking.totalBill || 0}</p>
                 <p className="text-[9px] uppercase font-bold text-white/40">Est. Charge</p>
               </div>
            )}
          </div>
          
          <button 
            onClick={() => navigate('/history')}
            className="w-full flex items-center justify-between p-4 rounded-2xl transition-all bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <History className="w-4 h-4 text-white/60" />
              <span className="text-xs font-extrabold text-white">View Parking History</span>
            </div>
            <ChevronDown className="-rotate-90 w-4 h-4 text-white/30" />
          </button>
        </div>
      </section>

      {/* Customization */}
      <section className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] px-2 text-white/30">Notification Switchboard</h3>
        <div className="border border-white/10 rounded-[2.5rem] p-4 space-y-2 bg-white/[0.02] backdrop-blur-xl">
          <ToggleItem 
            isDarkMode={isDarkMode}
            icon={<Bell className="w-4 h-4 text-cyan-400" />} 
            label="Booking Alerts" 
            active={notifs.bookingAlerts} 
            onClick={() => handleToggleNotif('bookingAlerts')} 
          />
          <ToggleItem 
            isDarkMode={isDarkMode}
            icon={<CreditCard className="w-4 h-4 text-cyan-400" />} 
            label="Payment Alerts" 
            active={notifs.paymentAlerts} 
            onClick={() => handleToggleNotif('paymentAlerts')} 
          />
          <ToggleItem 
            isDarkMode={isDarkMode}
            icon={<Smartphone className="w-4 h-4 text-cyan-400" />} 
            label="Parking Reminders" 
            active={notifs.parkingReminders} 
            onClick={() => handleToggleNotif('parkingReminders')} 
          />
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] px-2 text-white/30">Common Questions</h3>
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02] backdrop-blur-md">
               <button 
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex justify-between items-center p-5 text-left"
               >
                 <span className="text-xs font-extrabold text-white">{faq.q}</span>
                 <ChevronDown className={`w-4 h-4 transition-transform text-white/30 ${openFaq === idx ? 'rotate-180' : ''}`} />
               </button>
               <AnimatePresence>
                 {openFaq === idx && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-5 pb-5"
                    >
                      <p className="text-[11px] leading-relaxed text-slate-300 font-bold">{faq.a}</p>
                    </motion.div>
                 )}
               </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* Help & Support */}
      <section className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] px-2 text-white/30">Support Portal</h3>
        <form onSubmit={handleSupportSubmit} className="border border-white/10 rounded-[2.5rem] p-6 space-y-4 bg-white/[0.02] backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-cyan-500/10 border border-cyan-500/25 rounded-xl flex items-center justify-center shadow-md">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-extrabold text-white">Contact Terminal</h4>
                <p className="text-[9px] font-black text-cyan-400 uppercase tracking-widest font-mono">Response within 2 hours</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <input 
                 type="text" 
                 placeholder="Name" 
                 required
                 value={supportForm.name}
                 onChange={e => setSupportForm({...supportForm, name: e.target.value})}
                 className="border rounded-xl p-3 text-xs outline-none focus:border-cyan-400 transition-colors bg-white/5 border-white/10 text-white font-bold"
               />
               <input 
                 type="email" 
                 placeholder="Email" 
                 required
                 value={supportForm.email}
                 onChange={e => setSupportForm({...supportForm, email: e.target.value})}
                 className="border rounded-xl p-3 text-xs outline-none focus:border-cyan-400 transition-colors bg-white/5 border-white/10 text-white font-bold"
               />
            </div>
            <input 
              type="text" 
              placeholder="Subject" 
              value={supportForm.subject}
              onChange={e => setSupportForm({...supportForm, subject: e.target.value})}
              className="w-full border rounded-xl p-3 text-xs outline-none focus:border-cyan-400 transition-colors bg-white/5 border-white/10 text-white font-bold"
            />
            <textarea 
             placeholder="Describe your issue..." 
             rows={4}
             required
             value={supportForm.message}
             onChange={e => setSupportForm({...supportForm, message: e.target.value})}
             className="w-full border rounded-xl p-3 text-xs outline-none focus:border-cyan-400 transition-colors resize-none bg-white/5 border-white/10 text-white font-bold"
            />
            <button 
             type="submit"
             disabled={sending}
             className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-cyan-500/15 border border-cyan-400/20 active:scale-95 text-xs uppercase tracking-widest"
            >
              {sending ? <motion.div animate={{rotate: 360}} transition={{repeat: Infinity, duration: 1, ease: 'linear'}}><Smartphone className="w-4 h-4 text-cyan-400"/></motion.div> : <Send className="w-4 h-4" />}
              SUBMIT TICKET
            </button>
        </form>
      </section>

      {/* Success Notification */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-6 right-6 z-50 px-6 py-4 bg-emerald-600 border border-emerald-500/20 rounded-2xl flex items-center gap-3 shadow-[0_4px_30px_rgba(16,185,129,0.3)]"
          >
            <CheckCircle2 className="w-5 h-5 text-white" />
            <p className="text-xs font-black uppercase tracking-widest text-white leading-none">Support payload sent successfully</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSaveSuccess && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-6 right-6 z-50 px-6 py-4 bg-emerald-600 border border-emerald-500/20 rounded-2xl flex items-center gap-3 shadow-[0_4px_30px_rgba(16,185,129,0.3)]"
          >
            <CheckCircle2 className="w-5 h-5 text-white" />
            <p className="text-xs font-black uppercase tracking-widest text-white leading-none">Profile Saved Successfully</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Confirm Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-neutral-900 border border-white/10 rounded-[2rem] p-6 max-w-xs w-full text-center space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-rose-500/10 blur-[40px] rounded-full" />
              <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto shadow-md">
                <LogOut className="w-6 h-6" />
              </div>
              <div className="space-y-2 relative z-10">
                <h3 className="text-lg font-black italic uppercase text-white leading-none">Sign Out</h3>
                <p className="text-[10px] uppercase tracking-widest font-black text-white/40 leading-relaxed">Are you sure you want to exit your active secure terminal session?</p>
              </div>
              <div className="grid grid-cols-2 gap-3 relative z-10">
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="bg-white/5 border border-white/5 text-white/60 hover:text-white font-extrabold uppercase py-3.5 rounded-xl text-[10px] tracking-wider active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleLogoutActual}
                  className="bg-rose-600 text-white font-extrabold uppercase py-3.5 rounded-xl text-[10px] tracking-wider active:scale-95 transition-transform shadow-lg shadow-rose-900/15"
                >
                  Yes, Log Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {showStatusToast?.show && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3 whitespace-nowrap ${showStatusToast.enabled ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'bg-neutral-800 text-white/60 border border-white/5'}`}
          >
            <div className={`w-2 h-2 rounded-full ${showStatusToast.enabled ? 'bg-black animate-pulse' : 'bg-white/20'}`} />
            Notifications {showStatusToast.enabled ? 'Activated' : 'Suspended'}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="pt-10 pb-4 text-center opacity-20 pointer-events-none">
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white">Twoside Coders Smart Gate System</p>
      </footer>
    </div>
  );
}

function ToggleItem({ icon, label, active, onClick, isDarkMode }: { icon: any, label: string, active: boolean, onClick: () => void, isDarkMode: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/[0.01] border border-white/[0.02] rounded-2xl mb-1">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-white/5 text-white/60' : 'bg-black/5 text-black/60'}`}>
          {icon}
        </div>
        <span className="text-xs font-extrabold text-white">{label}</span>
      </div>
      <button 
        onClick={onClick}
        className={`w-11 h-6 rounded-full p-1 transition-colors relative duration-300 ${active ? 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)]' : 'bg-white/10'}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${active ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
