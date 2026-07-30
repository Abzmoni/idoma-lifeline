import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function OfflineSuccessPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col items-center justify-center p-margin-mobile antialiased">
      <main className="flex flex-col items-center justify-center max-w-sm w-full text-center space-y-8 animate-[fadeIn_0.5s_ease-out]">
        
        {/* Radiating visual circle */}
        <div className="relative flex items-center justify-center mb-4">
          <div className="absolute w-32 h-32 bg-tertiary-fixed rounded-full opacity-50 pulse-ring"></div>
          <span className="material-symbols-outlined text-tertiary z-10 !text-[96px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
        </div>

        <div className="space-y-4">
          <h1 className="font-headline-lg text-headline-lg text-on-background m-0">Saved Offline.</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[280px] mx-auto m-0 leading-relaxed">
            Your emergency report is saved on this device and will sync automatically once connectivity is restored.
          </p>
        </div>

        <div className="pt-12 w-full flex flex-col gap-4">
          <button 
            onClick={() => navigate('/')}
            className="h-touch-target w-full border-2 border-outline text-on-surface font-label-caps text-label-caps uppercase tracking-wider rounded flex items-center justify-center gap-2 hover:bg-surface-container-high active:bg-surface-container-highest transition-colors duration-200"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
            Return to Map Directory
          </button>
        </div>

      </main>
    </div>
  );
}
