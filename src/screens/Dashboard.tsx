import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  Car, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  TrendingUp,
  CreditCard,
  LogOut,
  Smartphone,
  Timer,
  Receipt,
  Zap,
  LayoutGrid,
  X,
  Sparkles,
  Info,
  Calendar,
  Compass,
  Check,
  Navigation
} from 'lucide-react';
import { parkingService } from '../services/parkingService';
import { Booking, BookingStatus, ParkingSlot, SlotStatus, UserProfile, VehicleType } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const VEHICLE_RATES: Record<string, number> = {
  [VehicleType.BIKE || 'bike']: 10,
  [VehicleType.THREE_WHEELER || 'three-wheeler']: 15,
  [VehicleType.FOUR_WHEELER || 'four-wheeler']: 20,
  [VehicleType.TRUCK || 'truck']: 50
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
        <p className="text-xs font-bold text-white mb-1">{label}</p>
        <p className="text-sm font-bold text-sky-400">
          Value: <span className="text-white">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

function LiveTimer({ booking, currentTime }: { booking: Booking, currentTime: Date }) {
  const [displayTime, setDisplayTime] = useState('');
  const [percent, setPercent] = useState(100);
  const [color, setColor] = useState('blue');

  useEffect(() => {
    const updateLocalTimer = () => {
      const startTime = (booking.startTime as any).toDate ? (booking.startTime as any).toDate() : new Date(booking.startTime as any);
      const baseDurationMs = (booking.timeLimit || 4) * 60 * 60 * 1000;
      const expiryTime = new Date(startTime.getTime() + baseDurationMs);
      const diffMs = expiryTime.getTime() - currentTime.getTime();
      
      /* Syncing removed to conserve Firestore quota */

      if (diffMs <= 0) {
        // Overtime calculation
        const overtimeMs = Math.abs(diffMs);
        const cycleMs = 30 * 60 * 1000;
        const currentCycleMsTaken = overtimeMs % cycleMs;
        const cycleRemainingMs = cycleMs - currentCycleMsTaken;

        const mins = Math.floor(cycleRemainingMs / 60000);
        const secs = Math.floor((cycleRemainingMs % 60000) / 1000);
        setDisplayTime(`${mins}m ${secs}s OVERTIME`);
        
        // Percent of current 30min cycle
        setPercent((cycleRemainingMs / cycleMs) * 100);
        setColor('red');
      } else {
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        setDisplayTime(`${hours}h ${mins}m ${secs}s`);
        
        const currentPercent = (diffMs / baseDurationMs) * 100;
        setPercent(currentPercent);

        if (diffMs <= 5 * 60 * 1000) {
          setColor('orange');
        } else if (diffMs <= 15 * 60 * 1000) {
          setColor('yellow');
        } else {
          setColor('blue');
        }
      }
    };

    updateLocalTimer();
  }, [booking.id, booking.startTime, booking.timeLimit, booking.status, currentTime]);

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-400 text-white/40',
    yellow: 'bg-yellow-500 text-yellow-400',
    orange: 'bg-orange-500 text-orange-400',
    red: 'bg-red-500 text-red-400'
  };

  const isOvertime = color === 'red';

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <Timer className={`w-3 h-3 ${(colorClasses[color] || 'bg-blue-400 text-white/40').split(' ')[1]} ${isOvertime ? 'animate-pulse' : ''}`} />
          <div className="flex flex-col">
            <span className={`text-[10px] font-black uppercase tracking-widest ${(colorClasses[color] || 'bg-blue-400 text-white/40').split(' ')[1]}`}>
              {isOvertime ? 'Overtime Active' : 'Remaining Time'}
            </span>
            {isOvertime && (booking as any).overtimeCycle && (
               <motion.span 
                 initial={{ opacity: 0, x: -5 }}
                 animate={{ opacity: 1, x: 0 }}
                 className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${
                   (booking as any).overtimeCycle >= 3 ? 'text-red-500' : (booking as any).overtimeCycle === 2 ? 'text-orange-600' : 'text-orange-400'
                 }`}
               >
                 x{(booking as any).overtimeCycle} EXTRA SESSION
               </motion.span>
            )}
          </div>
        </div>
        <span className="text-[10px] font-black font-mono tracking-wider">{displayTime}</span>
      </div>
      
      <div className={`h-1.5 w-full bg-black/20 rounded-full overflow-hidden border border-white/5`}>
        <motion.div 
          initial={false}
          animate={{ 
            width: `${percent}%`,
            backgroundColor: isOvertime ? '#ef4444' : color === 'orange' ? '#f97316' : color === 'yellow' ? '#eab308' : '#60a5fa'
          }}
          className={`h-full rounded-full transition-colors duration-500 ${isOvertime ? 'shadow-[0_0_10px_rgba(239,68,68,0.5)]' : ''}`}
        />
      </div>

      {isOvertime && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-500/20 border border-red-500/30 p-2 rounded-xl flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3 h-3 text-red-500" />
            <span className="text-[8px] font-black uppercase tracking-widest text-red-500">Extra Charges Applied: ₹10/30 min</span>
          </div>
          <span className="text-[9px] font-black text-red-500">+ ₹{booking.overtimeCharge || 0}</span>
        </motion.div>
      )}
    </div>
  );
}

function QuickBookingModal({ 
  isOpen, 
  onClose, 
  slot, 
  onSuccess 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  slot: ParkingSlot | null, 
  onSuccess: () => void 
}) {
  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.FOUR_WHEELER);
  const [duration, setDuration] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const vehicleOptions = [
    { type: VehicleType.BIKE, label: 'Bike', icon: <Smartphone className="w-4 h-4" /> },
    { type: VehicleType.THREE_WHEELER, label: '3-WHL', icon: <Car className="w-4 h-4" /> },
    { type: VehicleType.FOUR_WHEELER, label: '4-WHL', icon: <Car className="w-5 h-5" /> },
    { type: VehicleType.TRUCK, label: 'Truck', icon: <LayoutGrid className="w-5 h-5" /> },
  ];

  const durationOptions = [
    { label: '1h', value: 1 },
    { label: '2h', value: 2 },
    { label: '4h', value: 4 },
    { label: '8h', value: 8 },
  ];

  const estimatedPrice = (VEHICLE_RATES[vehicleType] || 20) * duration;

  const handleBook = async () => {
    if (!slot) return;
    setLoading(true);
    setError('');
    try {
      await parkingService.bookSlot(slot.id, vehicleType, duration);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to book slot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && slot && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2.5rem] p-6 relative z-10 shadow-2xl"
          >
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black italic tracking-tight uppercase text-white">Reserve {slot.number}</h2>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5 text-white/50" /></button>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-widest text-center">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Vehicle Type</p>
                  <div className="grid grid-cols-4 gap-2">
                    {vehicleOptions.map((opt) => (
                      <button
                        key={opt.type}
                        onClick={() => setVehicleType(opt.type)}
                        className={`p-3 rounded-2xl flex flex-col items-center gap-2 border transition-all ${
                          vehicleType === opt.type 
                            ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20' 
                            : 'bg-white/5 border-white/5 text-white/40 grayscale'
                        }`}
                      >
                        {opt.icon}
                        <span className="text-[8px] font-black">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Duration</p>
                  <div className="grid grid-cols-4 gap-2">
                    {durationOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setDuration(opt.value)}
                        className={`p-2 rounded-xl text-xs font-black transition-all border ${
                          duration === opt.value 
                            ? 'bg-white text-black border-white' 
                            : 'bg-white/5 border-white/5 text-white/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 rounded-3xl p-4 flex justify-between items-center border border-white/5">
                   <div>
                     <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Estimated Bill</p>
                     <p className="text-2xl font-black italic text-white">₹{estimatedPrice}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Rate</p>
                     <p className="text-xs font-bold text-blue-400">₹{VEHICLE_RATES[vehicleType] || 20}/hr</p>
                   </div>
                </div>

                <button
                  onClick={handleBook}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black italic uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Reserve Now <Check className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SlotPredictorModal({ isOpen, onClose, slots, allBookings, onBookSlot, currentTime }: { isOpen: boolean, onClose: () => void, slots: ParkingSlot[], allBookings: Booking[], onBookSlot: (slot: ParkingSlot) => void, currentTime: Date }) {
  const slotData = slots.map(slot => {
    const booking = allBookings.find(b => b.slotId === slot.id);
    let remainingMs = 0;
    let isOvertime = false;
    let overtimeCycle = 0;

    if (booking) {
      const startTime = (booking.startTime as any).toDate ? (booking.startTime as any).toDate() : new Date(booking.startTime as any);
      const baseDurationMs = (booking.timeLimit || 4) * 3600000;
      const expiryTime = new Date(startTime.getTime() + baseDurationMs);
      const diff = expiryTime.getTime() - currentTime.getTime();
      
      if (diff <= 0) {
        isOvertime = true;
        remainingMs = Math.abs(diff);
        overtimeCycle = Math.ceil((remainingMs + 0.1) / (30 * 60 * 1000));
      } else {
        remainingMs = diff;
      }
    }

    return {
      ...slot,
      booking,
      remainingMs,
      isOvertime,
      overtimeCycle
    };
  });

  const sortedSlots = [...slotData].sort((a, b) => {
    // Available first
    if (a.status === SlotStatus.EMPTY && b.status !== SlotStatus.EMPTY) return -1;
    if (a.status !== SlotStatus.EMPTY && b.status === SlotStatus.EMPTY) return 1;
    
    // Then soonest available (shortest remaining time)
    if (a.status !== SlotStatus.EMPTY && b.status !== SlotStatus.EMPTY) {
      if (a.isOvertime && !b.isOvertime) return 1;
      if (!a.isOvertime && b.isOvertime) return -1;
      return a.remainingMs - b.remainingMs;
    }
    return 0;
  });

  const nextFreeSlot = slotData.filter(s => s.status !== SlotStatus.EMPTY && !s.isOvertime).sort((a, b) => a.remainingMs - b.remainingMs)[0];
  const recommendedSlot = sortedSlots[0];

  const formatTime = (ms: number, isOvertime: boolean) => {
    if (isOvertime) {
      const cycleMs = 30 * 60 * 1000;
      const cycleRem = cycleMs - (ms % cycleMs);
      const m = Math.floor(cycleRem / 60000);
      const s = Math.floor((cycleRem % 60000) / 1000);
      return `${m}m ${s}s`;
    }
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] overflow-hidden relative z-10 shadow-2xl"
          >
            <div className="p-6 space-y-6">
              <header className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <h2 className="text-xl font-black italic tracking-tight uppercase text-white">Smart Predictor</h2>
                  </div>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Real-time Availability Engine</p>
                </div>
                <button 
                  onClick={onClose}
                  className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 active:scale-95 transition-all"
                >
                  <X className="w-5 h-5 text-white/50" />
                </button>
              </header>

              <div className="bg-blue-600/10 border border-blue-500/20 rounded-3xl p-4 flex items-center gap-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-12 h-12" />
                </div>
                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Compass className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Recommendation</p>
                  <h3 className="font-black text-sm italic uppercase tracking-tight text-white">
                    {recommendedSlot?.status === SlotStatus.EMPTY 
                      ? `Park in Slot ${recommendedSlot.number}` 
                      : nextFreeSlot 
                        ? `Wait for ${nextFreeSlot.number}` 
                        : 'Checking best availability...'}
                  </h3>
                  {recommendedSlot?.status === SlotStatus.EMPTY ? (
                    <p className="text-[9px] font-bold text-green-400 uppercase tracking-widest mt-0.5 animate-pulse">
                      Available immediately
                    </p>
                  ) : (
                    nextFreeSlot && nextFreeSlot.status !== SlotStatus.EMPTY && (
                      <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-0.5">
                        Expected free in {formatTime(nextFreeSlot.remainingMs, false)}
                      </p>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {sortedSlots.map((s, idx) => (
                  <motion.div 
                    key={s.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => s.status === SlotStatus.EMPTY && onBookSlot(s)}
                    className={`p-4 rounded-[1.5rem] border flex items-center justify-between transition-all ${
                      s.status === SlotStatus.EMPTY 
                        ? 'bg-green-500/5 border-green-500/20 shadow-lg shadow-green-500/5 cursor-pointer hover:bg-green-500/10 active:scale-[0.98] relative overflow-hidden group' 
                        : s.isOvertime 
                        ? 'bg-red-500/5 border-red-500/20 cursor-not-allowed opacity-60' 
                        : 'bg-white/5 border-white/10 opacity-80 cursor-not-allowed'
                    }`}
                  >
                    {s.status === SlotStatus.EMPTY && (
                      <div className="absolute inset-0 bg-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
                    )}
                    <div className="flex items-center gap-3 relative z-10">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                        s.status === SlotStatus.EMPTY ? 'bg-green-500 text-white' : 'bg-white/5 text-white/40'
                      }`}>
                        {s.number}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                           <h4 className="font-bold text-sm text-white">{s.status === SlotStatus.EMPTY ? 'Available' : (s.status === SlotStatus.RESERVED ? 'Reserved' : 'Occupied')}</h4>
                           {s.isOvertime && (
                             <span className="text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full uppercase italic">x{s.overtimeCycle} OT</span>
                           )}
                           {s.status === SlotStatus.EMPTY && (
                             <span className="text-[8px] font-black bg-green-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-widest animate-bounce">Click to Book</span>
                           )}
                        </div>
                        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{s.type} • {s.floor}</p>
                      </div>
                    </div>
                    
                    <div className="text-right relative z-10">
                       <div className="flex items-center gap-1.5 justify-end mb-1">
                         <Timer className={`w-2.5 h-2.5 ${s.status === SlotStatus.EMPTY ? 'text-green-500' : s.isOvertime ? 'text-red-500' : 'text-blue-500'}`} />
                         <span className="text-[10px] font-black font-mono text-white">
                           {s.status === SlotStatus.EMPTY ? '00:00' : formatTime(s.remainingMs, s.isOvertime)}
                         </span>
                       </div>
                       <p className={`text-[8px] font-black uppercase tracking-widest ${
                         s.status === SlotStatus.EMPTY ? 'text-green-500' : s.isOvertime ? 'text-red-500' : 'text-blue-500/60'
                       }`}>
                         {s.status === SlotStatus.EMPTY ? 'READY' : s.isOvertime ? 'DELAYED' : 'REMAINING'}
                       </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-3">
                <Info className="w-4 h-4 text-white/30 shrink-0" />
                <p className="text-[9px] leading-relaxed text-white/40 font-bold uppercase tracking-wider">
                  PREDICTION UPDATES EVERY SECOND BASED ON ACTIVE PARKING TELEMETRY. CLICK AVAILABLE SLOTS TO RESERVE.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function Dashboard() {
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [allActiveBookings, setAllActiveBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showPredictor, setShowPredictor] = useState(false);
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<ParkingSlot | null>(null);
  const [now, setNow] = useState(new Date());
  const navigate = useNavigate();

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [hasDismissedWarning, setHasDismissedWarning] = useState(false);

  const { isLocalWarning, isLocalOvertime } = useMemo(() => {
    if (!activeBooking) return { isLocalWarning: false, isLocalOvertime: false };
    const startTime = (activeBooking.startTime as any).toDate ? (activeBooking.startTime as any).toDate() : new Date(activeBooking.startTime as any);
    const baseDurationMs = (activeBooking.timeLimit || 4) * 60 * 60 * 1000;
    const expiryTime = new Date(startTime.getTime() + baseDurationMs);
    const diff = expiryTime.getTime() - now.getTime();
    
    return {
      isLocalWarning: diff > 0 && diff <= 15 * 60 * 1000,
      isLocalOvertime: diff <= 0
    };
  }, [activeBooking, now]);

  useEffect(() => {
    if (isLocalWarning && !hasDismissedWarning) {
      setShowWarningModal(true);
    } else {
      setShowWarningModal(false);
    }
  }, [isLocalWarning, hasDismissedWarning]);

  useEffect(() => {
    if (!activeBooking) {
      setHasDismissedWarning(false);
    }
  }, [activeBooking?.id]);

  // Shared application clock to reduce intervals
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBookSlotFromPredictor = (slot: ParkingSlot) => {
    if (activeBooking) {
      alert("You already have an active booking protocol.");
      return;
    }
    setSelectedSlotForBooking(slot);
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fetchProfile = async () => {
    const p = await parkingService.getUserProfile();
    setProfile(p);
  };

  const activeBookingRef = React.useRef<Booking | null>(null);

  useEffect(() => {
    // Seed slots once
    parkingService.seedSlots();

    const unsubscribe = parkingService.subscribeToSlots(setSlots);
    const unsubBookings = parkingService.subscribeToUserBookings((bookings) => {
      const active = bookings.find(b => 
        b.status === BookingStatus.RESERVED || 
        b.status === BookingStatus.ACTIVE || 
        b.status === BookingStatus.PAID ||
        b.status === BookingStatus.TIME_ENDING ||
        b.status === BookingStatus.OVERTIME_ACTIVE ||
        b.status === BookingStatus.PAYMENT_PENDING
      );
      
      // Update ref for use in current render and future snapshots
      activeBookingRef.current = active || null;
      setActiveBooking(active || null);
    });

    fetchProfile();

    return () => {
      unsubscribe();
      unsubBookings();
    };
  }, []);

  // Sync status when component mounts or a new booking is detected
  useEffect(() => {
    if (!activeBooking) return;
    
    // Initial sync - throttled inside the service anyway
    parkingService.processLiveStatus(activeBooking);

    // Background sync (every 5 minutes) to conserve quota
    // ONLY runs if the page is visible to avoid ghost writes
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        parkingService.processLiveStatus(activeBooking);
      }
    }, 300000);

    return () => clearInterval(interval);
  }, [activeBooking?.id]);

  // Separate effect for Predictor subscription to save quota
  useEffect(() => {
    if (!showPredictor) {
      setAllActiveBookings([]);
      return;
    }

    const unsubAllBookings = parkingService.subscribeToAllActiveBookings(setAllActiveBookings);
    return () => unsubAllBookings();
  }, [showPredictor]);

  const stats = {
    total: 4,
    available: (slots.length > 0 ? slots.filter(s => s.status === SlotStatus.EMPTY).length : 4),
    occupied: slots.filter(s => s.status === SlotStatus.OCCUPIED).length,
    reserved: slots.filter(s => s.status === SlotStatus.RESERVED).length,
  };

  const chartData = [
    { name: 'Available', value: stats.available, color: '#22c55e' },
    { name: 'Reserved', value: stats.reserved, color: '#eab308' },
    { name: 'Occupied', value: stats.occupied, color: '#ef4444' },
  ];

  return (
    <div className="p-6 space-y-8 pb-24">
      <header className="flex justify-between items-center bg-white/[0.02] border border-white/[0.05] p-5 rounded-[2rem] backdrop-blur-xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight italic uppercase">
            Hello, <span className="text-gradient-cyan-blue font-extrabold">{profile?.displayName ? profile.displayName.split(' ')[0] : 'Driver'}</span>!
          </h1>
          <div className="flex items-center gap-2.5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-white/50">
              {profile?.vehicleNumber || 'Authorized'}
            </p>
            <div className="flex items-center gap-1.5 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.1)]">
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-cyan-400 active-dot-cyan animate-pulse' : 'bg-red-500'}`} />
              <span className={`text-[8px] font-black uppercase tracking-widest ${isOnline ? 'text-cyan-400' : 'text-red-400'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleLogout}
            className="w-11 h-11 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 active:scale-90 transition-all shadow-md"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowPredictor(true)}
            className="w-11 h-11 bg-cyan-500/10 border border-cyan-500/25 rounded-2xl flex items-center justify-center group active:scale-90 transition-all overflow-hidden relative shadow-[0_4px_20px_rgba(6,182,212,0.15)]"
          >
            <div className="absolute inset-0 bg-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
            <Zap className="text-cyan-400 w-4.5 h-4.5 relative z-10 animate-pulse" />
          </button>
        </div>
      </header>

      <SlotPredictorModal 
        isOpen={showPredictor} 
        onClose={() => setShowPredictor(false)} 
        slots={slots}
        allBookings={allActiveBookings}
        onBookSlot={handleBookSlotFromPredictor}
        currentTime={now}
      />

      <QuickBookingModal 
        isOpen={!!selectedSlotForBooking}
        onClose={() => setSelectedSlotForBooking(null)}
        slot={selectedSlotForBooking}
        onSuccess={() => {
          setSelectedSlotForBooking(null);
          setShowPredictor(false);
          navigate('/gate');
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/book" className="block cursor-pointer">
          <StatCard 
            icon={<CheckCircle className="text-emerald-400 w-5 h-5" />}
            label="Available"
            value={stats.available}
            color="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            glowClass="hover:border-emerald-500/30 shadow-[0_4px_24px_rgba(16,185,129,0.02)] hover:shadow-[0_4px_32px_rgba(16,185,129,0.1)]"
          />
        </Link>
        <Link to="/book" className="block cursor-pointer">
          <StatCard 
            icon={<AlertCircle className="text-rose-400 w-5 h-5" />}
            label="Occupied"
            value={stats.occupied}
            color="bg-rose-500/10 text-rose-400 border-rose-500/20"
            glowClass="hover:border-rose-500/30 shadow-[0_4px_24px_rgba(244,63,94,0.02)] hover:shadow-[0_4px_32px_rgba(244,63,94,0.1)]"
          />
        </Link>
        <Link to="/book" className="block cursor-pointer">
          <StatCard 
            icon={<Clock className="text-amber-400 w-5 h-5" />}
            label="Reserved"
            value={stats.reserved}
            color="bg-amber-500/10 text-amber-400 border-amber-500/20"
            glowClass="hover:border-amber-500/30 shadow-[0_4px_24px_rgba(249,115,22,0.02)] hover:shadow-[0_4px_32px_rgba(249,115,22,0.1)]"
          />
        </Link>
        <Link to="/book" className="block cursor-pointer">
          <StatCard 
            icon={<Car className="text-cyan-400 w-5 h-5" />}
            label="Total Spots"
            value={stats.total}
            color="bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
            glowClass="hover:border-cyan-500/30 shadow-[0_4px_24px_rgba(6,182,212,0.02)] hover:shadow-[0_4px_32px_rgba(6,182,212,0.1)]"
          />
        </Link>
      </div>

      {/* Chart */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass p-5 rounded-3xl aspect-[16/10]"
      >
        <h3 className="text-base font-semibold mb-6">Parking Distribution</h3>
        <ResponsiveContainer width="100%" height="80%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{ fill: '#ffffff05' }}
              content={CustomTooltip}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Quick Action or Active Session */}
      {!profile?.vehicleNumber && (
        <Link to="/settings" className="block">
          <motion.div 
            whileHover={{ y: -2 }}
            className="bg-yellow-500/10 border border-yellow-500/20 rounded-3xl p-5 flex flex-col gap-3 shadow-lg shadow-yellow-500/5"
          >
            <div className="flex items-center gap-3 text-yellow-500">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-sm tracking-tight">Profile Incomplete</h3>
            </div>
            <p className="text-white/60 text-xs leading-relaxed">
              Please add your vehicle number in settings to enable full access to the parking protocols.
            </p>
            <div className="flex items-center gap-2 text-yellow-500/80 text-[10px] font-bold uppercase tracking-widest mt-1">
              Complete Setup <ChevronRight className="w-3 h-3" />
            </div>
          </motion.div>
        </Link>
      )}

      {activeBooking ? (
        <Link 
          to={activeBooking.status === BookingStatus.PAID ? "/exit" : (activeBooking.status === BookingStatus.RESERVED ? "/gate" : "/payment")} 
          className="block group relative z-10"
        >
          <motion.div 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`rounded-3xl p-6 flex flex-col gap-6 shadow-2xl transition-all duration-500 border backdrop-blur-3xl ${
              isLocalOvertime 
                ? 'bg-red-600/60 border-red-400/50 shadow-red-500/20' 
                : isLocalWarning
                ? 'bg-yellow-600/60 border-yellow-400/50 shadow-yellow-500/10'
                : 'bg-blue-600/60 border-blue-400/50 shadow-blue-500/20'
            }`}
          >
            <div className="flex justify-between items-start">
               <div className="flex items-center gap-4">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isLocalOvertime ? 'bg-white/10' : 'bg-white/20'} backdrop-blur-md`}>
                   <Car className="text-white w-5 h-5" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80 mb-1">Secure Protocol Active</p>
                   <h3 className="font-black text-xl leading-tight uppercase tracking-tight italic text-white underline decoration-white/40 underline-offset-4">Slot {activeBooking.slotId?.replace('slot-', '') || '?'}</h3>
                 </div>
               </div>
               <div className="flex flex-col items-end gap-2">
                 <div className="bg-black/40 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-sm border border-white/10">
                   {isLocalOvertime ? 'OVERTIME ACTIVE' : isLocalWarning ? 'TIME ENDING' : 'ACTIVE'}
                 </div>
                 <div className="flex items-center gap-1.5">
                   <Smartphone className="w-3 h-3 opacity-60" />
                   <span className="text-[8px] font-black opacity-50 uppercase tracking-[0.3em]">Syncing...</span>
                 </div>
               </div>
            </div>

            <LiveTimer booking={activeBooking} currentTime={now} />

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/30 p-3 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/60 mb-1">Current Bill</p>
                  <div className="flex items-center gap-2">
                    <Receipt className="w-3 h-3 text-white/80" />
                    <motion.p 
                      key={activeBooking.currentBill || activeBooking.totalBill}
                      initial={{ scale: 1.1, color: '#fff' }}
                      animate={{ scale: 1, color: activeBooking.status === BookingStatus.OVERTIME_ACTIVE ? '#fff' : '#fff' }}
                      className="text-sm font-black italic"
                    >
                      ₹{parkingService.calculateCurrentBill(activeBooking)}
                    </motion.p>
                  </div>
              </div>
              <div className="bg-black/30 p-3 rounded-2xl border border-white/10 backdrop-blur-sm">
                 <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/60 mb-1">Vehicle Type</p>
                 <div className="flex items-center gap-2">
                   <Car className="w-3 h-3 text-white/80" />
                   <p className="text-sm font-black italic uppercase tracking-tighter">{activeBooking.vehicleType || 'Sedan'}</p>
                 </div>
              </div>
            </div>

            {activeBooking && activeBooking.status !== BookingStatus.PAID && (
              <div 
                className="flex items-center gap-3 bg-cyan-400/15 border border-cyan-400/20 p-4 rounded-2xl group hover:border-cyan-400/40 hover:bg-cyan-400/20 cursor-pointer active:scale-98 transition-all"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate('/navigation');
                }}
              >
                <div className="w-10 h-10 bg-cyan-400/25 rounded-xl flex items-center justify-center border border-cyan-400/20 shrink-0">
                  <Navigation className="text-cyan-400 w-5 h-5 animate-pulse" style={{ transform: 'rotate(45deg)' }} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-cyan-400">Live GPS Navigation</p>
                  <p className="text-white text-xs font-bold uppercase tracking-wide leading-tight">Interactive Map & Smart Lock</p>
                </div>
                <ChevronRight className="w-4.5 h-4.5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
              </div>
            )}

            <div className="flex justify-between items-center bg-white p-4 rounded-2xl group active:scale-95 transition-all">
               <p className="text-black text-[10px] font-black uppercase tracking-[0.15em]">Control Operations Console</p>
               <ChevronRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        </Link>
      ) : (
        <Link to="/book" className="block group mt-8 relative z-10">
          <motion.div 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="relative overflow-hidden p-6 rounded-[2rem] bg-gradient-to-r from-cyan-500 via-indigo-600 to-fuchsia-600 flex items-center justify-between shadow-2xl shadow-cyan-500/20 group active:opacity-95 transition-all duration-300"
          >
            {/* Absolute interactive particles overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent)] mix-blend-overlay" />
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner">
                <Car className="text-white w-7 h-7" />
              </div>
              <div>
                <h3 className="font-black text-xl leading-tight italic uppercase tracking-tight text-white flex items-center gap-2">
                  Book a Slot Now <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                </h3>
                <p className="text-white/80 text-[10px] font-extrabold uppercase tracking-[0.2em] mt-0.5">Secure Level S1–S4 instantly</p>
              </div>
            </div>
            
            <div className="w-12 h-12 bg-black/20 group-hover:bg-black/30 text-white rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 relative z-10 transition-colors shadow-lg">
              <ChevronRight className="w-6 h-6" />
            </div>
          </motion.div>
        </Link>
      )}

      {/* 15 Minutes Warning Popup Modal */}
      <AnimatePresence>
        {showWarningModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
              onClick={() => {
                setHasDismissedWarning(true);
                setShowWarningModal(false);
              }}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 25 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 25 }}
              className="bg-[#0e0a0a] border border-amber-500/30 rounded-[2.5rem] p-6 max-w-sm w-full text-center space-y-6 shadow-[0_0_50px_rgba(234,179,8,0.15)] relative overflow-hidden"
            >
              <div className="absolute top-[-25%] left-[-25%] w-[70%] h-[70%] bg-amber-500/10 blur-[60px] rounded-full pointer-events-none" />
              
              {/* Animated warning rings */}
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }} 
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 bg-amber-500/10 rounded-full border border-amber-500/20" 
                />
                <div className="w-14 h-14 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center shadow-lg transform rotate-45">
                  <AlertCircle className="w-7 h-7 -rotate-45" />
                </div>
              </div>

              <div className="space-y-2 relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">Security Warning Protocol</p>
                <h3 className="text-xl font-black italic uppercase tracking-tight text-white">15 Minutes Remaining</h3>
                <p className="text-[11px] leading-relaxed text-slate-300 font-bold uppercase tracking-wider px-2">
                  Your secure active parking slot session is ending shortly. Please return to your vehicle. Overtime charges of <span className="text-amber-400 font-black">₹10 / 30 mins</span> will accumulate automatically.
                </p>
              </div>

              <div className="pt-2 relative z-10">
                <button 
                  onClick={() => {
                    setHasDismissedWarning(true);
                    setShowWarningModal(false);
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black italic py-4 rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-transform shadow-xl shadow-amber-500/10 border border-amber-400/20"
                >
                  Acknowledge warning
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, color, glowClass }: { icon: any, label: string, value: number, color: string, glowClass?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className={`p-5 rounded-[2rem] glass glass-interactive border-t-white/10 ${glowClass || ''} space-y-3.5 relative overflow-hidden group`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-30 group-hover:opacity-50 transition-opacity" />
      <div className={`w-10 h-10 ${color} rounded-2xl flex items-center justify-center relative z-10 border border-white/5 shadow-2xl`}>
        {icon}
      </div>
      <div className="relative z-10 mt-1">
        <h4 className="text-[10px] text-white/50 uppercase font-bold tracking-widest leading-none mb-1">{label}</h4>
        <p className="text-2xl font-black text-white tracking-tight">{value}</p>
      </div>
    </motion.div>
  );
}
