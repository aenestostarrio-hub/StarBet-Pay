import React, { useState, useEffect } from 'react';
import { Download, Monitor, Smartphone, Check, X, Star, Bell, Shield, Sparkles } from 'lucide-react';

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
  const [showAutoPopup, setShowAutoPopup] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      // Prevent browser default mini-infobar to trigger our customized professional prompt modal!
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Check if user has already dismissed the modal this week to avoid annoying repeat popups
      const isDismissed = sessionStorage.getItem('starbetpay_pwa_dismissed');
      if (!isDismissed) {
        // Automatically present our spectacular custom native-like install prompt!
        setShowAutoPopup(true);
      }
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowAutoPopup(false);
      console.log('StarBetPay PWA was installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if running in standalone mode (already installed)
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setShowAutoPopup(false);
      // Trigger the standard browser native prompt instantly
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Falls back to manual instruction card
      setShowGuideModal(true);
    }
  };

  const handleDismissAutoPopup = () => {
    setShowAutoPopup(false);
    sessionStorage.setItem('starbetpay_pwa_dismissed', 'true');
  };

  if (installed) {
    return null;
  }

  return (
    <>
      {/* 1. DISCREET HERO BANNER */}
      {showBanner && (
        <div className="bg-gradient-to-r from-slate-950/90 to-cyan-950/40 border border-cyan-500/30 backdrop-blur-md rounded-2xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3.5 z-10">
            {/* Real local logo with styling to look extra premium */}
            <div className="w-12 h-12 rounded-xl bg-slate-950 border border-cyan-500/20 shadow-lg shrink-0 flex items-center justify-center overflow-hidden">
              <img 
                src="/icon.png" 
                alt="Logo StarBetPay" 
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  // Fallback icon in case server-side download is still compiling
                  (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/10043/10043372.png';
                }}
              />
            </div>
            <div>
              <h4 className="font-extrabold text-gray-100 font-display tracking-tight text-xs sm:text-sm">
                Installer l'application officielle StarBetPay
              </h4>
              <p className="text-gray-400 text-[11px] mt-0.5 max-w-md">
                Accédez à vos dépôts et retraits 1xBet instantanément en un clic depuis votre écran d’accueil.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end z-10 shrink-0">
            <button
              onClick={() => setShowBanner(false)}
              className="p-2 text-gray-500 hover:text-white rounded-lg transition-colors text-xs"
              title="Fermer la suggestion"
            >
              <X size={16} />
            </button>
            <button
              onClick={handleInstallClick}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-4.5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20 text-xs tracking-tight"
            >
              <Download size={14} className="animate-pulse" />
              Installer
            </button>
          </div>
        </div>
      )}

      {/* 2. AUTOMATIC PREMIUM CHROME / ANDROID POPUP SHEET */}
      {showAutoPopup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div 
            className="bg-[#0b132b] border border-cyan-500/30 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 relative shadow-2xl shadow-cyan-500/10 overflow-hidden transform translate-y-0 transition-transform duration-300"
          >
            {/* Visual background accents */}
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

            <button
              onClick={handleDismissAutoPopup}
              className="absolute top-4 right-4 p-1 rounded-full bg-slate-900/60 hover:bg-slate-800 text-gray-400 hover:text-white transition-all border border-slate-850/60"
            >
              <X size={18} />
            </button>

            {/* Premium Header featuring Logo */}
            <div className="text-center mb-6 pt-2">
              <div className="relative inline-block mx-auto mb-4">
                <div className="w-20 h-20 bg-slate-950 rounded-2xl border-2 border-cyan-500/30 p-2 shadow-2xl shrink-0 flex items-center justify-center overflow-hidden">
                  <img 
                    src="/icon.png" 
                    alt="PWA StarBetPay Logo" 
                    className="w-16 h-16 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/10043/10043372.png';
                    }}
                  />
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 bg-cyan-500 text-slate-950 p-1.5 rounded-full shadow-lg border border-slate-950">
                  <Sparkles size={11} className="animate-spin-slow" />
                </div>
              </div>

              <h3 className="text-lg font-extrabold font-display text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400 tracking-tight">
                Installez l'application StarBetPay
              </h3>
              <p className="text-gray-400 text-[11px] mt-1.5 max-w-xs mx-auto">
                Ajoutez l'application sur votre écran d'accueil d'un simple clic pour profiter de tous vos services favoris sécurisés.
              </p>
            </div>

            {/* High-converting Value Bullet Points */}
            <div className="space-y-3.5 my-5">
              <div className="flex items-start gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-900/50">
                <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                  <Check size={14} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-200 text-xs">Alerte & Direct Notifications</h4>
                  <p className="text-gray-400 text-[10.5px] mt-0.5">Recevez immédiatement un son (chime) et une alerte de validation de d'opération en arrière-plan sans ouvrir l'application.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-900/50">
                <div className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0 mt-0.5">
                  <Check size={14} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-200 text-xs">Accès instantané et chargement rapide</h4>
                  <p className="text-gray-400 text-[10.5px] mt-0.5">La page et vos données se chargent instantanément et restent mémorisées sans temps de recherche.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-900/50">
                <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
                  <Check size={14} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-200 text-xs">Sécurisé & Garanti sans pub</h4>
                  <p className="text-gray-400 text-[10.5px] mt-0.5">Déclaré et authentifié sous protocole SSL robuste et stocké en local sur votre terminal mobile.</p>
                </div>
              </div>
            </div>

            {/* Active CTAs */}
            <div className="space-y-2 mt-6">
              <button
                onClick={handleInstallClick}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-extrabold py-3.5 rounded-2xl transition-all shadow-xl shadow-cyan-500/20 active:scale-[0.98] text-xs sm:text-sm tracking-tight flex items-center justify-center gap-2"
              >
                <Download size={16} className="animate-bounce" />
                Installer instantanément en 1 clic
              </button>
              
              <button
                onClick={handleDismissAutoPopup}
                className="w-full text-center text-gray-400 hover:text-white font-semibold py-2.5 rounded-xl transition-all text-xs"
              >
                Continuer sur le navigateur web
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. DETAILED MANUAL STEP-BY-STEP GUIDE MODAL (FOR SAFARI / CHROME FALLBACKS) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0b132b] border border-cyan-500/30 rounded-3xl max-w-md w-full p-6 relative shadow-2xl shadow-cyan-500/10 overflow-hidden">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full bg-slate-900/60 hover:bg-slate-800 text-gray-400 hover:text-white border border-slate-800/40"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-slate-950 rounded-2xl border border-cyan-500/20 p-2 shadow-xl shrink-0 flex items-center justify-center overflow-hidden mx-auto mb-3">
                <img 
                  src="/icon.png" 
                  alt="StarBetPay PWA WebApp" 
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/10043/10043372.png';
                  }}
                />
              </div>
              <h3 className="text-base font-extrabold font-display text-gray-100 uppercase tracking-wider">
                Guide d'installation StarBetPay
              </h3>
              <p className="text-gray-400 text-xs mt-1">
                Suivez ce court guide pour configurer l'icône de l'application sur votre écran d'accueil :
              </p>
            </div>

            <div className="space-y-4 my-5 text-sm text-gray-300">
              {/* Option A: Safari on iOS */}
              <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-900 flex gap-3.5">
                <Smartphone className="text-cyan-400 shrink-0 mt-1" size={24} />
                <div>
                  <h4 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-300 text-xs">
                    Sur iPhone / iPad (Safari)
                  </h4>
                  <ul className="text-xs text-gray-400 mt-1.5 space-y-1 ml-1 list-inside list-decimal">
                    <li>Appuyez sur l'icône de <span className="text-cyan-400 font-bold">Partage</span> ( <span className="font-bold">↑</span> ) en bas ou en haut de Safari.</li>
                    <li>Faites glisser le menu vers le bas et appuyez sur <span className="text-cyan-400 font-bold">"Sur l'écran d'accueil"</span>.</li>
                    <li>Validez en appuyant sur <span className="text-cyan-400 font-bold">"Ajouter"</span> en haut à droite.</li>
                  </ul>
                  {/* Visual help representation */}
                  <div className="mt-2 bg-slate-900/50 py-1.5 px-2.5 rounded-lg border border-slate-800 flex items-center gap-2 text-[10px] text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                    <span>L'icône StarBetPay apparaîtra avec son logo officiel.</span>
                  </div>
                </div>
              </div>

              {/* Option B: Standard Android / Chrome */}
              <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-900 flex gap-3.5">
                <Monitor className="text-cyan-400 shrink-0 mt-1" size={24} />
                <div>
                  <h4 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-300 text-xs">
                    Sur Android (Chrome, Opera, Xiaomi)
                  </h4>
                  <ul className="text-xs text-gray-400 mt-1.5 space-y-1 ml-1 list-inside list-decimal">
                    <li>Appuyez sur les <span className="text-cyan-400 font-bold">3 points verticaux</span> en haut à droite.</li>
                    <li>Sélectionnez l'option <span className="text-cyan-400 font-bold">"Installer l'application"</span>.</li>
                    <li>Validez pour instantanément l'ajouter avec son logo officiel.</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-extrabold py-3 rounded-2xl transition-all text-xs active:scale-[0.99]"
            >
              D'accord, c'est noté !
            </button>
          </div>
        </div>
      )}
    </>
  );
}
