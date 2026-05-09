'use client';

import dynamic from 'next/dynamic';
import TopBar from '@/components/accessflow/TopBar';
import MetricsStrip from '@/components/accessflow/MetricsStrip';
import LeftPanel from '@/components/accessflow/LeftPanel';
import RightPanel from '@/components/accessflow/RightPanel';

// Dynamic import for MapPanel — Leaflet requires `window`
const MapPanel = dynamic(() => import('@/components/accessflow/MapPanel'), {
  ssr: false,
  loading: () => (
    <div className="glass-panel flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-[rgba(0,240,255,0.3)] border-t-[#00f0ff] rounded-full animate-spin" />
        <span className="text-xs font-mono text-[rgba(0,240,255,0.5)]">Loading map...</span>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <div
      className="min-h-screen flex flex-col p-3 md:p-4 lg:p-5"
      style={{ background: '#0a0e17' }}
    >
      <TopBar />
      <MetricsStrip />

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-3">
        <LeftPanel />
        <MapPanel />
        <RightPanel />
      </main>
    </div>
  );
}
