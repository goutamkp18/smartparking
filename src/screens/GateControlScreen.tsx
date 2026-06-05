import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Power, ShieldCheck, ShieldAlert, Clock, Wallet, MapPin, CheckCircle, Radio } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { parkingService } from '../services/parkingService';
import { Booking, BookingStatus, GateState } from '../types';

export default function GateControlScreen() {
  const [userBooking, setUserBooking] = useState<Booking | null>(null);
  const [gateState, setGateState] = useState<GateState | null>(null);
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const [bill, setBill] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [entering, setEntering] = useState(false);
  const [now, setNow] = useState(new Date());
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [gateCountdown, setGateCountdown] = useState(0);
  const countdownRef = React.useRef<any>(null);
  const navigate = useNavigate();

  // Unified clock timer ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => {
      clearInterval(timer);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    // If the booking goes active, make sure to reset the countdown
    if (userBooking?.status === BookingStatus.ACTIVE) {
      setGateCountdown(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
  }, [userBooking?.status]);

  useEffect(() => {
    // Shared listener for bookings and gate
    const unsubBookings = parkingService.subscribeToUserBookings((bookings) => {
      const active = bookings.find(b => 
        b.status === BookingStatus.RESERVED || 
        b.status === BookingStatus.ACTIVE ||
        b.status === BookingStatus.TIME_ENDING ||
        b.status === BookingStatus.OVERTIME_ACTIVE ||
        b.status === BookingStatus.PAYMENT_PENDING
      );
      setUserBooking(active || null);
    });

    const unsubGate = parkingService.subscribeToGate(setGateState);

    return () => {
      unsubBookings();
      unsubGate();
    };
  }, []);

  useEffect(() => {
    if (!userBooking || (
      userBooking.status !== BookingStatus.ACTIVE &&
      userBooking.status !== BookingStatus.TIME_ENDING &&
      userBooking.status !== BookingStatus.OVERTIME_ACTIVE &&
      userBooking.status !== BookingStatus.PAYMENT_PENDING
    )) {
        setTimeLeft('00:00:00');
        return;
    }

    if (document.visibilityState !== 'visible') return;

    const startTime = (userBooking.startTime as any).toDate ? (userBooking.startTime as any).toDate() : new Date(userBooking.startTime as any);
    const baseDurationMs = (userBooking.timeLimit || 4) * 3600000;
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
      setTimeLeft(`${h}:${m}:${s}`);
    }

    setBill(parkingService.calculateCurrentBill(userBooking));
  }, [userBooking, now]);

  // Compute 10 minutes reservation cancel window limits
  const { canCancel, cancelTimeLeftStr } = useMemo(() => {
    if (!userBooking || userBooking.status !== BookingStatus.RESERVED) {
      return { canCancel: false, cancelTimeLeftStr: '' };
    }
    const startTime = (userBooking.startTime as any).toDate 
      ? (userBooking.startTime as any).toDate() 
      : new Date(userBooking.startTime as any);
    const cancelExpiry = startTime.getTime() + 10 * 60 * 1000; // 10 minutes limit
    const diffMs = cancelExpiry - now.getTime();
    
    if (diffMs <= 0) {
      return { canCancel: false, cancelTimeLeftStr: '00:00' };
    }
    
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return {
      canCancel: true,
      cancelTimeLeftStr: `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    };
  }, [userBooking, now]);

  const handleCancelConfirm = async () => {
    if (!userBooking || cancelling) return;
    setCancelling(true);
    try {
      // Initiate cancellation (either free or paid) and route to payment screen
      await parkingService.initiateCancellation(userBooking.id, userBooking.slotId, canCancel);
      setShowCancelModal(false);
      navigate('/payment');
    } catch (err: any) {
      console.error(err);
      parkingService.notify('Cancellation Error', err.message || 'Could not initiate cancellation', 'booking');
    } finally {
      setCancelling(false);
    }
  };

  const handleGate = async (status: 'Open' | 'Closed') => {
    if (!userBooking) return;
    await parkingService.controlGate(status, userBooking.id);
  };

  const handleOpenGate = async () => {
    setShowOpenModal(true);
  };

  const handleConfirmOpenAndEntry = async () => {
    if (!userBooking || entering) return;
    setEntering(true);
    setShowOpenModal(false);
    try {
      // 1. Open the gate in database
      await parkingService.controlGate('Open', userBooking.id);
      
      // 2. Start 5 seconds countdown
      setGateCountdown(5);

      if (countdownRef.current) clearInterval(countdownRef.current);

      countdownRef.current = setInterval(async () => {
        setGateCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = null;

            // Complete vehicle entry and close gate when countdown finishes
            (async () => {
              try {
                await parkingService.vehicleEntry(userBooking.id, userBooking.slotId);
                await parkingService.controlGate('Closed', userBooking.id);
                navigate('/navigation');
              } catch (err) {
                console.error(err);
              } finally {
                setEntering(false);
              }
            })();

            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error(err);
      setEntering(false);
    }
  };

  if (!userBooking) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[80vh] text-center space-y-6">
        <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20 shadow-[0_0_30px_rgba(244,63,94,0.15)]">
          <ShieldAlert className="w-12 h-12 text-rose-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black italic uppercase text-white">Access Denied</h2>
          <p className="text-white/40 text-xs px-10 leading-relaxed font-bold uppercase tracking-wider">You need an active booking to access the gate controls. Please reserve a slot first.</p>
        </div>
        <Link 
          to="/book"
          className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-black py-4.5 px-10 rounded-2xl shadow-xl shadow-cyan-500/15 border border-cyan-400/20 flex items-center gap-2.5 text-xs uppercase tracking-widest hover:scale-102 active:scale-98 transition-transform"
        >
          Reserve Slot Now
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 pb-32 space-y-8">
      <header className="flex justify-between items-center bg-white/[0.02] border border-white/[0.05] p-5 rounded-[2rem] backdrop-blur-xl">
        <div className="space-y-1">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400">
            {userBooking.status === BookingStatus.RESERVED ? 'Access Protocol' : 'Live Session'}
          </p>
          <h1 className="text-2xl font-black italic uppercase tracking-tight text-white">Entry Gate</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/25 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{userBooking.slotId?.replace('slot-', '') || '?'} Assigned</span>
          </div>
          <div className="bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/5 flex items-center gap-2">
            <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{userBooking.vehicleType}</span>
          </div>
        </div>
      </header>

      {/* Conditional View based on Status */}
      {userBooking.status === BookingStatus.ACTIVE ? (
        <div className="space-y-6">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-[2.5rem] p-8 text-center relative overflow-hidden backdrop-blur-3xl shadow-2xl">
             <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-cyan-500/10 blur-[80px]" />
             <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-fuchsia-100/5 blur-[80px]" />
             
             <Clock className={`w-10 h-10 mx-auto mb-4 ${isOvertime ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`} />
             <h2 className={`text-4xl font-black tracking-tighter mb-4 ${isOvertime ? 'text-red-500 font-mono' : 'text-white font-sans'}`}>{timeLeft}</h2>
             
             <div className="flex flex-col items-center">
               <div className="flex flex-col items-center mb-4">
                 <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3.5 py-1 rounded-full border ${isOvertime ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'}`}>
                   {isOvertime ? 'Overtime Active' : 'Live Billing'}
                 </span>
                 {isOvertime && userBooking.overtimeCycle && (
                   <span className={`text-[10px] font-black uppercase tracking-widest mt-2 ${
                     userBooking.overtimeCycle >= 3 ? 'text-red-500' : userBooking.overtimeCycle === 2 ? 'text-orange-500' : 'text-orange-400'
                   }`}>
                     x{userBooking.overtimeCycle} EXTRA SESSION
                   </span>
                 )}
               </div>
               
               <div className="flex items-baseline gap-2 bg-white/5 px-6 py-2 rounded-full border border-white/5 shadow-inner">
                 <span className="text-[10px] uppercase font-black tracking-widest text-white/50">Current Charge</span>
                 <span className="text-3xl font-black text-white">₹{bill}</span>
               </div>
             </div>
          </div>

          <Link
            to="/payment"
            className="w-full bg-gradient-to-r from-cyan-500 via-indigo-600 to-fuchsia-600 text-white font-black py-5 rounded-3xl flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-98 transition-transform shadow-2xl shadow-cyan-500/15 border border-cyan-400/20 text-xs uppercase tracking-widest"
          >
            <Wallet className="w-5 h-5 text-white" />
            Proceed to Payment / Exit
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center w-full">
            <button
              onClick={handleOpenGate}
              disabled={gateState?.status === 'Open' || gateCountdown > 0}
              className={`w-full p-8 rounded-[2rem] flex flex-col items-center justify-center gap-4 transition-all border ${
                gateState?.status === 'Open' || gateCountdown > 0
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 cursor-not-allowed shadow-inner'
                  : 'bg-white/5 border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-cyan-400 active:scale-95 duration-300 shadow-xl'
              }`}
            >
              <Power className={`w-8 h-8 ${gateState?.status === 'Open' || gateCountdown > 0 ? 'text-cyan-400 animate-pulse' : 'text-cyan-400'}`} />
              <span className={`font-black uppercase tracking-widest text-xs`}>
                {gateState?.status === 'Open' ? 'Gate is Open' : 'Open Gate'}
              </span>
            </button>
          </div>

          <AnimatePresence>
            {(gateState?.status === 'Open' || gateCountdown > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-cyan-500/5 border border-cyan-500/20 p-6 rounded-[2rem] space-y-5 shadow-[0_12px_45px_rgba(6,182,212,0.1)] relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full" />
                <div className="flex items-center gap-4.5 relative z-10">
                  <div className="w-11 h-11 bg-cyan-500/10 border border-cyan-500/25 rounded-2xl flex items-center justify-center animate-pulse">
                    <Radio className="text-cyan-400 w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">Entry Gate Active</h4>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">
                      {gateCountdown > 0 ? `GATE AUTO-CLOSING IN ${gateCountdown}s` : 'Confirm vehicle entry to activate slot security'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleConfirmOpenAndEntry}
                  disabled={entering || gateCountdown > 0}
                  className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-black py-4.5 rounded-2xl flex items-center justify-center gap-2.5 text-xs uppercase tracking-widest hover:scale-101 active:scale-98 transition-all border border-cyan-400/20 shadow-xl shadow-cyan-500/10 disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed"
                >
                  {gateCountdown > 0 
                    ? `Gate Closing in (${gateCountdown}s)` 
                    : entering 
                      ? 'Closing gate...' 
                      : 'Confirm Vehicle Entry'
                  }
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {userBooking.status === BookingStatus.RESERVED && !entering && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full bg-rose-500/10 hover:bg-rose-500/15 text-rose-400 font-extrabold py-4.5 rounded-2xl border border-rose-500/20 active:scale-[0.99] transition-transform text-xs uppercase tracking-widest mt-4 flex items-center justify-center gap-2"
            >
              Cancel Reservation {canCancel ? `(${cancelTimeLeftStr})` : '(Fee Applies)'}
            </button>
          )}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-3xl rounded-full" />
              
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20 mx-auto shadow-[0_0_20px_rgba(244,63,94,0.15)]">
                  <ShieldAlert className="w-8 h-8 text-rose-500" />
                </div>
                <h3 className="text-lg font-black italic uppercase text-white mt-4">Cancel Reservation?</h3>
                <p className="text-white/40 text-[10px] uppercase font-black tracking-wider leading-relaxed px-2">
                  {canCancel 
                    ? `You are inside the 10-minute free cancellation window. Cancellation is free of charge.`
                    : `The 10-minute free cancellation window has expired. A 50% cancellation fee of ₹${Math.round((userBooking.baseAmount || 20) * 0.5)} applies.`
                  }
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCancelConfirm}
                  disabled={cancelling}
                  className={`w-full font-black py-4 rounded-xl text-[10px] uppercase tracking-widest text-center flex items-center justify-center gap-2 transition-all ${
                    canCancel 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/10'
                      : 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/10'
                  }`}
                >
                  {cancelling 
                    ? 'Processing...' 
                    : canCancel 
                      ? 'Yes, Cancel Reservation' 
                      : `Confirm & Pay Fee`
                  }
                </button>
                <button
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  className="w-full bg-white/5 hover:bg-white/10 text-white/60 font-black py-4 rounded-xl text-[10px] uppercase tracking-widest text-center transition-all"
                >
                  Go Back
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gate Open Confirmation Modal */}
      <AnimatePresence>
        {showOpenModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full" />
              
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center border border-cyan-500/20 mx-auto shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                  <Power className="w-8 h-8 text-cyan-400" />
                </div>
                <h3 className="text-lg font-black italic uppercase text-white mt-4">Open Entrance Gate?</h3>
                <p className="text-white/40 text-[10px] uppercase font-black tracking-wider leading-relaxed px-2">
                  Confirm to open the entrance security barrier. The gate will remain open for 5 seconds for your vehicle to enter safely.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleConfirmOpenAndEntry}
                  className="w-full font-black py-4 rounded-xl text-[10px] uppercase tracking-widest text-center flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/10 transition-all hover:scale-[1.02] active:scale-98"
                >
                  Confirm & Open Gate
                </button>
                <button
                  onClick={() => setShowOpenModal(false)}
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
