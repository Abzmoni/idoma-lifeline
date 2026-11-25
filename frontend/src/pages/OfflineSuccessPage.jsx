import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function OfflineSuccessPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sent = params.get('sent') === '1';

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
          <h1 className="font-headline-lg text-headline-lg text-on-background m-0">{sent ? 'Report received.' : 'Saved on this device.'}</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[280px] mx-auto m-0 leading-relaxed">
            {sent ? 'Your report is awaiting coordinator review. It will appear on the public map after approval.' : 'Your report is waiting to sync. Keep this app open or reopen it when connected. You can also use “Sync now” on the map.'}
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
