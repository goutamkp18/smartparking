import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { History, Calendar, Clock, Wallet, ChevronRight, Car, Sparkles } from 'lucide-react';
import { parkingService } from '../services/parkingService';
import { Booking, BookingStatus } from '../types';

export default function HistoryScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    let activeBookings: Booking[] = [];
    let completedHistory: Booking[] = [];

    const handleUpdate = (active: Booking[], history: Booking[]) => {
      // To avoid duplication, get set of all historical bookings' originalBookingIds
      const completedIds = new Set(
        history.map(h => h.originalBookingId || h.id)
      );

      // Filter active bookings to exclude those that are already in history
      const filteredActive = active.filter(b => 
        !completedIds.has(b.id) && 
        b.status !== BookingStatus.COMPLETED && 
        b.status !== BookingStatus.CANCELLED
      );

      const combined = [...filteredActive, ...history];

      // Sort by timestamp or startTime
      setBookings(combined.sort((a, b) => {
        const getMs = (val: any) => {
          if (!val) return 0;
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (typeof val.toDate === 'function') return val.toDate().getTime();
          return new Date(val).getTime();
        };
        const timeA = getMs((a as any).timestamp) || getMs(a.startTime);
        const timeB = getMs((b as any).timestamp) || getMs(b.startTime);
        return timeB - timeA;
      }));
    };

    const unsubscribeHistory = parkingService.subscribeToHistory((hData) => {
      completedHistory = hData;
      handleUpdate(activeBookings, completedHistory);
    });

    const unsubscribeActive = parkingService.subscribeToUserBookings((aData) => {
      activeBookings = aData;
      handleUpdate(activeBookings, completedHistory);
    });

    return () => {
      unsubscribeHistory();
      unsubscribeActive();
    };
  }, []);

  return (
    <div className="p-6 pb-24 space-y-8">
      <header className="flex justify-between items-center bg-white/[0.02] border border-white/[0.05] p-5 rounded-[2rem] backdrop-blur-xl">
        <div className="space-y-1">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400">Activity Logs</p>
          <h1 className="text-2xl font-black italic uppercase tracking-tight text-white">Parking History</h1>
        </div>
        <div className="w-11 h-11 bg-cyan-500/10 border border-cyan-500/25 rounded-2xl flex items-center justify-center">
          <History className="w-5 h-5 text-cyan-400 animate-pulse" />
        </div>
      </header>

      <div className="space-y-4">
        {bookings.length === 0 ? (
          <div className="p-16 text-center text-white/30 space-y-4 bg-white/[0.02] border border-white/[0.05] rounded-[2rem] backdrop-blur-md">
            <History className="w-12 h-12 mx-auto opacity-20 animate-spin" />
            <p className="text-xs uppercase font-black tracking-widest text-white/30">No parking history yet</p>
          </div>
        ) : (
          bookings.map((booking) => (
            <HistoryItem key={booking.id} booking={booking} />
          ))
        )}
      </div>
    </div>
  );
}

interface HistoryItemProps {
  booking: Booking;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ booking }) => {
  const statusColors = {
    [BookingStatus.RESERVED]: 'bg-amber-500 border-amber-500/30 text-amber-400',
    [BookingStatus.ACTIVE]: 'bg-emerald-500 border-emerald-500/30 text-emerald-400',
    [BookingStatus.PAID]: 'bg-cyan-500 border-cyan-500/30 text-cyan-400',
    [BookingStatus.COMPLETED]: 'bg-cyan-500 border-cyan-500/30 text-cyan-400',
    [BookingStatus.CANCELLED]: 'bg-rose-500 border-rose-500/30 text-rose-400',
  };

  const statusBgColors = {
    [BookingStatus.RESERVED]: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
    [BookingStatus.ACTIVE]: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.1)]',
    [BookingStatus.PAID]: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.1)]',
    [BookingStatus.COMPLETED]: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.1)]',
    [BookingStatus.CANCELLED]: 'bg-rose-500/10 border-rose-500/25 text-rose-400',
  };

  const startTimeObj = booking.startTime?.toDate ? booking.startTime.toDate() : new Date(booking.startTime || Date.now());
  const formattedDate = startTimeObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const formatTime = (ts: any) => {
    if (!ts) return 'N/A';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="bg-white/[0.02] border border-white/[0.06] rounded-[2rem] p-5 flex flex-col gap-4 group hover:border-cyan-500/20 transition-all shadow-[0_4px_24px_rgba(0,0,0,0.05)] relative overflow-hidden backdrop-blur-2xl"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${statusBgColors[booking.status]} shadow-lg`}>
            <Car className="w-5.5 h-5.5" />
          </div>
          <div>
            <h4 className="font-extrabold text-base flex items-center gap-2 text-white">
              Slot S{booking.slotId ? booking.slotId.split('-').pop() : '?'}
              <span className={`text-[7.5px] uppercase px-2 py-0.5 rounded-full font-black tracking-widest ${statusBgColors[booking.status]} border`}>
                {booking.status}
              </span>
            </h4>
            <p className="text-[10px] text-white/40 font-extrabold uppercase tracking-widest">{booking.vehicleNumber || 'KA-01-XX-0000'}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-black text-xl text-white">₹{booking.totalBill || (booking.baseAmount || 20) + (booking.overtimeCharge || 0)}</p>
          <p className="text-[8px] text-white/40 uppercase font-black tracking-widest">Total Settle</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.05] bg-white/[0.01] -mx-5 px-5">
        <div className="space-y-1">
          <p className="text-[9px] uppercase font-black text-white/30 flex items-center gap-1.5 label-tag">
            <Clock className="w-3 h-3 text-cyan-400" /> Entry Time
          </p>
          <p className="text-xs font-extrabold text-white/85">{formatTime(booking.entryTime || booking.startTime)}</p>
          <p className="text-[8px] text-white/30 uppercase tracking-widest font-black leading-none">{formattedDate}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] uppercase font-black text-white/30 flex items-center gap-1.5 label-tag">
            <Clock className="w-3 h-3 text-cyan-400" /> Exit Time
          </p>
          <p className="text-xs font-extrabold text-white/85">{formatTime(booking.exitTime || booking.paymentTime)}</p>
          <p className="text-[8px] text-white/30 uppercase tracking-widest font-black leading-none">{formattedDate}</p>
        </div>
      </div>

      {booking.overtimeCharge ? (
        <div className="flex flex-col gap-1 mt-1">
          <div className="bg-rose-500/5 border border-rose-500/15 rounded-xl p-2.5 flex justify-between items-center">
            <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">Overtime Applied <Sparkles className="w-3 h-3 text-rose-400 animate-pulse" /></span>
            <span className="text-xs font-black text-rose-400">+ ₹{booking.overtimeCharge}</span>
          </div>
          {(booking as any).overtimeCycle && (
            <div className="flex justify-between items-center px-2 mt-1">
               <span className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em]">Extra Cycles</span>
               <span className={`text-[10px] font-black ${
                 (booking as any).overtimeCycle >= 3 ? 'text-rose-400' : (booking as any).overtimeCycle === 2 ? 'text-orange-500' : 'text-orange-400'
               }`}>x{(booking as any).overtimeCycle} SES</span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-2.5 flex justify-between items-center mt-1">
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1">On Time Secure Session <Sparkles className="w-3 h-3 text-emerald-300 animate-pulse" /></span>
          <span className="text-xs font-black text-emerald-400">On-Time</span>
        </div>
      )}

      <div className="absolute bottom-2 right-2 opacity-5 pointer-events-none">
        <History className="w-16 h-16 text-cyan-400" />
      </div>
    </motion.div>
  );
};
