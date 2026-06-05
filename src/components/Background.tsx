import React from 'react';
import { motion } from 'motion/react';

export default function Background() {
  return (
    <div id="app-background" className="fixed inset-0 -z-50 overflow-hidden bg-[#03010c]">
      {/* Mesh Gradients - Gorgeous hyper-layered glowing blobs */}
      <div className="absolute inset-0 opacity-50">
        <div 
          id="gradient-1"
          className="absolute top-[-10%] left-[-15%] w-[60%] h-[60%] rounded-full bg-cyan-500/15 blur-[120px] animate-pulse"
        />
        <div 
          id="gradient-2"
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-fuchsia-600/15 blur-[140px]"
        />
        <div 
          id="gradient-3"
          className="absolute top-[30%] right-[5%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[130px]"
        />
        <div 
          id="gradient-4"
          className="absolute bottom-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-emerald-500/5 blur-[100px] animate-pulse"
        />
      </div>

      {/* Floating Orbs - Soft cosmic breathing */}
      <motion.div
        id="orb-1"
        initial={{ x: '10%', y: '15%' }}
        animate={{ 
          x: ['10%', '75%', '10%'],
          y: ['15%', '65%', '15%'] 
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute w-72 h-72 bg-cyan-500/8 rounded-full blur-[90px]"
      />
      <motion.div
        id="orb-2"
        initial={{ x: '80%', y: '50%' }}
        animate={{ 
          x: ['80%', '20%', '80%'],
          y: ['50%', '10%', '50%'] 
        }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        className="absolute w-[400px] h-[400px] bg-fuchsia-500/6 rounded-full blur-[110px]"
      />
      <motion.div
        id="orb-3"
        initial={{ x: '40%', y: '80%' }}
        animate={{ 
          x: ['40%', '85%', '40%'],
          y: ['80%', '20%', '80%'] 
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        className="absolute w-80 h-80 bg-violet-500/8 rounded-full blur-[100px]"
      />

      {/* Technical Grid Overlay with a futuristic perspective/depth look */}
      <div 
        id="grid-overlay"
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)`,
          backgroundSize: '30px 30px'
        }}
      />
      
      {/* Scanning Laser Line Effect - pure premium movie-like telemetry */}
      <motion.div
        id="scan-line"
        animate={{ y: ['0vh', '100vh'] }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent opacity-30 pointer-events-none"
      />

      {/* Subtle digital safety horizontal lines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.015] bg-[linear-gradient(rgba(18,16,25,0)_50%,rgba(18,16,25,0.25)_50%)] bg-[length:100%_4px]" />

      {/* Glass Grain Texture */}
      <div id="noise-overlay" className="absolute inset-0 opacity-[0.025] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
