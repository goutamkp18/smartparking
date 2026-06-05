import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Navigation, 
  MapPin, 
  Play, 
  Pause, 
  RotateCcw, 
  ArrowLeft, 
  CheckCircle, 
  ShieldCheck, 
  Clock, 
  Compass, 
  Car,
  Check,
  Search,
  Eye,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { parkingService } from '../services/parkingService';
import { Booking, BookingStatus, SlotStatus, ParkingSlot } from '../types';

const mapImg = '/src/assets/images/parking_navigation_map.png';

interface Point {
  x: number;
  y: number;
}

const ENTRANCE_POINT = { x: 75, y: 650 };

const ROUTES: Record<string, Point[]> = {
  'slot-S1': [
    { x: 75, y: 650 },     // Entrance at bottom left
    { x: 75, y: 125 },     // Go straight up left vertical lane (on road center)
    { x: 286, y: 125 },    // Turn right along top horizontal road
    { x: 286, y: 80 }      // Turn up into slot A1-01
  ],
  'slot-S2': [
    { x: 75, y: 650 },     // Entrance at bottom left
    { x: 75, y: 125 },     // Go straight up left vertical lane
    { x: 348, y: 125 },    // Go right along top horizontal road
    { x: 348, y: 275 },    // Turn down central internal lane
    { x: 280, y: 275 }     // Turn left into slot B1-01
  ],
  'slot-S3': [
    { x: 75, y: 650 },     // Entrance at bottom left
    { x: 75, y: 545 },     // Go up left vertical lane to bottom road intersection
    { x: 945, y: 545 },    // Go straight right along bottom road
    { x: 945, y: 610 }     // Turn down into slot A4-23
  ],
  'slot-S4': [
    { x: 75, y: 650 },     // Entrance at bottom left
    { x: 75, y: 125 },     // Go straight up left vertical lane
    { x: 945, y: 125 },    // Go right along top horizontal road
    { x: 945, y: 275 },    // Turn down right vertical road
    { x: 880, y: 275 }     // Turn left into slot A3-01
  ]
};

const SLOT_LABELS: Record<string, string> = {
  'slot-S1': 'A1-01',
  'slot-S2': 'B1-01',
  'slot-S3': 'A4-23',
  'slot-S4': 'A3-01'
};

const SLOT_DESC: Record<string, string> = {
  'slot-S1': 'Top Row, First Slot',
  'slot-S2': 'Left Middle Row, First Slot',
  'slot-S3': 'Bottom Row, Last Slot',
  'slot-S4': 'Right Row, First Slot'
};

const SLOT_DISTANCES: Record<string, number> = {
  'slot-S1': 18,
  'slot-S2': 24,
  'slot-S3': 48,
  'slot-S4': 36
};

// Path progress helper
function getPointAtProgress(path: Point[], progress: number): { x: number; y: number; angle: number } {
  if (!path || path.length === 0) return { x: 0, y: 0, angle: 0 };
  if (path.length === 1 || progress <= 0) return { x: path[0].x, y: path[0].y, angle: 0 };
  if (progress >= 100) {
    const last = path[path.length - 1];
    const prev = path[path.length - 2];
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x) * (180 / Math.PI);
    return { x: last.x, y: last.y, angle };
  }

  const lengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i+1].x - path[i].x;
    const dy = path[i+1].y - path[i].y;
    const len = Math.sqrt(dx*dx + dy*dy);
    lengths.push(len);
    totalLength += len;
  }

  const targetLength = (progress / 100) * totalLength;
  let accumulated = 0;
  
  for (let i = 0; i < lengths.length; i++) {
    if (accumulated + lengths[i] >= targetLength) {
      const segmentProgress = (targetLength - accumulated) / lengths[i];
      const p1 = path[i];
      const p2 = path[i+1];
      const x = p1.x + (p2.x - p1.x) * segmentProgress;
      const y = p1.y + (p2.y - p1.y) * segmentProgress;
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
      return { x, y, angle };
    }
    accumulated += lengths[i];
  }

  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  return { x: last.x, y: last.y, angle: Math.atan2(last.y - prev.y, last.x - prev.x) * (180 / Math.PI) };
}

