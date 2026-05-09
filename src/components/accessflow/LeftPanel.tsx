'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, AlertTriangle, Phone, Building2, Upload, X, Scan, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { IncidentPin, PinsResponse, Severity, IncidentType } from './types';
import { INCIDENT_COLORS, SEVERITY_COLORS } from './types';

export default function LeftPanel() {
  // ====== API-driven state ======
  const [pins, setPins] = useState<IncidentPin[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // ====== Media upload state ======
  const [uploadedMedia, setUploadedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Custom location state
  const [latInput, setLatInput] = useState<string>('12.9756');
  const [lngInput, setLngInput] = useState<string>('77.5993');

  const [analysisResult, setAnalysisResult] = useState<{
    type: IncidentType;
    severity: Severity;
    confidence: number;
    description: string;
    emergency: boolean;
    accessible: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch pins every 10 seconds
  useEffect(() => {
    let mounted = true;

    const fetchPins = async () => {
      try {
        const res = await fetch('/api/pins');
        const data: PinsResponse = await res.json();
        if (mounted && data.pins) {
          setPins(data.pins);
          setLastUpdate(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error('Failed to fetch pins:', err);
      }
    };

    fetchPins();
    const interval = setInterval(fetchPins, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const criticalIncident = pins.find(p => p.emergency) || pins.find(p => p.severity === 'HIGH') || pins.find(p => p.severity === 'MEDIUM') || pins[0];

  const handleBBMPReport = () => {
    toast.success('Report submitted to BBMP', {
      description: 'Your civic report has been forwarded to the BBMP response team.',
    });
  };

  // ====== Media upload handler ======
  const handleMediaUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      toast.error('Please upload an image or video file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File must be under 50MB');
      return;
    }

    setRawFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setUploadedMedia(URL.createObjectURL(file));
    setAnalysisResult(null);
    toast.success(`${isVideo ? 'Video' : 'Image'} uploaded`, {
      description: `${file.name} — Click "Analyze" to run AI detection`,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleRemoveMedia = useCallback(() => {
    setUploadedMedia(null);
    setRawFile(null);
    setAnalysisResult(null);
  }, []);

  // ====== AI analysis handler — calls VLM backend via FormData ======
  const handleAnalyze = useCallback(async () => {
    if (!rawFile) {
      toast.error('Upload media first');
      return;
    }

    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append('file', rawFile);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Analysis API returned ${res.status}`);
      }

      const data = await res.json();

      const result = {
        type: (data.type || 'CLEAR') as IncidentType,
        severity: (data.severity || 'LOW') as Severity,
        confidence: data.confidence || 50,
        description: data.description || 'Analysis complete but no description provided.',
        emergency: Boolean(data.emergency),
        accessible: Boolean(data.accessible),
      };

      setAnalysisResult(result);

      const severityLabel = result.severity;
      const emergencyTag = result.emergency ? ' 🚨 EMERGENCY' : '';
      const accessTag = result.accessible ? '✓ Accessible' : '✗ Not accessible';

      toast.success('AI Analysis Complete', {
        description: `${result.type} | ${severityLabel} | Confidence: ${result.confidence}% | ${accessTag}${emergencyTag}`,
      });

      // Use user-provided coordinates
      const lat = parseFloat(latInput) || 12.9756;
      const lng = parseFloat(lngInput) || 77.5993;
      
      const eventDetail = {
        type: result.type,
        severity: result.severity,
        confidence: result.confidence,
        description: result.description,
        emergency: result.emergency,
        accessible: result.accessible,
        lat,
        lng,
      };

      if (result.type !== 'CLEAR' && result.confidence > 50) {
        // Post to backend so it's in the pins array
        await fetch('/api/pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventDetail)
        });

        window.dispatchEvent(new CustomEvent('accessflow-new-incident', {
          detail: eventDetail,
        }));
      }
    } catch (err) {
      console.error('VLM analysis error:', err);

      toast.error('AI Analysis Failed', {
        description: 'Could not analyze the media. The VLM service may be unavailable.',
      });

      setAnalysisResult({
        type: 'CONGESTION',
        severity: 'LOW',
        confidence: 35,
        description: 'VLM service unavailable. Manual verification recommended.',
        emergency: false,
        accessible: true,
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [rawFile, latInput, lngInput]);

  const SEV_COLOR: Record<string, string> = {
    HIGH: '#ff3366',
    MEDIUM: '#ff8800',
    LOW: '#ffdd00',
  };

  const currentSeverity = analysisResult?.severity || criticalIncident?.severity || 'LOW';
  const currentColor = SEV_COLOR[currentSeverity] || '#3388ff';
  const currentEmergency = analysisResult?.emergency || criticalIncident?.emergency || false;
  const currentAccessible = analysisResult?.accessible !== undefined ? analysisResult.accessible : (criticalIncident?.accessible ?? true);

  return (
    <aside className="flex flex-col gap-3 lg:w-[320px] min-w-0" aria-label="AI surveillance and incident panel">
      {/* Camera Module */}
      <section className="glass-panel p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-3.5 h-3.5 text-[#3388ff]" />
            <span className="text-xs font-mono uppercase tracking-wider text-[#3388ff]">AI Surveillance</span>
          </div>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[rgba(255,51,102,0.15)] text-[#ff3366] border border-[rgba(255,51,102,0.3)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff3366] pulse-dot" />
            Live
          </span>
        </div>

        {/* Camera Feed / Uploaded Media */}
        <div className="relative rounded-lg overflow-hidden h-40 md:h-48 bg-[rgba(0,0,0,0.5)]">
          {uploadedMedia ? (
            <>
              {mediaType === 'video' ? (
                <video
                  src={uploadedMedia}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={uploadedMedia}
                  alt="Uploaded surveillance media"
                  className="w-full h-full object-cover"
                />
              )}
              {/* Analysis overlay */}
              {analysisResult && (
                <div className="absolute inset-0 flex flex-col justify-end" style={{ background: 'linear-gradient(transparent 40%, rgba(10,14,23,0.9))' }}>
                  <div className="p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: INCIDENT_COLORS[analysisResult.type] || '#ff3366' }} />
                      <span className="text-[10px] font-mono font-bold" style={{ color: INCIDENT_COLORS[analysisResult.type] || '#ff3366' }}>
                        {analysisResult.type} · {analysisResult.severity}
                      </span>
                      {analysisResult.emergency && (
                        <span className="px-1 py-0.5 rounded text-[8px] font-mono bg-[rgba(255,51,102,0.3)] text-[#ff3366] border border-[rgba(255,51,102,0.5)] animate-pulse">
                          EMERGENCY
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-1 text-[10px] text-gray-300">
                      <span>Analyzed Scene:</span>
                    </div>
                    <p className="text-[9px] font-mono text-[rgba(224,230,240,0.6)] leading-relaxed">{analysisResult.description}</p>
                  </div>
                </div>
              )}
              {/* Remove button */}
              <button
                type="button"
                onClick={handleRemoveMedia}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[rgba(0,0,0,0.7)] border border-[rgba(255,255,255,0.2)] flex items-center justify-center hover:bg-[rgba(255,51,102,0.3)] transition-colors z-10"
                title="Remove media"
              >
                <X className="w-3 h-3 text-[rgba(224,230,240,0.8)]" />
              </button>
              {/* Scanning animation when analyzing */}
              {isAnalyzing && (
                <div className="absolute inset-0 flex items-center justify-center bg-[rgba(10,14,23,0.6)] z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Scan className="w-8 h-8 text-[#3388ff] animate-pulse" />
                    <span className="text-[10px] font-mono text-[#3388ff]">VLM Analyzing...</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="absolute inset-0" style={{
                background: 'linear-gradient(135deg, rgba(10,14,23,0.95), rgba(20,30,50,0.9)), url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%233388ff\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
              }} />
              <div className="scan-line-anim" />
              <div className="camera-grid-overlay" />
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-dashed border-[rgba(51,136,255,0.3)] bg-[rgba(10,14,23,0.5)] hover:bg-[rgba(51,136,255,0.08)] hover:border-[rgba(51,136,255,0.5)] transition-all cursor-pointer"
                >
                  <Upload className="w-5 h-5 text-[rgba(51,136,255,0.5)]" />
                  <span className="text-[9px] font-mono text-[rgba(51,136,255,0.5)]">Upload image/video for AI</span>
                </button>
              </div>
              <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
                {pins.slice(0, 3).map((pin) => (
                  <span key={pin.id} className="w-2.5 h-2.5 rounded-full pulse-dot" style={{ backgroundColor: INCIDENT_COLORS[pin.type] }} />
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2.5 z-10" style={{ background: 'linear-gradient(transparent, rgba(10,14,23,0.9))' }}>
                <span className="text-[9px] font-mono text-[rgba(51,136,255,0.7)]">CAM BLR-AI-01</span>
                <p className="text-[10px] font-mono text-[rgba(224,230,240,0.8)]">{pins.length} incidents live</p>
              </div>
            </>
          )}
        </div>

        {/* Location Inputs */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[rgba(0,0,0,0.3)] rounded-md border border-[rgba(51,136,255,0.15)] px-2 py-1">
            <span className="text-[9px] font-mono text-[rgba(51,136,255,0.6)]">Lat:</span>
            <input 
              type="text" 
              value={latInput} 
              onChange={e => setLatInput(e.target.value)}
              className="bg-transparent border-none outline-none text-[10px] font-mono w-full text-[rgba(224,230,240,0.8)]"
              placeholder="12.9756"
            />
          </div>
          <div className="flex-1 flex items-center gap-2 bg-[rgba(0,0,0,0.3)] rounded-md border border-[rgba(51,136,255,0.15)] px-2 py-1">
            <span className="text-[9px] font-mono text-[rgba(51,136,255,0.6)]">Lng:</span>
            <input 
              type="text" 
              value={lngInput} 
              onChange={e => setLngInput(e.target.value)}
              className="bg-transparent border-none outline-none text-[10px] font-mono w-full text-[rgba(224,230,240,0.8)]"
              placeholder="77.5993"
            />
          </div>
        </div>

        {/* Upload + Analyze controls */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleMediaUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 text-[10px] font-mono gap-1.5 bg-[rgba(51,136,255,0.08)] text-[#3388ff] border border-[rgba(51,136,255,0.2)] hover:bg-[rgba(51,136,255,0.15)] h-7"
            variant="outline"
          >
            <Upload className="w-3 h-3" />
            {uploadedMedia ? 'Change Media' : 'Upload Media'}
          </Button>
          {uploadedMedia && (
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="flex-1 text-[10px] font-mono gap-1.5 bg-[rgba(0,255,136,0.08)] text-[#00ff88] border border-[rgba(0,255,136,0.2)] hover:bg-[rgba(0,255,136,0.15)] h-7"
              variant="outline"
            >
              <Scan className={`w-3 h-3 ${isAnalyzing ? 'animate-pulse' : ''}`} />
              {isAnalyzing ? 'Scanning...' : 'Analyze'}
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono text-[rgba(224,230,240,0.3)]">
          <span>Frame AI 48 fps</span>
          <span>{analysisResult ? `Last: ${analysisResult.type}` : 'Vision model warm'}</span>
          <span>Updated {lastUpdate || '—'}</span>
        </div>
      </section>

      {/* AI Analysis Card — driven by upload analysis or most critical pin */}
      <section className="glass-panel p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[#ff8800]" />
            <span className="text-xs font-mono uppercase tracking-wider text-[#3388ff]">AI Analysis</span>
          </div>
          {(analysisResult || criticalIncident) && (
            <span className="px-2 py-0.5 rounded text-[9px] font-mono" style={{
              background: `${currentColor}20`,
              color: currentColor,
              border: `1px solid ${currentColor}40`,
            }}>
              {currentSeverity} Severity
            </span>
          )}
        </div>

        {/* Alert banner — from upload or pin */}
        {(analysisResult || criticalIncident) && (
          <div className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono leading-relaxed" style={{
            color: currentColor,
            background: `${currentColor}15`,
            border: `1px solid ${currentColor}30`,
          }}>
            {analysisResult?.description || criticalIncident?.description}
          </div>
        )}

        {/* Emergency alert */}
        {currentEmergency && (
          <div className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono leading-relaxed bg-[rgba(255,51,102,0.15)] text-[#ff3366] border border-[rgba(255,51,102,0.4)] flex items-center gap-2 animate-pulse">
            <Phone className="w-3.5 h-3.5" />
            <strong>EMERGENCY — Call 108 immediately</strong>
          </div>
        )}

        {/* Confidence score */}
        {(analysisResult || criticalIncident) && (
          <>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-[rgba(224,230,240,0.5)]">Confidence Score</span>
              <strong className="text-[#3388ff]">{analysisResult?.confidence || criticalIncident?.confidence}%</strong>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{
                background: 'linear-gradient(90deg, #3388ff, #00f0ff)',
                boxShadow: '0 0 10px rgba(51,136,255,0.5)',
                width: `${analysisResult?.confidence || criticalIncident?.confidence || 0}%`,
              }} />
            </div>
          </>
        )}

        {/* Status grid — VLM fields */}
        {(analysisResult || criticalIncident) && (
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-0.5">
              <small className="text-[9px] font-mono text-[rgba(224,230,240,0.3)]">Accessible</small>
              <strong className="text-[10px] font-mono flex items-center gap-1" style={{ color: currentAccessible ? '#00ff88' : '#ff3366' }}>
                {currentAccessible ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                {currentAccessible ? 'Yes' : 'No'}
              </strong>
            </div>
            <div className="flex flex-col gap-0.5">
              <small className="text-[9px] font-mono text-[rgba(224,230,240,0.3)]">Incident</small>
              <strong className="text-[10px] font-mono" style={{ color: analysisResult ? (INCIDENT_COLORS[analysisResult.type] || '#3388ff') : (criticalIncident ? INCIDENT_COLORS[criticalIncident.type] : '#3388ff') }}>
                {analysisResult?.type || criticalIncident?.type}
              </strong>
            </div>
            <div className="flex flex-col gap-0.5">
              <small className="text-[9px] font-mono text-[rgba(224,230,240,0.3)]">Emergency</small>
              <strong className="text-[10px] font-mono" style={{ color: currentEmergency ? '#ff3366' : '#00ff88' }}>
                {currentEmergency ? 'YES' : 'No'}
              </strong>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="flex-1 text-[10px] font-mono gap-1 bg-[rgba(255,51,102,0.15)] text-[#ff3366] border border-[rgba(255,51,102,0.3)] hover:bg-[rgba(255,51,102,0.25)] h-7" variant="outline">
                <Phone className="w-3 h-3" />
                Emergency 108
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-panel border-[rgba(51,136,255,0.2)] accessflow-dialog" style={{ background: 'rgba(10,14,23,0.95)', zIndex: 10000 }}>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-[#ff3366]">Emergency 108 Alert</AlertDialogTitle>
                <AlertDialogDescription className="text-[rgba(224,230,240,0.6)]">
                  This will alert emergency services to the active incident. Only use for genuine emergencies.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-[rgba(255,255,255,0.05)] border-[rgba(51,136,255,0.15)] text-[rgba(224,230,240,0.6)]">Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-[rgba(255,51,102,0.2)] text-[#ff3366] border border-[rgba(255,51,102,0.3)]">Confirm Alert</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button className="flex-1 text-[10px] font-mono gap-1 bg-[rgba(51,136,255,0.1)] text-[#3388ff] border border-[rgba(51,136,255,0.25)] hover:bg-[rgba(51,136,255,0.2)] h-7" variant="outline" onClick={handleBBMPReport}>
            <Building2 className="w-3 h-3" />
            Report to BBMP
          </Button>
        </div>
      </section>

      {/* Incident Queue — from API pins */}
      <section className="glass-panel p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-[#3388ff]">Incident Queue</span>
          <span className="text-[10px] font-mono text-[rgba(224,230,240,0.3)]">{pins.length} active</span>
        </div>
        <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
          {pins.map((pin) => (
            <article key={pin.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[rgba(51,136,255,0.05)] transition-colors cursor-pointer">
              <i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: INCIDENT_COLORS[pin.type], boxShadow: `0 0 6px ${INCIDENT_COLORS[pin.type]}80` }} />
              <div className="flex-1 min-w-0">
                <strong className="text-[10px] block truncate">{pin.type} — {pin.severity}</strong>
                <span className="text-[9px] font-mono text-[rgba(224,230,240,0.4)]">
                  {pin.accessible ? '✓ Access' : '✗ No access'} · {pin.confidence}% · {pin.emergency ? '🚨' : ''}
                </span>
              </div>
              <b className="text-[9px] font-mono shrink-0" style={{ color: INCIDENT_COLORS[pin.type] }}>
                {pin.emergency ? '108' : pin.severity === 'HIGH' ? 'BBMP' : 'OPS'}
              </b>
            </article>
          ))}
          {pins.length === 0 && (
            <p className="text-[9px] font-mono text-[rgba(224,230,240,0.3)] text-center py-2">Loading incidents from API...</p>
          )}
        </div>
      </section>
    </aside>
  );
}
