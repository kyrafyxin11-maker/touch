import React, { useState, useRef, useCallback } from 'react';
import HologramScene from './components/HologramScene';
import HUD from './components/HUD';
import LoadingScreen from './components/LoadingScreen';
import { TelemetryData } from './types';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("INITIALIZING...");
  const [bgColor, setBgColor] = useState("#000000");
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    rotationSpeed: "0.0",
    zoomLevel: "1.0x",
    mode: "STANDBY",
    handDetected: false
  });

  const handleTelemetryUpdate = useCallback((data: TelemetryData) => {
    setTelemetry(data);
  }, []);

  const handleLoadingChange = useCallback((isLoading: boolean, msg?: string) => {
    setLoading(isLoading);
    if (msg) setLoadingMsg(msg);
  }, []);

  const handleModelUpload = (file: File) => {
    // Dispatch a custom event to the Scene component to handle the file
    // This avoids needing to pass a ref to the complex scene component
    const event = new CustomEvent('hologram-upload', { detail: file });
    window.dispatchEvent(event);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black" style={{ backgroundColor: bgColor }}>
      <LoadingScreen isLoading={loading} message={loadingMsg} />
      
      <HologramScene 
        onTelemetryUpdate={handleTelemetryUpdate}
        onLoadingChange={handleLoadingChange}
        videoRef={videoRef}
        backgroundColor={bgColor}
      />
      
      <HUD 
        telemetry={telemetry}
        videoRef={videoRef}
        onModelUpload={handleModelUpload}
        onColorChange={setBgColor}
      />
    </div>
  );
};

export default App;