import React from 'react';

interface LoadingScreenProps {
  isLoading: boolean;
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isLoading, message = "INITIALIZING SYSTEM..." }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center transition-opacity duration-500">
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping"></div>
        <div className="absolute inset-0 border-4 border-t-cyan-400 border-r-transparent border-b-cyan-600 border-l-transparent rounded-full animate-spin"></div>
      </div>
      
      <div className="text-cyan-400 text-xl tracking-[0.2em] font-bold animate-pulse">
        {message}
      </div>
      
      <div className="mt-4 w-64 h-1 bg-cyan-900/50 rounded-full overflow-hidden">
        <div className="h-full bg-cyan-400 animate-[width_2s_ease-in-out_infinite] w-1/2"></div>
      </div>
      
      <div className="text-cyan-700 text-xs mt-3 uppercase tracking-widest">
        Loading Neural Vision Modules
      </div>
    </div>
  );
};

export default LoadingScreen;