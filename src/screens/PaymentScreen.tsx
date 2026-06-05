import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Clock, Wallet, ChevronLeft, CheckCircle2, Info, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { parkingService } from '../services/parkingService';
import { Booking, BookingStatus } from '../types';

export default function PaymentScreen() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [bill, setBill] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  const isCancellation = booking?.sessionStatus === 'cancellation_pending';

  useEffect(() => {
    // Only subscribe to bookings once to save quota
    const unsubBookings = parkingService.subscribeToUserBookings((bookings) => {
      // If we are currently in a success or paying state, let the local state handle it
      if (success || paying) return;

      const active = bookings.find(b => 
        b.status === BookingStatus.ACTIVE || 
        b.status === BookingStatus.TIME_ENDING ||
        b.status === BookingStatus.OVERTIME_ACTIVE ||
        b.status === BookingStatus.PAYMENT_PENDING
      );
      
      if (active) {
        setBooking(active);
        const currentBillValue = active.currentBill || active.totalBill || (active.baseAmount || 20);
        setBill(currentBillValue);
        setIsOvertime(active.status === BookingStatus.OVERTIME_ACTIVE);
      } else {
        setBooking(null);
      }
    });
    return () => unsubBookings();
  }, [success, paying]); // Re-sync only when state transitions

  useEffect(() => {
    if (!booking || success) return;

    const updateTimerAndBill = () => {
      if (isCancellation) {
        setTimeLeft('CANCELLATION PENALTY PROTOCOL');
        setIsOvertime(false);
        setBill(booking.totalBill || booking.currentBill || 10);
        return;
      }

      const now = new Date();
      /* Sync removed to conserve quota */
      
      const startTime = booking.startTime?.toDate ? booking.startTime.toDate() : new Date(booking.startTime || Date.now());
      const baseDurationMs = (booking.timeLimit || 4) * 3600000;
      const expiryTime = new Date(startTime.getTime() + baseDurationMs);
      const diffMs = expiryTime.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setIsOvertime(true);
        const overtimeMs = Math.abs(diffMs);
        const cycleMs = 30 * 60 * 1000;
        const currentCycleMsTaken = overtimeMs % cycleMs;
        const cycleRemainingMs = cycleMs - currentCycleMsTaken;

        const m = Math.floor(cycleRemainingMs / 60000).toString().padStart(2, '0');
        const s = Math.floor((cycleRemainingMs % 60000) / 1000).toString().padStart(2, '0');
        setTimeLeft(`OVERTIME: ${m}:${s}`);
      } else {
        setIsOvertime(false);
        const h = Math.floor(diffMs / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
        setTimeLeft(`${h}:${m}:${s} remaining`);
      }
      
      // Calculate bill locally for real-time accuracy
      const total = parkingService.calculateCurrentBill(booking);
      setBill(total);
    };

    updateTimerAndBill();
    const interval = setInterval(updateTimerAndBill, 1000);

    return () => clearInterval(interval);
  }, [booking?.id, booking?.startTime, booking?.timeLimit, booking?.currentBill, booking?.totalBill, booking?.status, success]);

  const handlePay = async () => {
    if (!booking || paying || success) return;
    
    setPaying(true);
    setError('');
    
    try {
      // Final verification delay for UX
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const result = await parkingService.processPayment(booking.id);
      
      if (result) {
        setSuccess(true);
        // Navigate after showing success animation
        setTimeout(() => {
          if (isCancellation) {
            navigate('/');
          } else {
            navigate('/exit');
          }
        }, 2000);
      } else {
        setError('Payment verification failed. Please try again.');
        setPaying(false);
      }
    } catch (err: any) {
      console.error('Payment Flow Error:', err);
      setError(err.message || 'Payment processing failed. Check your balance.');
      setPaying(false);
    }
  };

  if (!booking && !success) {
    return (
      <div className="p-6 text-center pt-20 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-inner">
          <Clock className="w-10 h-10 text-white/20" />
        </div>
        <h2 className="text-xl font-black italic uppercase tracking-tight text-white mb-2">No Active Session</h2>
        <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest leading-normal max-w-[220px]">You do not have any pending payments or ongoing sessions at our gateway.</p>
        <Link to="/" className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:scale-102 hover:shadow-[0_4px_15px_rgba(6,182,212,0.15)] active:scale-98 transition-all px-8 py-4.5 rounded-2xl text-[10px] font-black uppercase tracking-widest mt-8 border border-cyan-400/20">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-lg mx-auto">
      <header className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.05] p-5 rounded-[2rem] backdrop-blur-xl">
        <Link to="/gate" className="w-10 h-10 bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-cyan-400 rounded-full flex items-center justify-center text-white transition-all">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black italic uppercase tracking-tight text-white">{isCancellation ? 'Cancellation Fee' : 'Secure Checkout'}</h1>
          <p className="text-[9px] font-extrabold text-cyan-400 uppercase tracking-[0.2em] leading-tight">{success ? 'Transaction Complete' : 'Process Protocol'}</p>
        </div>
      </header>

      {success ? (
        <motion.div 
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 space-y-8 glass rounded-[2.5rem] border border-white/5 relative overflow-hidden"
        >
          {/* Internal ambient glowing decoration */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="relative">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 bg-emerald-500 rounded-full"
            />
            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.4)] relative z-10 border border-emerald-400/30">
              <CheckCircle2 className="w-12 h-12 text-white animate-pulse" />
            </div>
          </div>
          <div className="text-center space-y-2 relative z-10">
            <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase flex items-center justify-center gap-2">
              {isCancellation ? 'Cancelled!' : 'Paid!'} <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
            </h2>
            <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.3em]">
              {isCancellation ? 'Reservation Cancelled Successfully' : 'Session Successfully Closed'}
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-full flex items-center gap-3 relative z-10">
             <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
             <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
               {isCancellation ? 'Slot Status: EMPTY (Released)' : 'Proceed to Exit Gate'}
             </span>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3"
            >
              <div className="w-8 h-8 bg-rose-500/20 rounded-lg flex items-center justify-center shrink-0 border border-rose-500/15">
                <Info className="w-4 h-4 text-rose-400 font-black animate-pulse" />
              </div>
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-relaxed">{error}</p>
            </motion.div>
          )}

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-[2.5rem] p-8 text-center relative overflow-hidden shadow-2xl backdrop-blur-2xl">
             <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-cyan-500/5 blur-[80px]" />
             
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-2">
               {isCancellation ? 'Cancellation Penalty Balance' : 'Checkout Balance'}
             </p>
             <h2 className="text-6xl font-black italic tracking-tighter flex items-center justify-center gap-1 text-white">
               <span className="text-2xl text-cyan-400 mt-2">₹</span>
               {bill || (booking?.currentBill || booking?.totalBill || 20)}
             </h2>
             
             <div className="flex flex-col gap-2 mt-8 p-4 bg-white/5 rounded-3xl border border-white/5 text-[9px] font-black uppercase tracking-widest shadow-inner">
               {isCancellation ? (
                 <div className="flex justify-between items-center px-2 text-rose-400">
                   <span>Cancellation Penalty Fee (50%)</span>
                   <span>₹{bill || booking?.totalBill || booking?.currentBill}</span>
                 </div>
               ) : (
                 <>
                   <div className="flex justify-between items-center px-2">
                     <span className="text-white/30">Standard Rate</span>
                     <span className="text-white">₹{booking?.baseAmount || (booking?.vehicleType === 'bike' ? 10 : 20)}</span>
                   </div>
                   {booking?.overtimeCharge ? (
                     <div className="flex flex-col gap-2 w-full pt-2 mt-2 border-t border-white/5">
                       <div className="flex justify-between items-center px-2 text-rose-400">
                         <span>Overtime (Cycle x{(booking as any).overtimeCycle || 1})</span>
                         <span className="font-black italic">+ ₹{booking.overtimeCharge}</span>
                       </div>
                     </div>
                   ) : (
                     <div className="flex justify-between items-center px-2 text-emerald-400/60">
                       <span>Overtime Protocol</span>
                       <span>None</span>
                     </div>
                   )}
                 </>
               )}
             </div>

             <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-2 gap-4">
                <div className="text-left bg-white/5 p-4 rounded-2xl border border-white/5 shadow-sm">
                  <p className="text-[8px] uppercase font-black text-white/20 tracking-widest mb-1">Assigned Slot</p>
                  <p className="font-black italic text-xl uppercase text-white">{booking?.slotId?.replace('slot-', '') || 'S?'}</p>
                </div>
                 <div className="text-left bg-white/5 p-4 rounded-2xl border border-white/5 shadow-sm">
                   <p className="text-[8px] uppercase font-black text-white/20 tracking-widest mb-1">Time Status</p>
                   <p className={`font-black italic text-base tracking-tight uppercase ${isOvertime ? 'text-red-400' : 'text-cyan-400 animate-pulse'}`}>{isCancellation ? 'EXPIRED (10m+)' : timeLeft}</p>
                 </div>
             </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 px-2 flex items-center gap-2">
              <CreditCard className="w-3 h-3 text-cyan-400" /> Select Payment Method
            </h3>
            <div className="bg-white/5 border border-cyan-500/20 rounded-[2rem] p-5 flex items-center gap-4 group hover:bg-cyan-500/5 hover:border-cyan-500/30 transition-all cursor-pointer relative overflow-hidden shadow-[0_4px_24px_rgba(6,182,212,0.06)]">
               <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 bg-cyan-500/20 border border-cyan-500/25 rounded-2xl flex items-center justify-center relative z-10 shadow-lg">
                <Wallet className="w-6 h-6 text-cyan-400 animate-pulse" />
              </div>
              <div className="flex-1 relative z-10">
                <p className="font-black italic uppercase tracking-tight text-white flex items-center gap-2">Digital Wallet <Sparkles className="w-3 h-3 text-cyan-400" /></p>
                <p className="text-[10px] font-extrabold text-cyan-400/60 uppercase tracking-widest">Available: ₹5,000</p>
              </div>
              <div className="w-6 h-6 border-2 border-cyan-400 rounded-full flex items-center justify-center relative z-10 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                <div className="w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.6)] animate-pulse" />
              </div>
            </div>
          </div>

          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full bg-gradient-to-r from-cyan-500 via-indigo-600 to-fuchsia-600 hover:scale-[1.01] active:scale-98 disabled:opacity-50 text-white font-black italic uppercase tracking-widest py-5 rounded-3xl shadow-2xl shadow-cyan-500/20 transition-all flex flex-col items-center justify-center gap-1 border border-cyan-400/20 relative overflow-hidden"
          >
            {paying ? (
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-xs uppercase font-extrabold tracking-widest">Processing Transaction...</span>
              </div>
            ) : (
              <>
                <span className="relative z-10 text-sm tracking-widest">Confirm Payment</span>
                <span className="text-[8.5px] font-black text-white/75 tracking-[0.3em] relative z-10 mt-1 uppercase">Total: ₹{bill || (booking?.currentBill || booking?.totalBill || 20)}</span>
              </>
            )}
          </button>
          
          <div className="text-center">
             <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
               <Info className="w-3.5 h-3.5 text-white/20" /> Secure Encrypted Transmission Protocol
             </p>
          </div>
        </div>
      )}
    </div>
  );
}
