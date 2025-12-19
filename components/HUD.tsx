import React, { useRef } from 'react';
import { TelemetryData, InteractionMode } from '../types';
import { Upload, Activity, Maximize2, RotateCw } from 'lucide-react';

interface HUDProps {
  telemetry: TelemetryData;
  videoRef: React.RefObject<HTMLVideoElement>;
  onModelUpload: (file: File) => void;
  onColorChange: (color: string) => void;
}

const HUD: React.FC<HUDProps> = ({ telemetry, videoRef, onModelUpload, onColorChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getModeColor = (mode: string) => {
    if (mode.includes('ZOOM')) return 'text-green-400';
    if (mode.includes('MOUSE')) return 'text-blue-400';
    if (mode.includes('ROTATION')) return 'text-cyan-400';
    return 'text-yellow-500'; // Idle
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onModelUpload(e.target.files[0]);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-8 z-10 overflow-hidden">
      
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />
      <div className="scanline w-full h-[100px] z-0" />

      {/* Top Bar */}
      <div className="flex justify-between items-start relative z-20">
        <div className="bg-slate-900/80 border-l-4 border-cyan-500 backdrop-blur-sm p-4 rounded-br-2xl shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          <div className="flex items-center gap-2 text-xs text-green-400 font-bold tracking-widest">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
            SYSTEM ONLINE
          </div>
          <div className="text-[10px] text-cyan-700 mt-1">HOLOGRAPHIC INTERFACE V3.1</div>
        </div>

        {/* Webcam Feed */}
        <div className="relative bg-slate-900/80 border border-cyan-800/50 p-1 rounded backdrop-blur-md">
          <video 
            ref={videoRef} 
            className="w-[120px] h-[90px] md:w-[160px] md:h-[120px] object-cover opacity-60 scale-x-[-1] border border-cyan-900/50"
            autoPlay 
            playsInline 
            muted
          />
          <div className="absolute top-0 left-0 bg-cyan-900/90 text-[10px] px-1.5 py-0.5 text-cyan-100 font-bold">CAM_01</div>
          <div className={`absolute bottom-0 right-0 text-[10px] px-2 py-0.5 font-bold transition-colors duration-300 ${
            telemetry.handDetected ? 'bg-green-600/90 text-white' : 'bg-red-900/90 text-red-200'
          }`}>
            {telemetry.handDetected ? 'SIGNAL LOCKED' : 'NO SIGNAL'}
          </div>
          
          {/* Decorative corners */}
          <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-cyan-500"></div>
          <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-cyan-500"></div>
        </div>
      </div>

      {/* Center Crosshair (Purely Visual) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[600px] md:h-[600px] pointer-events-none opacity-20">
        <div className="w-full h-full border border-dashed border-cyan-500/30 rounded-full animate-[spin_12s_linear_infinite]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] border border-cyan-500/10 rounded-full" />
        {/* Crosshairs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-cyan-500/50" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-cyan-500/50" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-4 bg-cyan-500/50" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-0.5 w-4 bg-cyan-500/50" />
      </div>

      {/* Bottom Controls */}
      <div className="flex flex-col-reverse md:flex-row justify-between items-end gap-4 relative z-20">
        
        {/* Left Panel: Telemetry & Controls */}
        <div className="bg-slate-900/80 border border-cyan-800/30 backdrop-blur-md p-4 rounded-tr-2xl w-full md:w-72 pointer-events-auto shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          <h3 className="text-cyan-300 text-xs font-bold border-b border-cyan-800/50 pb-2 mb-3 flex items-center gap-2">
            <Activity size={14} />
            DATA TELEMETRY
          </h3>
          
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs mb-4">
            <div className="text-cyan-600">ROT_SPEED</div>
            <div className="text-right text-cyan-100 font-bold">{telemetry.rotationSpeed}</div>
            
            <div className="text-cyan-600">ZOOM_LVL</div>
            <div className="text-right text-cyan-100 font-bold">{telemetry.zoomLevel}</div>
            
            <div className="text-cyan-600">STATUS</div>
            <div className={`text-right font-bold transition-colors duration-300 ${getModeColor(telemetry.mode)}`}>
              {telemetry.mode}
            </div>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full group relative overflow-hidden bg-cyan-950/30 hover:bg-cyan-900/50 border border-cyan-800/50 hover:border-cyan-500/50 text-cyan-300 text-xs py-2.5 px-3 rounded transition-all duration-300 flex items-center justify-center gap-2"
            >
              <div className="absolute inset-0 bg-cyan-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <Upload size={14} className="group-hover:-translate-y-0.5 transition-transform" />
              <span>LOAD MODEL (.GLB)</span>
            </button>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".glb,.gltf" 
              className="hidden" 
              onChange={handleFileChange}
            />

            <div className="flex items-center justify-between border-t border-cyan-800/30 pt-3">
              <span className="text-xs text-cyan-600">BG_COLOR</span>
              <div className="relative group">
                <input 
                  type="color" 
                  defaultValue="#000000"
                  onChange={(e) => onColorChange(e.target.value)}
                  className="w-16 h-6 opacity-0 absolute inset-0 cursor-pointer z-10" 
                />
                <div className="w-16 h-6 bg-slate-900 border border-cyan-700 rounded group-hover:border-cyan-400 transition-colors flex items-center justify-center">
                   <div className="w-12 h-2 bg-gradient-to-r from-black via-cyan-900 to-blue-900 rounded-sm"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Instructions */}
        <div className="hidden md:block bg-slate-900/80 border border-cyan-800/30 backdrop-blur-md p-4 rounded-tl-2xl pointer-events-auto">
          <h3 className="text-cyan-500 text-[10px] mb-2 font-bold tracking-widest text-right">MANUAL OVERRIDE</h3>
          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-3 text-sm text-cyan-100/80">
              <span>PAN / ROTATE</span>
              <RotateCw size={14} className="text-cyan-500" />
            </div>
             <div className="flex items-center gap-3 text-sm text-cyan-100/80">
              <span>PINCH / SCROLL</span>
              <Maximize2 size={14} className="text-cyan-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HUD;