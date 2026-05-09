'use client';

import { Activity, Wifi, Clock } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="glass-panel flex items-center justify-between px-4 md:px-6 py-3 rounded-xl mb-3">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center pulse-dot"
          style={{
            background: 'linear-gradient(135deg, #3388ff, #00f0ff)',
            boxShadow: '0 0 20px rgba(51, 136, 255, 0.5)',
          }}
        >
          <Activity className="w-4 h-4 text-[#0a0e17]" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[rgba(51,136,255,0.6)] font-mono">
            Bengaluru Smart Mobility Grid
          </p>
          <h1 className="text-lg md:text-xl font-bold" style={{ color: '#3388ff', textShadow: '0 0 10px rgba(51,136,255,0.4)' }}>
            AccessFlow
          </h1>
        </div>
      </div>

      {/* System Status Strip */}
      <div className="flex items-center gap-4 md:gap-6 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Wifi className="w-3 h-3 text-[#00ff88]" />
          <span className="text-[rgba(224,230,240,0.5)]">
            <strong className="text-[#00ff88]">AI Net</strong> Online
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] pulse-dot" />
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Activity className="w-3 h-3 text-[#3388ff]" />
          <span className="text-[rgba(224,230,240,0.5)]">
            <strong className="text-[#3388ff]">Traffic</strong> Live
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#3388ff] pulse-dot" />
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Clock className="w-3 h-3 text-[#ff8800]" />
          <span className="text-[rgba(224,230,240,0.5)]">
            <strong className="text-[#ff8800]">Response</strong> 02:18
          </span>
        </div>
      </div>
    </header>
  );
}
