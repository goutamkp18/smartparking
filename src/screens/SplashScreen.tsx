import React from 'react';
import { motion } from 'motion/react';
import { Car, Sparkles } from 'lucide-react';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-[#03010b] flex items-center justify-center z-50 overflow-hidden">
      {/* Mesh Gradients - keeping splash simple but consistent */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-600/20 blur-[130px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-fuchsia-600/15 blur-[130px]" />
      </div>

      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Scan Lines Accent Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(3,1,11,0.45)_100%)]" />

      <div className="relative">
        {/* Glowing background */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1.4, opacity: 1 }}
          transition={{ duration: 2.2, repeat: Infinity, repeatType: "reverse" }}
          className="absolute inset-[-100px] bg-cyan-500/10 blur-[90px] rounded-full pointer-events-none"
        />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-[-12px] border-t-2 border-r-2 border-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.3)]"
            />
            <div className="w-28 h-28 bg-gradient-to-br from-cyan-500 via-indigo-600 to-fuchsia-600 rounded-[2.5rem] overflow-hidden flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.4)] border border-white/10 relative">
              <img src="/src/assets/images/smartpark_icon_1778996651401.png" alt="SmartPark AI Icon" className="w-full h-full object-cover p-1.5" />
            </div>
          </div>
          
          <div className="text-center space-y-1">
            <motion.h1 
              initial={{ letterSpacing: "1em", opacity: 0 }}
              animate={{ letterSpacing: "0.25em", opacity: 1 }}
              transition={{ duration: 1.6 }}
              className="text-3xl font-black tracking-[0.25em] text-white flex items-center justify-center gap-1.5 leading-none italic uppercase"
            >
              SMARTPARK <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 font-extrabold not-italic">AI</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.55 }}
              transition={{ delay: 0.8 }}
              className="text-[9.5px] uppercase tracking-[0.3em] text-slate-300 font-black"
            >
              The EV-COCKPIT SYSTEM PORTAL
            </motion.p>
          </div>
        </motion.div>
      </div>
      
      {/* Loading progress bar */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "0%" }}
          transition={{ duration: 2.2, ease: "easeInOut" }}
          className="w-full h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500"
        />
      </div>
      
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-25">
         <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white/50">SECURE SHELL v1.42</p>
      </div>
    </div>
  );
}