export default function NavigationScreen() {
  const [userBooking, setUserBooking] = useState<Booking | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [parkingSimulated, setParkingSimulated] = useState(false);
  const [parkingLoading, setParkingLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const navigate = useNavigate();

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubSlots = parkingService.subscribeToSlots(setSlots);
    const unsubBookings = parkingService.subscribeToUserBookings((bookings) => {
      const active = bookings.find(b => 
        b.status === BookingStatus.RESERVED ||
        b.status === BookingStatus.ACTIVE ||
        b.status === BookingStatus.TIME_ENDING ||
        b.status === BookingStatus.OVERTIME_ACTIVE ||
        b.status === BookingStatus.PAYMENT_PENDING
      );
      setUserBooking(active || null);
      if (active) {
        setSelectedSlot(active.slotId);
      } else {
        setSelectedSlot(null);
        setNavigationStarted(false);
        setProgress(0);
        setParkingSimulated(false);
      }
    });

    return () => {
      unsubSlots();
      unsubBookings();
    };
  }, []);

  // Handle route change updates
  const handleSlotSelect = (slotKey: string) => {
    if (userBooking && userBooking.slotId !== slotKey) {
      // Prevent selecting a different slot than the booked one
      return;
    }
    setSelectedSlot(slotKey);
    setNavigationStarted(false);
    setProgress(0);
    setIsPlaying(true);
    setParkingSimulated(false);
  };

  // Determine active route variables
  const slotLabel = selectedSlot ? SLOT_LABELS[selectedSlot] : '';
  const routePoints = selectedSlot ? ROUTES[selectedSlot] : null;
  const maxDistance = selectedSlot ? SLOT_DISTANCES[selectedSlot] : 0;

  // Handle live animation loops for GPS progress tracking
  useEffect(() => {
    if (!navigationStarted || !isPlaying || !routePoints) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const elapsed = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      setProgress((prev) => {
        // Full navigation duration ~15 seconds (100 / 15000 = 0.00667 progress increments per millisecond)
        const next = prev + (elapsed * 0.00667);
        if (next >= 100) {
          setIsPlaying(false);
          return 100;
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [navigationStarted, isPlaying, routePoints]);

  const { carX, carY, carAngle } = useMemo(() => {
    if (!routePoints) return { carX: 0, carY: 0, carAngle: 0 };
    const pt = getPointAtProgress(routePoints, progress);
    return { carX: pt.x, carY: pt.y, carAngle: pt.angle };
  }, [routePoints, progress]);

  const distanceRemaining = Math.max(0, Math.round(( (100 - progress) / 100 ) * maxDistance));
  const etaRemaining = Math.max(0, Math.ceil(( (100 - progress) / 100 ) * 15));
  const destinationReached = progress >= 100;

  const handleSimulateParking = async () => {
    if (!selectedSlot || parkingLoading) return;
    setParkingLoading(true);
    try {
      await parkingService.updateSlotSensor(selectedSlot, true);
      setParkingSimulated(true);
      parkingService.notify('Space Protected', `Anti-Theft telemetry active for slot ${SLOT_LABELS[selectedSlot]}`, 'booking');
    } catch (err) {
      console.error(err);
    } finally {
      setParkingLoading(false);
    }
  };

  const handleRestart = () => {
    setProgress(0);
    setIsPlaying(true);
  };

  const handleStopNavigation = () => {
    setNavigationStarted(false);
    setProgress(0);
    setParkingSimulated(false);
  };

  const getPathString = (points: Point[] | null) => {
    if (!points || points.length === 0) return '';
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  };

  return (
    <div className="p-6 pb-32 space-y-8">
      {/* Upper Navigation Header bar */}
      <header className="flex justify-between items-center bg-white/[0.02] border border-white/[0.05] p-5 rounded-[2rem] backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} />
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400">
              {navigationStarted ? 'GPS Link Online' : 'System Map Standby'}
            </p>
          </div>
          <h1 className="text-2xl font-black italic uppercase tracking-tight text-white">SmartPark GPS</h1>
        </div>
        <Link 
          to="/"
          className="w-12 h-12 bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-cyan-400 rounded-2xl flex items-center justify-center text-white transition-all shadow-md active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </header>

      {/* Map Section with Controls Bar above it */}
      <div className={isFullscreen 
        ? "fixed inset-0 z-50 bg-slate-950 flex flex-col p-4 md:p-6 overflow-hidden justify-start items-center gap-4" 
        : "space-y-4"
      }>
        {/* Navigation Map Controls Bar - PLACED ABOVE THE MAP! */}
        <div className="w-full max-w-[1000px] flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.05] p-4 rounded-3xl backdrop-blur-xl shrink-0 z-20">
          <div className="flex flex-wrap items-center gap-3">
            {navigationStarted ? (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">GPS Routing Active</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white/25"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">HUD Standby</span>
              </div>
            )}
            
            {/* GPS coordinates HUD always visible above map */}
            <div className="text-[10px] font-mono text-white/60 bg-black/40 px-2.5 py-1.5 rounded-xl border border-white/5 flex gap-2">
              <span>LAT: 12.9716° N</span>
              <span className="text-white/20">|</span>
              <span>LNG: 77.5946° E</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Fullscreen Toggle Button */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-10 px-3.5 flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-cyan-400 rounded-xl text-white transition-all cursor-pointer text-[10px] font-extrabold uppercase tracking-widest shadow-md"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-cyan-400" />
                  <span>Exit Full</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-cyan-400" />
                  <span>Fullscreen</span>
                </>
              )}
            </button>

            {navigationStarted && routePoints && (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 text-cyan-400" /> : <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />}
                </button>
                <button
                  onClick={handleRestart}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors cursor-pointer"
                  title="Restart Route"
                >
                  <RotateCcw className="w-4 h-4 text-cyan-400" />
                </button>
                <button
                  onClick={handleStopNavigation}
                  className="w-10 h-10 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl text-white/60 transition-colors cursor-pointer"
                  title="Stop Route"
                >
                  <X className="w-4 h-4 text-rose-500" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Styled Responsive Navigation Map */}
        <div className={`relative bg-slate-950 transition-all duration-300 overflow-hidden ${
          isFullscreen 
            ? 'aspect-[1000/690] w-full max-w-[1000px] max-h-[calc(100vh-120px)] rounded-3xl border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)]' 
            : 'aspect-[1000/690] w-full rounded-[2.5rem] border border-white/15 shadow-2xl'
        }`}>
          {/* Background Map Graphic - ALWAYS visible and clean */}
          <img
            src={mapImg}
            alt="Parking Map"
            className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none opacity-90"
            referrerPolicy="no-referrer"
          />

          {/* Ambient Dark Overlay */}
          <div className="absolute inset-0 bg-black/15 pointer-events-none z-[1]" />

          {/* Interactive Overlay when route is started & active */}
          {navigationStarted && routePoints && (
            <>
              {/* Vector SVG Animation Layer */}
              <svg 
                className="absolute inset-0 w-full h-full pointer-events-none z-[5]" 
                viewBox="0 0 1000 690"
              >
                {/* 1. Static Underlay Road Path (Google Maps Style) */}
                <path
                  d={getPathString(routePoints)}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.6"
                />
                <path
                  d={getPathString(routePoints)}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.35"
                />

                {/* 2. Glow Pulse Road Layer */}
                <path
                  d={getPathString(routePoints)}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.12"
                  className="animate-pulse"
                />

                {/* 3. Progressive Active Cyber Cyan path */}
                <motion.path
                  d={getPathString(routePoints)}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    pathLength: progress / 100
                  }}
                />

                {/* 4. Directional flowing road arrows */}
                <path
                  d={getPathString(routePoints)}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.55"
                  strokeDasharray="14 20"
                  className="flow-path-arrows"
                  style={{
                    animation: 'flowPathEffect 1.1s linear infinite'
                  }}
                />

                {/* 5. Destination pulsing ripple node */}
                <g transform={`translate(${routePoints[routePoints.length - 1].x}, ${routePoints[routePoints.length - 1].y})`}>
                  <circle cx="0" cy="0" r="32" fill="rgba(6,182,212,0.15)" className="animate-ping" style={{ animationDuration: '2s' }} />
                  <circle cx="0" cy="0" r="16" fill="rgba(6,182,212,0.22)" className="animate-pulse" />
                </g>
              </svg>

              {/* 6. Glowing Destination Badge Pin */}
              <div 
                className="absolute z-10 translate-x-[-50%] translate-y-[-100%] flex flex-col items-center gap-1.5"
                style={{ 
                  left: `${(routePoints[routePoints.length - 1].x / 1000) * 100}%`, 
                  top: `${(routePoints[routePoints.length - 1].y / 690) * 100}%`,
                  marginTop: '-16px'
                }}
              >
                <div className="bg-black/95 backdrop-blur-md px-3 py-1 rounded-full border border-cyan-500/40 shadow-lg text-center flex items-center gap-1.5 animate-bounce">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                  <span className="text-[9px] font-black tracking-widest text-[#06b6d4] uppercase">RESERVED: {slotLabel}</span>
                </div>
                <div className="w-9 h-9 bg-cyan-500 rounded-2xl flex items-center justify-center border-2 border-white text-white shadow-[0_0_20px_rgba(6,182,212,0.8)]">
                  <MapPin className="w-5 h-5 fill-white text-cyan-500 shrink-0" />
                </div>
              </div>

              {/* 7. Live progressive moving car icon */}
              <div
                className="absolute z-25 transition-transform duration-75 select-none pointer-events-none"
                style={{
                  left: `${(carX / 1000) * 100}%`,
                  top: `${(carY / 690) * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${carAngle + 90}deg)`,
                }}
              >
                <div className="relative flex items-center justify-center">
                  {/* Outer glow aura responsive sizes */}
                  <div className="absolute w-8 h-8 sm:w-12 sm:h-12 bg-cyan-500/30 rounded-full blur-md animate-pulse" />
                  {/* Car container card responsive sizes */}
                  <div className="w-7 h-7 sm:w-11 sm:h-11 bg-black/95 rounded-lg sm:rounded-2xl border border-cyan-400/60 flex items-center justify-center shadow-lg transform active:scale-90">
                    <Car className="text-cyan-400 w-3.5 h-3.5 sm:w-6 sm:h-6 animate-pulse" />
                  </div>
                  {/* Simulated forward headlights emission glow - Dynamic size for desktop/mobile */}
                  <div 
                    className="absolute pointer-events-none opacity-45 mix-blend-screen hidden sm:block"
                    style={{
                      top: '-25px',
                      width: '32px',
                      height: '35px',
                      background: 'radial-gradient(ellipse at bottom, rgba(6,182,212,0.8) 0%, transparent 80%)',
                      clipPath: 'polygon(15% 100%, 85% 100%, 100% 0%, 0% 0%)',
                    }}
                  />
                  <div 
                    className="absolute pointer-events-none opacity-45 mix-blend-screen block sm:hidden"
                    style={{
                      top: '-15px',
                      width: '18px',
                      height: '20px',
                      background: 'radial-gradient(ellipse at bottom, rgba(6,182,212,0.8) 0%, transparent 80%)',
                      clipPath: 'polygon(15% 100%, 85% 100%, 100% 0%, 0% 0%)',
                    }}
                  />
                </div>
              </div>
            </>
          )}

        {/* Overlay showing simple guide to start navigation when maps is in Initial Standby */}
        {!navigationStarted && (
          <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] pointer-events-none z-[4] flex items-center justify-center p-6">
            <div className="bg-slate-900/90 backdrop-blur-md px-6 py-4 rounded-[2rem] border border-white/10 shadow-2xl text-center max-w-sm pointer-events-auto">
              <div className="w-12 h-12 bg-cyan-400/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-cyan-400/20">
                <Navigation className="w-6 h-6 text-cyan-400" style={{ transform: 'rotate(45deg)' }} />
              </div>
              <h3 className="text-white font-black uppercase text-sm tracking-widest italic leading-tight">GPS Guidance Screen</h3>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider leading-relaxed mt-1">
                {userBooking 
                  ? "Your booked slot has been connected successfully. Press 'Start GPS Guidance' to begin your on-road path animation." 
                  : "No active reservation detected. Please book a parking spot to initialize interactive GPS routes."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Styled Inner CSS for directional path flow updates */}
      <style>{`
        @keyframes flowPathEffect {
          to {
            stroke-dashoffset: -45;
          }
        }
        .flow-path-arrows {
          stroke-dasharray: 6, 12;
        }
      `}</style>

      {userBooking ? (
        <div className="space-y-6">
          {/* Locked Slot Target Panel */}
          <div className="space-y-3">
            <div>
              <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.25em] mb-1">Active Destination (Locked)</h2>
              <p className="text-xs text-white/50 uppercase tracking-widest font-black">
                Routing to your booked parking space:
              </p>
            </div>

            <div className="max-w-md">
              <div className="py-5 px-5 rounded-[1.75rem] text-left border border-cyan-400/30 bg-gradient-to-br from-cyan-950/20 to-slate-950 shadow-lg shadow-cyan-400/5 relative overflow-hidden flex flex-col justify-between h-32">
                <div className="absolute top-4 right-4 bg-cyan-400/10 border border-cyan-400/25 text-cyan-400 text-[8px] font-black uppercase px-2.5 py-1 rounded-full z-10 animate-pulse">
                  Your Confirmed Booking
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-cyan-400 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-black stroke-[3.5px]" />
                    </div>
                    <span className="text-xl font-black italic uppercase text-white tracking-tight">Slot {slotLabel}</span>
                  </div>
                  <p className="text-[9px] text-white/40 uppercase font-black tracking-widest leading-none">
                    {SLOT_DESC[userBooking.slotId]}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] font-mono font-bold leading-none text-cyan-400">
                    Est. {SLOT_DISTANCES[userBooking.slotId]}m • Follow designated lane guides
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Info Card */}
          <AnimatePresence mode="wait">
            {selectedSlot && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-[#0b0c10] border border-white/10 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl"
              >
                {/* Ambient Backing graphics */}
                <div className="absolute top-0 right-0 p-6 opacity-3">
                  <Compass className="w-24 h-24 text-white" />
                </div>

                <div className="space-y-6">
                  {/* Card top details */}
                  <div className="flex justify-between items-start pb-4 border-b border-white/[0.06]">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.25em]">Guidance Target</p>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-2xl font-black text-white tracking-tight italic uppercase">Slot {slotLabel}</h3>
                        <span className="text-[9px] text-white/50 uppercase tracking-widest font-black">•</span>
                        <span className="text-[9px] text-white/50 uppercase tracking-widest font-bold">
                          {SLOT_DESC[selectedSlot]}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full border ${
                        !navigationStarted
                          ? 'text-yellow-400 bg-yellow-400/5 border-yellow-400/20'
                          : destinationReached 
                            ? 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)] animate-bounce' 
                            : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 animate-pulse'
                      }`}>
                        {!navigationStarted ? 'Standby' : destinationReached ? 'Arrived' : 'Navigating'}
                      </span>
                    </div>
                  </div>

                  {/* GPS coordinates metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col justify-center">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Distance Remaining</p>
                      <p className="text-xl font-black italic text-cyan-400">
                        {!navigationStarted ? `${maxDistance}m` : destinationReached ? 'Arrived' : `${distanceRemaining}m`}
                      </p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col justify-center">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Guidance ETA</p>
                      <p className="text-xl font-black italic text-[#60a5fa]">
                        {!navigationStarted ? '15 sec' : destinationReached ? '0 sec' : `${etaRemaining} sec`}
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Operations Action controller based on state progress */}
                  <div className="pt-2">
                    {!navigationStarted ? (
                      <button
                        onClick={() => {
                          setNavigationStarted(true);
                          setProgress(0);
                          setIsPlaying(true);
                        }}
                        className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:scale-[1.01] active:scale-98 text-white font-black italic py-4.5 rounded-2xl text-xs uppercase tracking-widest text-center border border-cyan-400/20 shadow-xl shadow-cyan-500/15 flex items-center justify-center gap-2.5 transition-all outline-none cursor-pointer"
                      >
                        Start GPS Guidance <Navigation className="w-4.5 h-4.5" style={{ transform: 'rotate(45deg)' }} />
                      </button>
                    ) : destinationReached ? (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        {!parkingSimulated ? (
                          <div className="space-y-3">
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
                              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                              <div>
                                <h4 className="text-xs font-black text-white uppercase tracking-wider">Arrived Safe</h4>
                                <p className="text-[10px] text-white/60 font-bold uppercase tracking-wide leading-relaxed mt-1">
                                  Your vehicle is successfully placed within slot {slotLabel}. Activate Space Protection to lock the space.
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={handleSimulateParking}
                              disabled={parkingLoading}
                              className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-98 disabled:opacity-50 text-white font-black italic py-4.5 rounded-2xl text-xs uppercase tracking-widest border border-emerald-400/15 shadow-xl shadow-emerald-500/10 transition-all flex items-center justify-center gap-2.5 cursor-pointer outline-none"
                            >
                              {parkingLoading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>Arm Space Protection <ShieldCheck className="w-5 h-5" /></>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-4.5 bg-blue-500/10 border border-blue-500/20 rounded-3xl text-center space-y-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                              <ShieldCheck className="w-7 h-7 text-blue-400 mx-auto animate-pulse" />
                              <h4 className="text-xs font-black text-white uppercase tracking-widest">Digital Parking Lock Enabled</h4>
                              <p className="text-[9px] text-white/40 uppercase tracking-widest font-black leading-none">
                                IR DETECTOR ONLINE • VEHICLE RECOGNITION MONITORING ACTIVE
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <button
                                onClick={handleStopNavigation}
                                className="bg-white/5 hover:bg-white/10 text-white font-black italic py-4 rounded-xl text-[10px] uppercase tracking-widest text-center border border-white/10 cursor-pointer transition-all"
                              >
                                Reset Guidance
                              </button>
                              <Link
                                to="/"
                                className="bg-gradient-to-r from-cyan-500 to-indigo-600 hover:scale-[1.01] active:scale-98 text-white font-black italic py-4 rounded-xl text-[10px] uppercase tracking-widest text-center border border-cyan-400/20 shadow-xl shadow-cyan-500/10 block cursor-pointer transition-all"
                              >
                                Dashboard
                              </Link>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <div className="p-4 bg-cyan-500/5 border border-cyan-500/15 rounded-2xl flex items-center gap-3">
                        <Compass className="w-4.5 h-4.5 text-cyan-400 animate-pulse shrink-0" />
                        <p className="text-[9px] text-white/50 font-bold uppercase tracking-wider leading-relaxed">
                          Follow designated lanes as highlighted. Do not reverse or block crosswalks to prevent system sirens.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* Empty Fallback when user has no active reservation */
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-950/50 border border-white/[0.06] rounded-[2.5rem] p-8 text-center max-w-lg mx-auto space-y-6 shadow-xl relative overflow-hidden"
        >
          <div className="w-16 h-16 bg-white/[0.02] border border-white/10 rounded-3xl flex items-center justify-center mx-auto shadow-inner text-white/30">
            <MapPin className="w-8 h-8 stroke-[1.25]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-white text-lg font-black uppercase tracking-widest italic">No Active Booking</h3>
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider leading-relaxed max-w-sm mx-auto">
              Our active dynamic on-road GPS Guidance layers automatically generate and overlay route telemetry only when you have booked a parking space.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:scale-[1.01] active:scale-98 text-white font-black italic px-8 py-4 rounded-2xl text-[11px] uppercase tracking-widest border border-cyan-400/20 shadow-xl shadow-cyan-500/10 transition-all cursor-pointer"
          >
            Complete a Recommendation <Car className="w-4 h-4" />
          </Link>
        </motion.div>
      )}
    </div>
  );
}
