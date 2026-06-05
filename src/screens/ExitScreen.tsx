import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Power, ShieldCheck, ShieldX, ChevronLeft, LogOut, Radio, Info } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { parkingService } from '../services/parkingService';
import { Booking, BookingStatus, GateState } from '../types';

export default function ExitScreen() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [gateState, setGateState] = useState<GateState | null>(null);
  const [exiting, setExiting] = useState(false);
  const [error, setError] = useState('');
  const [gateCountdown, setGateCountdown] = useState(0);
  const countdownRef = React.useRef<any>(null);
  const navigate = useNavigate();
  const [showExitOpenModal, setShowExitOpenModal] = useState(false);

  useEffect(() => {
    const unsub = parkingService.subscribeToUserBookings((bookings) => {
      // Find session that is paid or completed (but we are still on this screen)
      const active = bookings.find(b => 
        b.status === BookingStatus.PAID || 
        b.status === BookingStatus.COMPLETED
      );
      setBooking(active || null);
    });
    const unsubGate = parkingService.subscribeToGate(setGateState);
    return () => { 
      unsub(); 
      unsubGate(); 
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleExit = async () => {
    if (!booking || exiting) return;
    setExiting(true);
    setError('');
    try {
      if (countdownRef.current) clearInterval(countdownRef.current);

      // 1. Open Gate
      await parkingService.controlGate('Open', booking.id);
      setGateCountdown(5);
      
      // 2. Start a countdown timer that updates every second
      countdownRef.current = setInterval(async () => {
        setGateCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = null;
            
            // Execute the system close and exit protocol
            (async () => {
              try {
                await parkingService.vehicleExit(booking.id, booking.slotId);
                await parkingService.controlGate('Closed');
                navigate('/history');
              } catch (innerErr) {
                console.error("Simulation exit error:", innerErr);
                setExiting(false);
                setError("Failed to complete system closure protocol. Please try again.");
              }
            })();
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Gate open error:", err);
      setExiting(false);
      setError("Failed to initiate exit gate connection. Try again.");
    }
  };

  if (!booking) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[80vh] text-center space-y-6">
        <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20 shadow-[0_0_30px_rgba(244,63,94,0.15)]">
          <ShieldX className="w-12 h-12 text-rose-500 animate-pulse" />
        </div>
        <div className="px-10 space-y-2">
          <h2 className="text-2xl font-black italic uppercase text-white">Exit Restricted</h2>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider leading-relaxed">
            Please complete your payment before attempting to open the exit security gateway.
          </p>
        </div>
        <Link 
          to="/payment"
          className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-black py-4 px-10 rounded-2xl shadow-xl shadow-cyan-500/15 border border-cyan-400/20 flex items-center gap-2.5 text-xs uppercase tracking-widest hover:scale-102 active:scale-98 transition-transform"
        >
          Check Bill / Pay Now
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-10 max-w-lg mx-auto">
       <header className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.05] p-5 rounded-[2rem] backdrop-blur-xl">
        <Link to="/payment" className="w-10 h-10 bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-cyan-400 rounded-full flex items-center justify-center transition-all text-white">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black italic uppercase tracking-tight text-white">Secure Exit</h1>
          <p className="text-[9px] font-extrabold text-cyan-400 uppercase tracking-[0.2em] leading-none">Gate Clearance Protocol</p>
        </div>
      </header>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3">
          <Info className="w-4 h-4 text-rose-400 font-bold shrink-0" />
          <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-relaxed">{error}</p>
        </div>
      )}

      <div className="text-center space-y-3">
        <div className="bg-emerald-500/10 text-emerald-400 px-4.5 py-2 rounded-full inline-flex items-center gap-2 border border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-[9.5px] font-black uppercase tracking-widest leading-tight">Terminal Authorized</span>
        </div>
        <h2 className="text-3xl font-black italic uppercase text-white tracking-tight">Exit Gate State</h2>
      </div>

      <div className="flex flex-col items-center gap-8 py-6">
        <button
          onClick={() => setShowExitOpenModal(true)}
          disabled={exiting}
          className={`w-44 h-44 rounded-full border-2 flex flex-col items-center justify-center gap-3.5 transition-all relative ${
            gateState?.status === 'Open' || gateCountdown > 0
            ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.35)] text-emerald-400' 
            : 'bg-cyan-500/5 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/40'
          }`}
        >
          {(exiting || gateCountdown > 0) && (
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-[-12px] border-t-2 border-cyan-400 rounded-full"
            />
          )}
          <Power className={`w-11 h-11 ${gateState?.status === 'Open' || gateCountdown > 0 ? 'text-emerald-400' : 'text-cyan-400 animate-pulse'}`} />
          <span className="font-black uppercase tracking-[0.25em] text-[10px]">
            {gateCountdown > 0 ? `Gate Open (${gateCountdown}s)` : exiting ? 'Releasing...' : 'Open Gate'}
          </span>
        </button>

        <div className="bg-white/[0.02] border border-white/[0.06] p-5 rounded-3xl w-full flex items-center gap-4.5 shadow-sm backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-2xl rounded-full" />
          <div className="w-11 h-11 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center shrink-0">
            <Radio className="text-cyan-400 w-5.5 h-5.5 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">Security Loop</p>
            <p className="text-xs font-extrabold text-white/85 mt-1.5 uppercase tracking-wide">Radar Automatic Closure protocol Active</p>
          </div>
        </div>
      </div>

      {/* Exit Gate Open Confirmation Modal */}
      <AnimatePresence>
        {showExitOpenModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
              
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 mx-auto shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <Power className="w-8 h-8 text-emerald-400 animate-pulse" />
                </div>
                <h3 className="text-lg font-black italic uppercase text-white mt-4">Open Exit Gate?</h3>
                <p className="text-white/40 text-[10px] uppercase font-black tracking-wider leading-relaxed px-2">
                  Confirm to open the exit security barrier. The gate will remain open for 5 seconds for your vehicle to exit safely.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowExitOpenModal(false);
                    handleExit();
                  }}
                  className="w-full font-black py-4 rounded-xl text-[10px] uppercase tracking-widest text-center flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/10 transition-all hover:scale-[1.02] active:scale-98"
                >
                  Confirm & Open Exit Gate
                </button>
                <button
                  onClick={() => setShowExitOpenModal(false)}
                  className="w-full bg-white/5 hover:bg-white/10 text-white/60 font-black py-4 rounded-xl text-[10px] uppercase tracking-widest text-center transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
