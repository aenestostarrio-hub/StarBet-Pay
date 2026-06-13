import React, { useState, useEffect } from 'react';
import { Download, Monitor, Smartphone, Check, X, Sparkles, Share2, Bell } from 'lucide-react';

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
  const [isIOS, setIsIOS] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showiOSGuide, setShowiOSGuide] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [successMessage, setSuccessMessage] = useState(false);

  useEffect(() => {
    // 1. Detect if already installed/standalone
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setInstalled(true);
      localStorage.setItem('starbetpay_pwa_installed', 'true');
      return;
    }

    if (localStorage.getItem('starbetpay_pwa_installed') === 'true') {
      setInstalled(true);
      return;
    }

    // 2. Detect iOS device elegantly
    const ua = window.navigator.userAgent.toLowerCase();
    const isDeviceIOS = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isDeviceIOS);

    // 3. Keep track of current Notification states
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // 4. Capture browser installation criteria
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if user has dismissed the popup in the last 7 days
      triggerDelayedModal();
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setSuccessMessage(true);
      localStorage.setItem('starbetpay_pwa_installed', 'true');
      setDeferredPrompt(null);
      setShowPremiumModal(false);
      setShowiOSGuide(false);
      
      // Auto dismiss success toast after 5 seconds
      setTimeout(() => {
        setSuccessMessage(false);
      }, 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // For iOS users, we trigger the popup automatically after 4 seconds as well (since beforeinstallprompt is never sent on Safary iOS)
    if (isDeviceIOS) {
      triggerDelayedModal();
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isIOS]);

  const triggerDelayedModal = () => {
    const dismissedTime = localStorage.getItem('starbetpay_pwa_dismissed_at');
    const isPreviouslyInstalled = localStorage.getItem('starbetpay_pwa_installed') === 'true';

    if (isPreviouslyInstalled) {
      return;
    }

    if (dismissedTime) {
      const lastDismissed = new Date(parseInt(dismissedTime, 10));
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - lastDismissed.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        // Less than 7 days passed. Do not prompt automatically
        return;
      }
    }

    // Elegant delayed trigger after 4 seconds has passed
    const timer = setTimeout(() => {
      setShowPremiumModal(true);
    }, 4000);

    return () => clearTimeout(timer);
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowPremiumModal(false);
      setShowiOSGuide(true);
      return;
    }

    if (deferredPrompt) {
      setShowPremiumModal(false);
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        setInstalled(true);
        localStorage.setItem('starbetpay_pwa_installed', 'true');
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 5000);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback: If chrome on Android but deferredPrompt isn't loaded yet or not supported, show guidelines fallback
      setShowPremiumModal(false);
      setShowiOSGuide(true);
    }
  };

  const handleLaterDismiss = () => {
    localStorage.setItem('starbetpay_pwa_dismissed_at', Date.now().toString());
    setShowPremiumModal(false);
  };

  // Automated notification setup prepared and ready for Firebase
  const handleEnablePushNotifications = async () => {
    if (!('Notification' in window)) {
      alert("Votre navigateur ne supporte pas le système de notifications push.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        // Ready for Firebase Cloud Messaging token generation register flow
        console.log('[Push System] Notification permissions approved!');
        
        // Push notification simulation test for client validation
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('StarBetPay 🌟', {
            body: 'Merci d\'avoir activé les notifications ! Vos alertes de dépôts & retraits s\'afficheront ici.',
            icon: '/starbetpay_icon.jpg',
            badge: '/starbetpay_icon.jpg'
          });
        }
      }
    } catch (err) {
      console.error('Error enabling push notifications:', err);
    }
  };

  return (
    <>
      {/* 1. SUCCESS OVERLAY TOAST */}
      {successMessage && (
        <div id="pwa-success-toast" className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#122c36] border-2 border-emerald-500/50 rounded-2xl p-4 shadow-2xl flex items-center gap-3 animate-bounce max-w-sm w-[90%]">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check size={20} className="stroke-[3]" />
          </div>
          <div>
            <h4 className="font-extrabold text-xs text-white uppercase tracking-wider font-display">StarBetPay PWA</h4>
            <p className="text-[11px] text-gray-300 font-medium">🎉 Application installée avec succès sur votre appareil.</p>
          </div>
        </div>
      )}

      {/* 2. PREMIUM AUTOMATIC PROMPT POPUP */}
      {showPremiumModal && !installed && (
        <div id="pwa-premium-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05070f]/80 backdrop-blur-md animate-fade-in">
          <div className="bg-gradient-to-b from-[#111c3b] to-[#080d1e] border-2 border-cyan-500/20 rounded-3xl max-w-sm w-full p-6 relative shadow-[0_0_50px_rgba(6,182,212,0.15)] animate-scale-up">
            
            {/* Close Cross icon */}
            <button
              onClick={handleLaterDismiss}
              type="button"
              className="absolute top-4 right-4 p-1.5 rounded-full bg-[#1b2b52] hover:bg-[#23386b] text-gray-400 hover:text-white transition-all cursor-pointer"
              title="Fermer"
            >
              <X size={14} />
            </button>

            {/* Application Mini Header branding */}
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 rounded-2.5xl text-cyan-400 relative">
                <Smartphone size={32} className="stroke-[1.5]" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500"></span>
                </span>
              </div>
            </div>

            {/* Metadata information */}
            <div className="text-center mb-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-widest rounded-full mb-2">
                <Sparkles size={11} /> Standard Mobile PWA
              </span>
              <h3 className="text-lg font-black font-display text-white">📱 Installez notre application</h3>
              <p className="text-gray-300 text-xs leading-relaxed mt-2 px-1">
                Accéder plus rapidement à vos dépôts, retraits, échanges et au suivi de vos transactions directement depuis votre téléphone.
              </p>
            </div>

            {/* Core Advantages checklist */}
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 mb-5 space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-gray-300">
                <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Accès rapide sans taper d'adresse</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-gray-300">
                <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Notifications instantanées des transactions</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-gray-300">
                <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Expérience globale plus fluide et accélérée</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-gray-300">
                <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Fonctionne de manière autonome</span>
              </div>
            </div>

            {/* Interaction Buttons - Actions */}
            <div className="space-y-2.5">
              <button
                onClick={handleInstallClick}
                type="button"
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
              >
                Installer maintenant
              </button>
              <button
                onClick={handleLaterDismiss}
                type="button"
                className="w-full py-2.5 bg-transparent hover:bg-slate-900 text-gray-400 hover:text-white font-bold text-xs rounded-2xl transition-all text-center"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PREMIUM ELEGANT iOS / AUTOMATIC GUIDE DRAWER */}
      {showiOSGuide && (
        <div id="pwa-ios-drawer" className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-[#05070f]/95 backdrop-blur-md animate-fade-in">
          <div className="bg-gradient-to-b from-[#111c3b] to-[#080d1e] border-2 border-cyan-500/20 rounded-t-[32px] rounded-b-none md:rounded-[32px] max-w-md w-full p-6 relative shadow-2xl animate-scale-up border-b-none mb-0 md:mb-10">
            
            {/* Grabber handle bar */}
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-5 block" />

            <button
              onClick={() => setShowiOSGuide(false)}
              type="button"
              className="absolute top-4 right-4 p-1.5 rounded-full bg-[#1b2b52] hover:bg-[#23386b] text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={14} />
            </button>

            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mb-2.5">
                <Share2 size={22} className="stroke-[2]" />
              </div>
              <h3 className="text-base font-black text-white font-display">📥 Installer sur votre {isIOS ? 'iPhone / iPad' : 'Appareil'}</h3>
              <p className="text-gray-400 text-xs mt-1">
                {isIOS 
                  ? "Safari iOS exige une installation manuelle simplifiée."
                  : "Veuillez suivre les étapes suivantes pour enregistrer l'application."}
              </p>
            </div>

            {/* Visual Step checklist tutorials */}
            <div className="space-y-4">
              <div className="flex gap-4 items-start bg-slate-950/40 border border-slate-900 rounded-2xl p-4">
                <div className="w-7 h-7 rounded-full bg-[#20315c] text-cyan-400 font-mono font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-100 flex items-center gap-1">
                    Appuyez sur <Share2 size={13} className="text-blue-400" /> "Partager"
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Trouvez le bouton dans la barre d'outils de votre navigateur en bas (ou en haut sur iPad).
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start bg-slate-950/40 border border-slate-900 rounded-2xl p-4">
                <div className="w-7 h-7 rounded-full bg-[#20315c] text-cyan-400 font-mono font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-100">
                    Sélectionnez "Sur l'écran d'accueil"
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Faites défiler le menu d'actions Safari puis appuyez sur l'option <strong className="text-white">"Sur l'écran d'accueil"</strong> (ou <strong className="text-white font-bold">Add to Home Screen</strong>).
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start bg-slate-950/40 border border-slate-900 rounded-2xl p-4">
                <div className="w-7 h-7 rounded-full bg-[#20315c] text-cyan-400 font-mono font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-100">
                    Confirmez avec "Ajouter"
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Appuyez sur <strong className="text-white">"Ajouter"</strong> en haut à droite pour finaliser. L'application apparaîtra maintenant à côté de vos autres applis !
                  </p>
                </div>
              </div>
            </div>

            {/* Ready for Firebase Push Toggle button in same premium drawer */}
            {notificationPermission !== 'granted' && (
              <div className="mt-5 p-3.5 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex gap-2 items-center">
                  <Bell size={16} className="text-cyan-400 shrink-0" />
                  <div className="text-[10px]">
                    <span className="font-extrabold text-[#00f0ff] uppercase block">Recevoir des notifications ?</span>
                    <span className="text-gray-400 block mt-0.5 leading-tight">Activer les alertes de dépôts/retraits.</span>
                  </div>
                </div>
                <button
                  onClick={handleEnablePushNotifications}
                  type="button"
                  className="px-3 py-1.5 bg-[#1b2b52] hover:bg-cyan-500 hover:text-slate-950 text-white font-bold text-[10px] rounded-xl transition-all uppercase tracking-wider shrink-0"
                >
                  Activer
                </button>
              </div>
            )}

            <button
              onClick={() => setShowiOSGuide(false)}
              type="button"
              className="mt-5 w-full py-3 bg-[#111c34l] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
            >
              Fermer le guide
            </button>
          </div>
        </div>
      )}
    </>
  );
}
