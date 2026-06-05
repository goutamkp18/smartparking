import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Car, MapPin, ChevronLeft, CreditCard, Radio, Bike, Truck, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { parkingService } from '../services/parkingService';
import { BookingStatus, ParkingSlot, SlotStatus, VehicleType } from '../types';

export default function BookingScreen() {
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);
  const [booking, setBooking] = useState(false);
  const [activeBooking, setActiveBooking] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.FOUR_WHEELER);
  const [timeLimit, setTimeLimit] = useState(4);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = parkingService.subscribeToSlots(setSlots);
    const unsubBookings = parkingService.subscribeToUserBookings((bookings) => {
      const active = bookings.some(b => 
        b.status === BookingStatus.RESERVED || 
        b.status === BookingStatus.ACTIVE || 
        b.status === BookingStatus.PAID
      );
      setActiveBooking(active);
    });
    return () => {
      unsubscribe();
      unsubBookings();
    };
  }, []);

  const handleBook = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    try {
      await parkingService.bookSlot(selectedSlot.id, vehicleType, timeLimit);
      // Navigate to /gate after success - notification is handled by service
      navigate('/gate');
    } catch (err: any) {
      console.error(err);
      parkingService.notify('Booking Failed', err.message || 'Unknown error occurred', 'booking');
    } finally {
      setBooking(false);
    }
  };

  const vehicleRates: Record<VehicleType, number> = {
    [VehicleType.BIKE]: 10,
    [VehicleType.THREE_WHEELER]: 15,
    [VehicleType.FOUR_WHEELER]: 20,
    [VehicleType.TRUCK]: 50
  };

  const vehicleIcons = {
    [VehicleType.BIKE]: <Bike className="w-5 h-5" />,
    [VehicleType.THREE_WHEELER]: <Radio className="w-5 h-5 -rotate-45" />, // Proxy for 3 wheeler
    [VehicleType.FOUR_WHEELER]: <Car className="w-5 h-5" />,
    [VehicleType.TRUCK]: <Truck className="w-5 h-5" />,
  };

  const floors = ['Ground']; // Requirement says 4 slots A1-A4

  return (
    <div className="p-6 pb-24 space-y-8">
      <header className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.05] p-4.5 rounded-[2rem] backdrop-blur-xl">
        <Link to="/" className="w-10 h-10 bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-cyan-400 rounded-full flex items-center justify-center text-white transition-all">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-black uppercase italic tracking-tight">Reserve Parking Spot</h1>
      </header>

      {/* Grid legend with subtle glows */}
      <div className="grid grid-cols-3 gap-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/50 bg-white/5 p-4 rounded-[1.75rem] border border-white/[0.05]">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> FREE
        </div>
        <div className="flex items-center justify-center gap-2">
          <div className="w-2.5 h-2.5 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.5)]" /> RESERVED
        </div>
        <div className="flex items-center justify-center gap-2">
          <div className="w-2.5 h-2.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]" /> OCCUPIED
        </div>
      </div>

      <div className="space-y-10">
        {activeBooking && (
          <div className="bg-cyan-500/10 border border-cyan-500/25 p-5 rounded-[2rem] flex items-center gap-4 mx-1.5 shadow-[0_4px_24px_rgba(6,182,212,0.1)]">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-2xl flex items-center justify-center border border-cyan-500/20">
              <Car className="text-cyan-400" />
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-sm text-white">Active Session Found</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Manage it in the controls tab</p>
            </div>
            <Link to="/gate" className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-[10px] font-black px-4.5 py-2.5 rounded-xl uppercase hover:scale-102 hover:shadow-[0_4px_15px_rgba(6,182,212,0.15)] active:scale-98 transition-all">View</Link>
          </div>
        )}

        <div className="space-y-5">
          <h2 className="text-white/30 font-black uppercase text-[10px] tracking-[0.3em] px-2 text-center">Ground Level Slots (S1-S4)</h2>
          <div className="grid grid-cols-2 gap-6">
            {slots.length === 0 ? (
              <div className="col-span-2 py-20 text-center space-y-4">
                <Car className="w-12 h-12 mx-auto text-white/10 animate-bounce" />
                <p className="text-white/30 text-sm">No slots found.<br/>Go to Settings to initialize the system.</p>
                <Link to="/settings" className="text-cyan-400 font-extrabold text-xs uppercase tracking-widest block underline underline-offset-4 decoration-dotted">Go to Settings</Link>
              </div>
            ) : (
              slots.map(slot => (
                <SlotItem 
                  key={slot.id} 
                  slot={slot} 
                  isSelected={selectedSlot?.id === slot.id}
                  onClick={() => slot.status === SlotStatus.EMPTY && setSelectedSlot(slot)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Booking Drawer */}
      <AnimatePresence>
        {selectedSlot && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed inset-x-0 bottom-0 z-50 p-6 bg-slate-950/95 backdrop-blur-3xl border-t border-white/[0.08] rounded-t-[3rem] shadow-[0_-20px_60px_rgba(3,1,12,0.95)] overflow-y-auto max-h-[85vh]"
          >
            <div className="max-w-md mx-auto space-y-6">
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
              
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">Slot {selectedSlot.number}</h3>
                  <p className="text-xs text-white/50 tracking-wider">Ground Floor • Premium Position</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Hourly Rate</p>
                  <p className="text-2xl font-black text-cyan-400">₹{vehicleRates[vehicleType]}<span className="text-xs font-normal text-white/50">/hr</span></p>
                </div>
              </div>

              {/* Vehicle Selection */}
              <div className="space-y-2">
                <p className="text-[9px] text-cyan-400 uppercase font-black tracking-widest px-1">Select Vehicle Type</p>
                <div className="grid grid-cols-4 gap-2.5">
                  {Object.values(VehicleType).map((type) => (
                    <button
                      key={type}
                      onClick={() => setVehicleType(type)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-300 ${
                        vehicleType === type 
                        ? 'bg-gradient-to-br from-cyan-500 to-indigo-600 border-cyan-400 text-white shadow-lg shadow-cyan-500/10 scale-102 font-bold' 
                        : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      <div className={vehicleType === type ? 'text-white' : 'text-white/40'}>
                        {vehicleIcons[type]}
                      </div>
                      <span className="text-[7.5px] font-black uppercase truncate w-full text-center tracking-wider">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Limit Selection */}
              <div className="space-y-2">
                <div className="flex justify-between px-1">
                  <p className="text-[9px] text-white/40 uppercase font-black tracking-widest">Duration</p>
                  <p className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest">{timeLimit} Hours</p>
                </div>
                <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/10 space-y-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-cyan-400 animate-pulse" />
                    <input 
                      type="range"
                      min="1"
                      max="24"
                      step="1"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                      className="flex-1 accent-cyan-400 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-cyan-500/5 p-4.5 rounded-[1.5rem] border border-cyan-500/15">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-4.5 h-4.5 text-cyan-400" />
                    <span className="font-extrabold text-white/70 uppercase tracking-wider text-xs">Estimated Bill</span>
                  </div>
                  <span className="text-xl font-black text-white">₹{vehicleRates[vehicleType] * timeLimit}</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleBook}
                  disabled={booking || activeBooking}
                  className={`w-full font-black py-4.5 rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 text-xs uppercase tracking-widest ${
                    activeBooking 
                    ? 'bg-white/10 text-white/40 cursor-not-allowed shadow-none border border-white/5' 
                    : 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:scale-[1.01] active:scale-98 shadow-cyan-500/15 border border-cyan-400/20'
                  }`}
                >
                  {activeBooking ? 'Active Session Ongoing' : booking ? 'Connecting Server...' : 'Confirm Reservation'}
                </button>
                
                <button 
                  onClick={() => setSelectedSlot(null)}
                  className="w-full text-white/40 text-[9px] font-black uppercase tracking-[0.25em] py-2 hover:text-white transition-colors text-center block cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SlotItemProps {
  slot: ParkingSlot;
  isSelected: boolean;
  onClick: () => void;
}

const SlotItem: React.FC<SlotItemProps> = ({ slot, isSelected, onClick }) => {
  const statusColors = {
    [SlotStatus.EMPTY]: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 shadow-[0_4px_24px_rgba(16,185,129,0.01)] hover:bg-emerald-500/10 cursor-pointer',
    [SlotStatus.RESERVED]: 'bg-amber-500/10 border-amber-500/20 text-amber-500 opacity-80 cursor-not-allowed',
    [SlotStatus.OCCUPIED]: 'bg-rose-500/5 border-rose-500/20 text-rose-500 opacity-60 cursor-not-allowed',
  };

  const activeColor = isSelected 
    ? 'bg-gradient-to-br from-cyan-400 to-indigo-600 border-cyan-400 text-white shadow-[0_0_24px_rgba(6,182,212,0.25)] scale-102 font-bold' 
    : statusColors[slot.status];

  return (
    <motion.button
      whileTap={slot.status === SlotStatus.EMPTY ? { scale: 0.96 } : {}}
      onClick={onClick}
      className={`relative px-4 py-8 rounded-[2rem] border-2 flex flex-col items-center justify-center transition-all duration-300 ${activeColor}`}
    >
      <div className={`absolute top-4 left-4 ${isSelected ? 'bg-black/20 text-white' : 'bg-white/5 text-white/60'} px-2 py-0.5 rounded-lg text-[9px] font-black`}>
        {slot.number}
      </div>
      <Car className={`w-8 h-8 ${slot.status !== SlotStatus.EMPTY && !isSelected ? 'opacity-40' : 'opacity-100'} transition-opacity`} />
      <span className="text-[9px] font-black mt-3 uppercase tracking-widest">{slot.status}</span>
    </motion.button>
  );
};
