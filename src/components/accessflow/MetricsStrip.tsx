'use client';

import { AlertTriangle, Route, Siren, ShieldCheck, Droplets } from 'lucide-react';

const metrics = [
  {
    label: 'Active Incidents',
    value: '05',
    sub: '2 critical',
    icon: AlertTriangle,
    color: '#ff3366',
  },
  {
    label: 'Accessible Corridors',
    value: '81%',
    sub: '+6% last hour',
    icon: Route,
    color: '#00ff88',
  },
  {
    label: 'Emergency Units',
    value: '12',
    sub: '4 near CBD',
    icon: Siren,
    color: '#3388ff',
  },
  {
    label: 'Network Confidence',
    value: '94%',
    sub: 'stable',
    icon: ShieldCheck,
    color: '#00f0ff',
  },
];

export default function MetricsStrip() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <article
            key={m.label}
            className="glass-panel p-3 md:p-4 flex flex-col gap-1 relative overflow-hidden"
          >
            {/* Accent glow line */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{
                background: `linear-gradient(90deg, transparent, ${m.color}, transparent)`,
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[rgba(224,230,240,0.4)] font-mono">
                {m.label}
              </span>
              <Icon className="w-3.5 h-3.5" style={{ color: m.color }} />
            </div>
            <strong className="text-xl md:text-2xl font-bold font-mono" style={{ color: m.color }}>
              {m.value}
            </strong>
            <small className="text-[10px] font-mono" style={{ color: `${m.color}99` }}>
              {m.sub}
            </small>
          </article>
        );
      })}
    </div>
  );
}
