import { useState, useEffect } from 'react';
import MapView from './components/MapView';
import CameraPanel from './components/CameraPanel';
import { LocationData, LOCATIONS } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Accessibility, 
  Map as MapIcon, 
  Navigation2, 
  Search, 
  Settings, 
  AlertOctagon, 
  User, 
  ChevronRight,
  HandMetal,
  Layers,
  Zap,
  AlertTriangle,
  X,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Demo Surveillance Frames
const DEMO_FRAMES = [
  "https://images.unsplash.com/photo-1545147986-a9d6f2bd0ea7?auto=format&fit=crop&q=80&w=600", // Rainy/Flood potential
  "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&q=80&w=600", // Traffic
  "https://images.unsplash.com/photo-1506760610100-1af6025329e8?auto=format&fit=crop&q=80&w=600", // Construction
  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&q=80&w=600"  // Crossroads
];

export default function App() {
  const [situations, setSituations] = useState<LocationData[]>([]);
  const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Partial<LocationData>>();
  const [showEmergency, setShowEmergency] = useState(false);
  const [tickerDismissed, setTickerDismissed] = useState(false);
  const [activeRoute, setActiveRoute] = useState({ time: '42 min', dist: '12.4 km', id: 'original' });
  const [isRerouted, setIsRerouted] = useState(false);
  const [isApplyingRoute, setIsApplyingRoute] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string[]>(['low', 'medium', 'high']);

  useEffect(() => {

    // Initial analysis
    triggerAnalysis();
  }, []);

  const [notification, setNotification] = useState<string | null>(null);

  const toggleSeverity = (severity: string) => {
    setSeverityFilter(prev => 
      prev.includes(severity) 
        ? prev.filter(s => s !== severity) 
        : [...prev, severity]
    );
  };

  const filteredSituations = situations.filter(s => severityFilter.includes(s.severity));

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const selectAlternative = (id: string, time: string, dist: string) => {
    setIsApplyingRoute(true);
    setNotification(`Selected Alternative Route via ${id === 'orr' ? 'Outer Ring Road' : 'Hosur Road'}`);
    setTimeout(() => {
      setActiveRoute({ id, time, dist });
      setIsApplyingRoute(false);
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { x: 0.8, y: 0.8 },
        colors: ['#22c55e', '#ffffff']
      });
    }, 800);
  };

  const triggerAnalysis = () => {
    setIsAnalyzing(true);
    // Simulate API delay
    setTimeout(() => {
      const types: LocationData['type'][] = ['flood', 'congestion', 'blocked', 'accident'];
      const severities: LocationData['severity'][] = ['medium', 'high', 'low'];
      const locKeys = Object.keys(LOCATIONS);
      
      const newType = types[activeFrameIndex % types.length];
      const res: Partial<LocationData> = {
        type: newType,
        severity: severities[activeFrameIndex % severities.length],
        description: `Alert: ${newType.toUpperCase()} detected via Vision Link. Impacting main arterial flow.`,
        coordinates: LOCATIONS[locKeys[activeFrameIndex % locKeys.length]]
      };

      setAnalysisResult(res);
      setIsAnalyzing(false);

      // Add to map markers
      const newSit: LocationData = {
        id: Math.random().toString(),
        name: `Alert ${situations.length + 1}`,
        coordinates: res.coordinates as [number, number],
        type: res.type as any,
        severity: res.severity as any,
        description: res.description as any,
        timestamp: new Date().toLocaleTimeString()
      };
      setSituations(prev => [newSit, ...prev.slice(0, 5)]);

      if (res.severity === 'high') {
         setShowEmergency(true);
      }
    }, 2500);
  };

  const cycleFrame = () => {
    setActiveFrameIndex(prev => (prev + 1) % DEMO_FRAMES.length);
    triggerAnalysis();
  };

  const handleUpload = (file: File) => {
    setIsAnalyzing(true);
    // Simulate reading file and analyzing
    const reader = new FileReader();
    reader.onload = (e) => {
      // In a real app, we'd send e.target.result to Gemini
      setTimeout(() => {
        const res: Partial<LocationData> = {
          type: 'flood',
          severity: 'high',
          description: "Analysis of uploaded footage: Severe waterlogging detected at target junction. Route accessibility compromised.",
          coordinates: LOCATIONS.koramangala
        };
        setAnalysisResult(res);
        setIsAnalyzing(false);
        setSituations(prev => [{
           id: Math.random().toString(),
           name: "User Report",
           coordinates: res.coordinates as [number, number],
           type: 'flood',
           severity: 'high',
           description: res.description as any,
           timestamp: new Date().toLocaleTimeString()
        }, ...prev]);
        setShowEmergency(true);
      }, 3000);
    };
    reader.readAsDataURL(file);
  };

  const toggleAccessibility = () => {
    setIsAccessibilityMode(!isAccessibilityMode);
    if (!isAccessibilityMode) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#3b82f6', '#ffffff']
      });
    }
  };

  return (
    <div className="w-screen h-screen flex bg-slate-950 font-sans selection:bg-cyan-500/30">
      {/* Dynamic Background Noise */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-50" />

      {/* Main UI Substrate */}
      <div className="relative flex-1 flex flex-col">
        {/* Top Navigation */}
        <header className="h-16 flex items-center justify-between px-6 z-50 absolute top-0 left-0 right-0">
          <div className="flex items-center gap-3">
             <div className="relative pointer-events-auto group">
              <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(8,145,178,0.4)] transition-transform group-hover:rotate-12">
                <ShieldCheck size={20} className="text-white fill-white/20" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-pink-500 rounded-lg flex items-center justify-center border-2 border-slate-950">
                <Zap size={8} className="text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter uppercase leading-none text-white italic">
                Access<span className="text-cyan-500 not-italic">Flow</span>
              </h1>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black tracking-widest text-slate-500 uppercase">AI-Dynamic Bangalore</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-full p-1 shadow-lg pointer-events-auto">
              <button className="px-4 py-1.5 rounded-full bg-slate-800 text-xs font-bold flex items-center gap-2 active-click">
                <MapIcon size={14} /> Map
              </button>
              <button className="px-4 py-1.5 rounded-full text-slate-500 text-xs font-bold flex items-center gap-2 hover:text-slate-300 active-click">
                <Layers size={14} /> SAT
              </button>
            </div>
            <div className="w-10 h-10 rounded-full border border-slate-800 bg-slate-900 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer pointer-events-auto active-click">
              <User size={18} />
            </div>
          </div>
        </header>

        {/* Central Map Workspace */}
        <main className="flex-1 relative">
          <MapView 
            situations={filteredSituations} 
            accessibilityMode={isAccessibilityMode} 
            onMarkerClick={(sit) => console.log(sit)}
          />

          {/* Left Panel: VLM Insight */}
          <div className="absolute left-6 top-24 bottom-6 z-[1200] flex flex-col gap-4">
             <CameraPanel 
                currentFrame={DEMO_FRAMES[activeFrameIndex]} 
                isAnalyzing={isAnalyzing}
                onRefresh={cycleFrame}
                onUpload={handleUpload}
                result={analysisResult}
             />
          </div>

          {/* Right Floating Widgets */}
          <div className="absolute right-6 top-24 bottom-28 z-[1200] flex flex-col gap-4 w-80 pointer-events-none overflow-y-auto pr-2 no-scrollbar">
            
            {/* Route Precision Card */}
            <motion.div 
               initial={{ x: 100, opacity: 0, rotateY: 20 }}
               animate={{ x: 0, opacity: 1, rotateY: 0 }}
               whileHover={{ perspective: 1000, rotateY: -5 }}
               transition={{ type: 'spring', damping: 20 }}
               className="glass-card pointer-events-auto group shadow-[-20px_0_50px_rgba(0,0,0,0.3)] shrink-0 lit-border"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Route Precision</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => alert("Routing cancelled.")}
                    className="p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors"
                  >
                    <X size={14} />
                  </button>
                  <Settings size={14} className="text-slate-500" />
                </div>
              </div>
              
              <div className="space-y-4">
                 <div className="relative">
                   <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-slate-800" />
                   <div className="space-y-4">
                     <div className="flex items-center gap-4 pl-8 relative">
                       <div className="absolute left-1.5 w-2.5 h-2.5 rounded-full bg-cyan-500 border-2 border-slate-950" />
                       <div className="flex-1">
                         <div className="text-[9px] text-slate-500 font-bold uppercase mb-1">Source</div>
                         <input 
                           type="text" 
                           defaultValue="Silk Board Junction"
                           className="w-full bg-slate-900/50 rounded-lg border border-slate-800 p-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500 transition-colors"
                         />
                       </div>
                     </div>
                     <div className="flex items-center gap-4 pl-8 relative">
                       <div className="absolute left-1.5 w-2.5 h-2.5 rounded-full bg-pink-500 border-2 border-slate-950" />
                       <div className="flex-1">
                         <div className="text-[9px] text-slate-500 font-bold uppercase mb-1">Destination</div>
                         <input 
                           type="text" 
                           defaultValue="Hebbal Flyover"
                           className="w-full bg-slate-900/50 rounded-lg border border-slate-800 p-2 text-xs font-bold text-white focus:outline-none focus:border-pink-500 transition-colors"
                         />
                       </div>
                     </div>
                   </div>
                 </div>
                 <button 
                   onClick={() => {
                      setIsRerouted(true);
                      setNotification("Rerouting based on live VLM data...");
                    }}
                   className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 active-click shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-white/20"
                 >
                   <Search size={14} /> Search Best Route
                 </button>
              </div>
            </motion.div>

            {/* Accessibility Score Card (New Integrated Version) */}
            <motion.div 
               initial={{ x: 100, opacity: 0 }}
               animate={{ x: 0, opacity: 1 }}
               className="glass-card pointer-events-auto shrink-0 border-cyan-500/10 lit-border"
            >
              <div className="flex items-center justify-between mb-3">
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                   <Zap size={12} className="text-cyan-500" /> Route Analytics
                 </h4>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="p-2 bg-slate-950/50 rounded-lg border border-slate-800">
                  <div className="text-[8px] text-slate-500 font-bold uppercase">Travel Time</div>
                  <div className="text-xs font-bold text-white transition-all duration-500">{activeRoute.time}</div>
                </div>
                <div className="p-2 bg-slate-950/50 rounded-lg border border-slate-800">
                  <div className="text-[8px] text-slate-500 font-bold uppercase">Distance</div>
                  <div className="text-xs font-bold text-white transition-all duration-500">{activeRoute.dist}</div>
                </div>
              </div>

              <div className="p-2 bg-slate-900/50 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                   <span className="text-[9px] font-bold text-slate-500 uppercase">Accessibility Score</span>
                   <span className={`text-[10px] font-black ${isAccessibilityMode ? 'text-cyan-400' : 'text-slate-500'}`}>
                     {activeRoute.id === 'orr' ? '96%' : (isAccessibilityMode ? '92%' : '--')}
                   </span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: isAccessibilityMode ? (activeRoute.id === 'orr' ? '96%' : '92%') : '0%' }}
                     className="h-full bg-cyan-500"
                   />
                </div>
              </div>
            </motion.div>

            {/* Alternative Paths */}
            <AnimatePresence>
              {isRerouted && (
                <motion.div 
                   initial={{ x: 100, opacity: 0 }}
                   animate={{ 
                     x: 0, 
                     opacity: 1,
                     y: [0, -4, 0] 
                   }}
                   transition={{
                     y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                   }}
                   exit={{ x: 100, opacity: 0 }}
                   className="glass-card pointer-events-auto shrink-0 border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.15)]"
                >
                    <div className="flex items-center justify-between mb-3">
                       <h4 className="text-[10px] font-black uppercase text-green-400 tracking-widest flex items-center gap-2">
                         <Navigation2 size={12} className="text-green-500" /> Alternative Safe Paths
                       </h4>
                       <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[8px] font-black rounded uppercase flex items-center gap-1">
                         <ShieldCheck size={10} /> Verified
                       </span>
                    </div>
                    <div className="space-y-2">
                       <div 
                         onClick={() => selectAlternative('orr', '51 min', '14.2 km')}
                         className={`p-2 rounded-lg border cursor-pointer hover:bg-green-500/20 transition-all active-click ${
                           activeRoute.id === 'orr' ? 'bg-green-500/20 border-green-500/50 ring-1 ring-green-500/50' : 'bg-green-500/10 border-green-500/30'
                         }`}
                       >
                         <div className="flex justify-between items-center text-xs font-bold text-white mb-1">
                            <span>Via Outer Ring Road</span>
                            <span className="text-green-400">51 min</span>
                         </div>
                         <div className="text-[10px] text-slate-400 font-medium">Safe from flooding • Wheelchair++</div>
                       </div>
                       <div 
                         onClick={() => selectAlternative('hosur', '1 hr 5 min', '16.8 km')}
                         className={`p-2 rounded-lg border cursor-pointer hover:bg-amber-500/20 transition-all active-click ${
                           activeRoute.id === 'hosur' ? 'bg-amber-500/20 border-amber-500/50 ring-1 ring-amber-500/50' : 'bg-slate-900/50 border-slate-800'
                         }`}
                       >
                         <div className="flex justify-between items-center text-xs font-bold text-slate-300 mb-1">
                            <span>Via Hosur Road</span>
                            <span className="text-amber-400">1 hr 5 min</span>
                         </div>
                         <div className="text-[10px] text-slate-500">16.8 km • Heavy congestion detected</div>
                       </div>
                    </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Accessibility Mode Toggle */}
            <motion.button 
              onClick={toggleAccessibility}
              className={`p-4 glass-card pointer-events-auto flex items-center justify-between transition-all cursor-pointer shrink-0 lit-border active-click ${
                isAccessibilityMode ? 'ring-2 ring-cyan-500 bg-cyan-500/10' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  isAccessibilityMode ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-slate-800 text-slate-400'
                }`}>
                  <Accessibility size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-xs font-bold uppercase tracking-tight">Wheelchair Mode</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Disabled-Friendly Routing</p>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full p-1 flex items-center transition-colors ${
                isAccessibilityMode ? 'bg-cyan-500/30 justify-end' : 'bg-slate-800 justify-start'
              }`}>
                <motion.div layout className="w-4 h-4 bg-white rounded-full shadow-md" />
              </div>
            </motion.button>

            {/* Path Quality Card */}
            <div className="glass-card pointer-events-auto lit-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Path Quality</h3>
                <div className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[9px] font-black rounded uppercase">Reliable</div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Confidence Score</span>
                    <span className="text-lg font-black text-white">88%</span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div animate={{ width: '88%' }} className="h-full bg-cyan-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                   <div className="p-2 border border-slate-800 rounded-lg flex items-center gap-2">
                      <Zap size={12} className="text-amber-400" />
                      <span className="text-[9px] font-bold text-slate-400">Low Delay</span>
                   </div>
                   <div className="p-2 border border-slate-800 rounded-lg flex items-center gap-2">
                      <Accessibility size={12} className="text-cyan-400" />
                      <span className="text-[9px] font-bold text-slate-400">Level Paths</span>
                   </div>
                </div>
              </div>
            </div>

          </div>

          {/* Top Alert Marquee/Ticker */}
          <AnimatePresence>
            {notification && (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[1600] px-6 py-3 glass lit-border rounded-full flex items-center gap-3 bg-cyan-950/40"
              >
                <ShieldCheck size={16} className="text-green-400" />
                <span className="text-xs font-bold text-white uppercase tracking-widest">{notification}</span>
              </motion.div>
            )}

            {isApplyingRoute && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="absolute inset-0 z-[1500] flex items-center justify-center pointer-events-none"
              >
                <div className="glass-card px-12 py-8 flex flex-col items-center gap-4 lit-border bg-slate-900/60 backdrop-blur-xl">
                  <div className="w-16 h-16 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin shadow-[0_0_20px_rgba(6,182,212,0.5)]" />
                  <div className="text-xl font-black uppercase tracking-widest text-cyan-400">Applying Route</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Optimizing for Wheelchair Accessibility</div>
                </div>
              </motion.div>
            )}

            {!tickerDismissed && filteredSituations.length > 0 && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1100] w-full max-w-3xl px-6 pointer-events-none">
                <motion.div 
                   initial={{ y: -50, opacity: 0 }}
                   animate={{ y: 0, opacity: 1 }}
                   exit={{ y: -50, opacity: 0 }}
                   className="glass rounded-2xl h-14 flex items-center overflow-hidden pointer-events-auto border-red-500/30"
                >
                  <div className="px-4 h-full flex items-center bg-red-600 text-white font-black text-[10px] uppercase tracking-widest relative">
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    <span className="relative">Global Alerts</span>
                  </div>
                  <div className="flex-1 px-4 overflow-hidden bg-slate-900/50 flex items-center">
                    <motion.div 
                       animate={{ x: [0, -1200] }}
                       transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
                       className="whitespace-nowrap flex items-center gap-12 text-[11px] font-bold text-slate-300"
                    >
                      {filteredSituations.map(sit => (
                        <span key={sit.id} className={`flex items-center gap-2 ${sit.severity === 'high' ? 'text-red-500' : 'text-amber-400'}`}>
                          <AlertOctagon size={12} fill="currentColor" /> {sit.name.toUpperCase()}: {sit.description.toString().toUpperCase()}
                        </span>
                      ))}
                    </motion.div>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-900 pr-2 border-l border-slate-800">
                    <button 
                      onClick={() => alert("Forwarding alert to BBMP Emergency Response...")}
                      className="px-3 py-2 bg-slate-800 hover:bg-cyan-600/20 hover:text-cyan-400 text-slate-400 rounded-xl text-[10px] font-bold uppercase transition-all"
                    >
                      Report
                    </button>
                    <button 
                      onClick={() => setTickerDismissed(true)}
                      className="p-2 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-xl transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Floating Severity Filters (Top Left Center-ish) */}
          <div className="absolute top-2 left-[400px] z-[1200] flex gap-2">
            {(['high', 'medium', 'low'] as const).map(sev => (
              <button
                key={sev}
                onClick={() => toggleSeverity(sev)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all glass-card active-click ${
                  severityFilter.includes(sev)
                    ? sev === 'high' ? 'bg-red-500/20 text-red-500 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                    : sev === 'medium' ? 'bg-amber-500/20 text-amber-500 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                    : 'bg-green-500/20 text-green-500 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                  : 'bg-slate-950/50 text-slate-500 border-slate-800 grayscale'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

        </main>
      </div>

      {/* Emergency Modal Overlays */}
      <AnimatePresence>
        {showEmergency && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 backdrop-blur-md bg-red-950/20">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, rotateX: 45 }}
              animate={{ scale: 1, opacity: 1, rotateX: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md glass-card bg-slate-900 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.3)] flex flex-col gap-6 p-8 relative overflow-hidden"
            >
              {/* Emergency Pulse Background */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/20 blur-3xl rounded-full" />
              
              <button 
                onClick={() => setShowEmergency(false)}
                className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center animate-bounce shadow-[0_0_20px_#ef4444]">
                  <AlertOctagon size={32} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase text-white">Emergency Warning</h2>
                  <p className="text-slate-400 text-sm mt-2 font-medium">Critical hazard detected on your planned path. Immediate rerouting recommended for wheelchair users.</p>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => {
                    setIsRerouted(true);
                    setShowEmergency(false);
                  }}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <Navigation2 size={18} className="fill-white" /> Activate Reroute
                </button>
                <button 
                   onClick={() => setShowEmergency(false)}
                   className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-wider rounded-xl transition-all"
                >
                  Ignore (At Own Risk)
                </button>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
                <div className="flex-1 flex items-center gap-2 text-xs font-bold text-slate-500">
                  <HandMetal size={14} /> Send BBMP Complaint
                </div>
                <div className="flex-1 flex items-center gap-2 text-xs font-bold text-red-400">
                  <Zap size={14} /> Dial 108 Alert
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Menu */}
      <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-3">
        <motion.button 
          whileHover={{ scale: 1.1, rotate: 90 }}
          className="w-14 h-14 bg-cyan-600 rounded-2xl flex items-center justify-center text-white shadow-2xl hover:bg-cyan-500 transition-colors active-click"
        >
          <Search size={24} />
        </motion.button>
      </div>
    </div>
  );
}
