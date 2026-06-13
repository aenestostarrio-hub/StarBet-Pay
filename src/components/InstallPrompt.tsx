import React, { useState, useEffect } from 'react';
import { Download, Monitor, Smartphone, Check, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    let internalPrompt: BeforeInstallPromptEvent | null = null;

    const handleBeforeInstall = (e: Event) => {
      // Do NOT prevent default to let Chrome show its native automatic install banner
      internalPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      internalPrompt = null;
      console.log('StarBetPay PWA was installed successfully!');
    };

    const triggerPromptOnGesture = () => {
      if (internalPrompt) {
        internalPrompt.prompt().catch(err => {
          console.warn('Native prompt automatic trigger failed:', err);
        });
        // Clear so we don't run it again
        internalPrompt = null;
        setDeferredPrompt(null);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('click', triggerPromptOnGesture);
    window.addEventListener('touchstart', triggerPromptOnGesture);

    // Check if running in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('click', triggerPromptOnGesture);
      window.removeEventListener('touchstart', triggerPromptOnGesture);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Show manual guidance modal if browser doesn't trigger custom prompt automatically
      setShowGuideModal(true);
    }
  };

  if (installed) {
    return null;
  }

  return (
    <>
      {showBanner && (
        <div className="bg-gradient-to-r from-cyan-900/60 to-blue-900/60 border border-cyan-500/30 backdrop-blur-md rounded-2xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl">
              <Download size={20} className="animate-bounce" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-100 font-display">Disponible en application mobile Web</h4>
              <p className="text-gray-300 text-xs">Installez StarBetPay sur votre écran d'accueil pour un accès sécurisé et rapide.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowBanner(false)}
              className="px-2 py-2 text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
            <button
              onClick={handleInstallClick}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 text-xs"
            >
              <Download size={14} />
              Installer
            </button>
          </div>
        </div>
      )}

      {/* Manual Installation Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121b36] border border-cyan-500/30 rounded-3xl max-w-md w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mb-3">
                <Download size={24} />
              </div>
              <h3 className="text-lg font-bold font-display text-gray-100">Comment installer StarBetPay</h3>
              <p className="text-gray-400 text-xs mt-1">Suivez les instructions simples pour ajouter l'application sur votre appareil.</p>
            </div>

            <div className="space-y-4 text-sm text-gray-300">
              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 flex gap-3">
                <Smartphone className="text-cyan-400 shrink-0" size={20} />
                <div>
                  <h4 className="font-semibold text-gray-100 text-xs">Sur iPhone / iPad (Safari)</h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Appuyez sur le bouton de <span className="text-cyan-400">Partager</span> (<span className="font-bold">↑</span>) en bas du navigateur, puis faites défiler et sélectionnez <span className="text-cyan-400">"Sur l'écran d'accueil"</span>.
                  </p>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 flex gap-3">
                <Monitor className="text-cyan-400 shrink-0" size={20} />
                <div>
                  <h4 className="font-semibold text-gray-100 text-xs">Sur Android / Chrome</h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Cliquez sur les <span className="text-cyan-400">3 points verticaux</span> en haut à droite, puis sélectionnez <span className="text-cyan-400">"Installer l'application"</span> ou <span className="text-cyan-400">"Ajouter à l'écran d'accueil"</span>.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl transition-all"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
