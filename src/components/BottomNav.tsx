import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Car, ShieldCheck, History, Settings } from 'lucide-react';
import { motion } from 'motion/react';

export default function BottomNav() {
  const items = [
    { icon: LayoutDashboard, path: '/', label: 'Home' },
    { icon: Car, path: '/book', label: 'Book' },
    { icon: ShieldCheck, path: '/gate', label: 'Gate' },
    { icon: History, path: '/history', label: 'History' },
    { icon: Settings, path: '/settings', label: 'Settings' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 z-40">
      <div className="max-w-md mx-auto bg-slate-950/70 backdrop-blur-3xl border border-white/[0.08] rounded-[2.5rem] p-2 flex justify-around items-center shadow-[0_24px_50px_-12px_rgba(3,1,12,0.8),inset_0_1px_1px_0_rgba(255,255,255,0.06)] relative overflow-hidden">
        {/* Subtle decorative edge lights */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `relative p-4 rounded-3xl transition-all duration-300 group ${isActive ? 'text-cyan-400' : 'text-white/40 hover:text-white/70'}`
            }
          >
            {({ isActive }) => (
              <div className="flex flex-col items-center justify-center gap-1">
                {isActive && (
                  <motion.div
                    layoutId="nav-bg"
                    className="absolute inset-0 bg-cyan-400/10 rounded-3xl border border-cyan-400/15 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <item.icon className={`w-5.5 h-5.5 relative z-10 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'scale-105' : ''}`} />
                <span className="text-[8px] font-black uppercase tracking-widest relative z-10 scale-90 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none mt-0.5 absolute -bottom-5 text-cyan-400">
                  {item.label}
                </span>
                <span className="sr-only">{item.label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
