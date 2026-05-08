import { motion, AnimatePresence } from 'motion/react';
import { Camera, RefreshCw, Layers, ShieldCheck, Zap, AlertTriangle, Upload, FileVideo } from 'lucide-react';
import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { LocationData } from '../types';

interface CameraPanelProps {
  currentFrame: string;
  isAnalyzing: boolean;
  onRefresh: () => void;
  onUpload: (file: File) => void;
  result?: Partial<LocationData>;
  isLightMode?: boolean;
}

export default function CameraPanel({ currentFrame, isAnalyzing, onRefresh, onUpload, result, isLightMode }: CameraPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
       onUpload(file);
    }
  };
  return (
    <motion.div 
      initial={{ x: -100, opacity: 0, rotateY: -20 }}
      animate={{ 
        x: 0, 
        opacity: 1, 
        rotateY: 0,
        y: [0, -8, 0]
      }}
      whileHover={{ perspective: 1000, rotateY: 5, y: -4 }}
      transition={{ 
        type: 'spring', 
        damping: 20,
        y: { duration: 5, repeat: Infinity, ease: "easeInOut" }
      }}
      className="w-80 h-full glass-blue-lit overflow-hidden flex flex-col gap-4 shadow-[20px_0_50px_rgba(0,0,0,0.3)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_#ef4444]" />
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">Live Surveillance</h2>
        </div>
        <button 
          onClick={onRefresh}
          className="p-1 hover:bg-slate-800 rounded-full transition-colors"
        >
          <RefreshCw size={16} className={isAnalyzing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
        <img 
          src={currentFrame} 
          alt="Surveillance Feed" 
          className={`w-full h-full object-cover grayscale brightness-75 ${isLightMode ? 'invert hue-rotate-180' : ''}`}
        />
        
        {/* Scanning Overlay */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div 
              initial={{ top: 0 }}
              animate={{ top: '100%' }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_10px_#22d3ee] z-10"
            />
          )}
        </AnimatePresence>

        <div className="absolute bottom-2 left-2 flex gap-2">
          <div className="px-1.5 py-0.5 bg-black/50 backdrop-blur-md rounded text-[10px] font-mono">
            BLR_CAM_402
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-1.5 py-0.5 bg-cyan-600/80 hover:bg-cyan-500 backdrop-blur-md rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
          >
            <Upload size={10} /> Upload
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*,video/*"
          />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/50">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-1">
            <Zap size={10} /> AI Confidence
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: isAnalyzing ? '30%' : (result ? '94%' : '0%') }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-cyan-500"
              />
            </div>
            <motion.span 
              id="ai-confidence"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs font-mono text-cyan-400"
            >
              {isAnalyzing ? '...' : (result ? '94.2%' : '0%')}
            </motion.span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase font-bold text-slate-500 flex justify-between items-center">
            <span>Detected Issues</span>
            {result && <span className="text-[8px] text-cyan-500/50">Real-time</span>}
          </div>
          <AnimatePresence mode="wait">
            {!isAnalyzing && result ? (
              <motion.div 
                key={result.type}
                initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-3 rounded-xl border border-glass-border bg-white/5 relative group/item"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold capitalize text-cyan-400">{result.type}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-black ${
                      result.severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {result.severity} Priority
                    </span>
                  </div>
                  <button 
                    onClick={() => onRefresh()} // Simulate dismissing by refreshing for now
                    className="p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100"
                    title="Dismiss / False Positive"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  {result.description}
                </p>
                <div className="flex gap-2">
                   <button className="flex-1 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-[9px] font-bold text-cyan-400 uppercase tracking-tighter transition-all">
                     Verify Site
                   </button>
                   <button className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-[9px] font-bold text-red-400 uppercase tracking-tighter transition-all">
                     Report Error
                   </button>
                </div>
              </motion.div>
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-slate-600 gap-2 border-2 border-dashed border-slate-800 rounded-xl">
                <Camera size={24} />
                <span className="text-[10px] uppercase tracking-tighter">Waiting for analysis...</span>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
           <button 
             onClick={() => alert("Drafting Emergency Alert for Police/108...")}
             className="w-full flex items-center justify-center gap-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] uppercase"
           >
             <AlertTriangle size={12} /> Emergency Alert
           </button>
           <button 
             onClick={() => alert(`BBMP Complaint Drafted: [Case #${Math.floor(Math.random()*10000)}] - Issue: ${result?.type?.toUpperCase()} reported at ${new Date().toLocaleTimeString()}. Requesting immediate cleanup/resolution.`)}
             className="w-full flex items-center justify-center gap-2 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-all uppercase"
           >
             <ShieldCheck size={12} /> BBMP Complaint
           </button>
        </div>
      </div>
    </motion.div>
  );
}
