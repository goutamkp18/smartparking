import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, CreditCard, Smartphone, X } from 'lucide-react';
import { parkingService } from '../services/parkingService';

interface NotificationToast {
  id: string;
  title: string;
  message: string;
  type: 'booking' | 'payment' | 'reminder';
}

export default function Notifications() {
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  useEffect(() => {
    const unsub = parkingService.subscribeToNotifications((title, message, type) => {
      const id = Math.random().toString(36).substring(7);
      setToasts(prev => [...prev, { id, title, message, type }]);
      
      // Auto remove after 5 seconds
      setTimeout(() => {
        removeToast(id);
      }, 5000);
    });

    return () => unsub();
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'booking': return <Bell className="w-5 h-5 text-blue-500" />;
      case 'payment': return <CreditCard className="w-5 h-5 text-green-500" />;
      case 'reminder': return <Smartphone className="w-5 h-5 text-amber-500" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  return (
    <div className="fixed top-6 left-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="pointer-events-auto bg-neutral-900/90 border border-white/10 backdrop-blur-xl p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 max-w-sm mx-auto w-full"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                {getIcon(toast.type)}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black uppercase tracking-widest text-white/90">{toast.title}</h4>
                <p className="text-[11px] text-white/50 font-medium truncate">{toast.message}</p>
              </div>
            </div>
            <button 
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-white/5 rounded-lg transition-colors text-white/20 hover:text-white/60"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
