import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellOff, Check, Trash2, X, AlertTriangle, Calendar, Award, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { db, askForNotificationPermissionAndGetToken } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { DBNotification } from '../types';

interface NotificationCenterProps {
  user: any;
  isAdminMode: boolean;
  onNavigateToTab: (tabId: string) => void;
  openTransactionInAdmin?: (txId: string, type: 'deposit' | 'withdrawal' | 'commission_payout', status: 'pending' | 'validated' | 'rejected') => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  user,
  isAdminMode,
  onNavigateToTab,
  openTransactionInAdmin
}) => {
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const soundEnabled = true;

  const prevCountRef = useRef(0);

  const phoneQueryStr = isAdminMode ? 'admin' : (user?.phone || '');

  // Play a beautiful, sleek system notification sound chime
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioCtx) return;

      // Simple elegant synthesize chime
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      // Ignored if browser blocks audio autoplay on mount
    }
  };

  // 1. Setup real-time updates and FCM registers
  useEffect(() => {
    if (!user || !phoneQueryStr) return;

    // Trigger FCM Token Permission and Storage
    setTimeout(() => {
      askForNotificationPermissionAndGetToken(user.phone).then((token) => {
        if (token) setPermissionGranted(true);
      });
    }, 2000);

    // Dynamic Database Listener (Cloud vs SSE Local Fallback wrapper)
    let unsubscribe: () => void = () => {};
    let sseSource: EventSource | null = null;

    const useLocalFallback = typeof window !== 'undefined' && 
      (window.localStorage.getItem('starbetpay_sandbox_mode') === 'true' || 
       !import.meta.env.VITE_FIREBASE_PROJECT_ID);

    if (!useLocalFallback) {
      try {
        console.log(`[Notification Engine] Initializing live Firestore listener for user: ${phoneQueryStr}`);
        const q = query(
          collection(db, 'notifications'),
          where('user_id', '==', phoneQueryStr),
          orderBy('created_at', 'desc')
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          const fetched: DBNotification[] = [];
          snapshot.forEach((docSnap) => {
            fetched.push({ id: docSnap.id, ...docSnap.data() } as DBNotification);
          });
          setNotifications(fetched);
        }, (err) => {
          console.warn('[Notification Engine] Snapshot warning (listening offline/fallback):', err);
        });
      } catch (err) {
        console.warn('[Notification Engine] Cloud listener error, seeking fallback:', err);
      }
    }

    // Secondary fallback to custom SSE live pipeline if running locally or offline
    try {
      console.log(`[Notification Engine] Registering backup SSE live monitor for: ${phoneQueryStr}`);
      sseSource = new EventSource(`/api/notifications-sse?phone=${encodeURIComponent(phoneQueryStr)}`);
      
      sseSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.connected) return;

          const newNotif = data as DBNotification;
          setNotifications((prev) => {
            // Avoid duplicate registrations
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
        } catch (e) {
          console.error('[Notification Engine] Failed parsing incoming SSE frame:', e);
        }
      };

      sseSource.onerror = (err) => {
        // Silent connection recovery
      };
    } catch (e) {
      console.warn('[Notification Engine] Backup SSE registration failed:', e);
    }

    // Refresh notifications list from server periodically as secondary reliability backup
    const fetchFreshList = async () => {
      try {
        const res = await fetch(`/api/notifications?phone=${encodeURIComponent(phoneQueryStr)}`);
        if (res.ok) {
          const list = await res.json();
          setNotifications(list);
        }
      } catch (e) {
        // silent fetch Error
      }
    };
    fetchFreshList();

    return () => {
      unsubscribe();
      if (sseSource) sseSource.close();
    };
  }, [user, phoneQueryStr]);

  // Sound triggering when list count increments
  const unreadCount = notifications.filter(n => !n.is_read).length;
  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      playChime();
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  // Mark all notifications as read on API
  const handleMarkAllAsRead = async () => {
    try {
      // Local updates for instantaneous UI feedback without delays
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneQueryStr })
      });

      // Update cloud if applicable
      const useLocal = typeof window !== 'undefined' && window.localStorage.getItem('starbetpay_sandbox_mode') === 'true';
      if (!useLocal && notifications.length > 0) {
        notifications.forEach(async (n) => {
          if (!n.is_read) {
            try {
              const docRef = doc(db, 'notifications', n.id);
              await updateDoc(docRef, { is_read: true });
            } catch (e) {}
          }
        });
      }
    } catch (err) {
      console.warn('[Notification Engine] Error marking notifications read:', err);
    }
  };

  // Mark single notification as read and trigger navigation action
  const handleNotificationClick = async (notif: DBNotification) => {
    setIsOpen(false);
    
    // Mark as read immediately
    try {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id })
      });

      const useLocal = typeof window !== 'undefined' && window.localStorage.getItem('starbetpay_sandbox_mode') === 'true';
      if (!useLocal) {
        try {
          const docRef = doc(db, 'notifications', notif.id);
          await updateDoc(docRef, { is_read: true });
        } catch (e) {}
      }
    } catch (err) {
      console.warn('[Notification Engine] Mark single read error:', err);
    }

    // Direct action based on notification details
    if (isAdminMode) {
      if (notif.txId && openTransactionInAdmin) {
        openTransactionInAdmin(
          notif.txId, 
          notif.txType || 'deposit', 
          notif.txStatus || 'pending'
        );
      } else if (notif.type === 'commission_request') {
        onNavigateToTab('withdrawals');
      }
    } else {
      // Client redirection
      if (notif.type === 'new_coupon' || notif.couponId) {
        onNavigateToTab('pronos');
      } else if (notif.type?.includes('deposit') || notif.type?.includes('withdrawal')) {
        onNavigateToTab('history');
      }
    }
  };

  // Purge notifications
  const handleClearNotifications = async () => {
    try {
      setNotifications([]);
      await fetch('/api/notifications/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneQueryStr })
      });
    } catch (err) {
      console.warn('[Notification Engine] Reset notifications error:', err);
    }
  };

  const getIcon = (type: string) => {
    if (type.includes('deposit_validated') || type.includes('withdrawal_validated')) return <ArrowUpRight size={15} className="text-emerald-400" />;
    if (type.includes('deposit_rejected') || type.includes('withdrawal_rejected')) return <ArrowDownLeft size={15} className="text-rose-400" />;
    if (type.includes('new_coupon')) return <Award size={15} className="text-amber-400" />;
    if (type.includes('request')) return <AlertTriangle size={15} className="text-cyan-400" />;
    return <Calendar size={15} className="text-gray-400" />;
  };

  const formatTime = (timeStr: string) => {
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      return timeStr;
    }
  };

  return (
    <div className="relative z-50 inline-block" id="notification-bell-container">
      {/* BELL TRIGGER WITH COUNT BADGE */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-gray-300 hover:text-white transition-all flex items-center justify-center cursor-pointer select-none active:scale-95"
        id="notification-bell-btn"
      >
        {unreadCount > 0 ? (
          <motion.div
            animate={{ rotate: [0, -15, 15, -15, 15, 0] }}
            transition={{ repeat: Infinity, duration: 2, repeatDelay: 5 }}
          >
            <Bell size={20} className="text-[#00f0ff]" />
          </motion.div>
        ) : (
          <Bell size={20} />
        )}

        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
            id="notification-unread-badge"
          >
            {unreadCount}
          </motion.span>
        )}
      </button>

      {/* DROPDOWN POPOVER PANEL */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop click dismisser */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0b1227] border border-slate-800 shadow-2xl p-4 z-50 text-left space-y-3"
              id="notification-panel-dropdown"
            >
              {/* PANEL HEADER */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-black text-gray-100 font-display">Notifications</h4>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#00f0ff]/10 text-[#00f0ff] rounded-md">
                      {unreadCount} nouvelle(s)
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      title="Tout marquer comme lu"
                      className="p-1 rounded-lg text-gray-400 hover:text-[#00f0ff] hover:bg-slate-850 transition-colors cursor-pointer"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearNotifications}
                      title="Tout effacer"
                      className="p-1 rounded-lg text-gray-400 hover:text-red-400 hover:bg-slate-850 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-slate-850 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* LIST CONTAINER */}
              <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {notifications.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center text-gray-500 space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                      <BellOff size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400">Aucune notification disponible.</p>
                      <p className="text-[10px] text-gray-500">Nous vous préviendrons dès que vos demandes seront traitées !</p>
                    </div>
                  </div>
                ) : (
                  notifications.slice(0, 10).map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`relative p-3 rounded-xl border transition-all text-xs cursor-pointer select-none ${
                        notif.is_read
                          ? 'bg-slate-950/20 border-slate-900 text-gray-400 hover:bg-slate-950/40'
                          : 'bg-[#121c38]/70 border-cyan-500/25 text-gray-100 shadow-md hover:bg-[#121c38]'
                      }`}
                    >
                      {/* UNREAD BLUE BADGE PIN */}
                      {!notif.is_read && (
                        <div className="absolute top-3.5 right-3 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_6px_#00f0ff]" />
                      )}

                      <div className="flex gap-2.5 items-start">
                        <div className="mt-0.5 w-6 h-6 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-center flex-shrink-0">
                          {getIcon(notif.type)}
                        </div>
                        <div className="space-y-0.5 leading-tight pr-3 w-full">
                          <p className="font-extrabold text-white tracking-tight">{notif.title}</p>
                          <p className="text-[11px] text-gray-300 whitespace-pre-line">{notif.message}</p>
                          <p className="text-[9px] text-gray-500 font-mono pt-1">{formatTime(notif.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* SEE ALL TRIGGER FOOTER */}
              {notifications.length > 10 && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowHistoryModal(true);
                  }}
                  className="w-full py-2 bg-slate-950/40 hover:bg-slate-950/80 border border-slate-900 rounded-xl text-center text-[10px] font-extrabold text-[#00f0ff] uppercase tracking-wider block cursor-pointer"
                >
                  Afficher l'historique complet ({notifications.length})
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FULL RECORD MODAL LIST DIALOG */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="relative w-full max-w-lg bg-[#0b1227] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] z-10"
              id="notification-history-modal"
            >
              {/* MODAL HEADER */}
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
                <div>
                  <h3 className="text-base font-black text-white font-display">Historique des notifications</h3>
                  <p className="text-[10px] text-gray-400">Total cumulé : {notifications.length} alertes</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearNotifications}
                    className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    Tout effacer
                  </button>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="p-2 bg-slate-900 hover:bg-slate-850 rounded-xl border border-slate-800 text-gray-400 hover:text-white transition-all cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* LIST BODY */}
              <div className="p-5 overflow-y-auto space-y-2.5 flex-1 max-h-[60vh] scrollbar-thin scrollbar-thumb-slate-800">
                {notifications.length === 0 ? (
                  <div className="py-20 text-center text-gray-500 space-y-1">
                    <p className="text-xs font-bold text-gray-400">Historique vide.</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        setShowHistoryModal(false);
                        handleNotificationClick(notif);
                      }}
                      className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex items-start gap-3 hover:bg-slate-950 cursor-pointer transition-all"
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {getIcon(notif.type)}
                      </div>
                      <div className="space-y-0.5 leading-snug w-full">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-extrabold text-white text-xs">{notif.title}</p>
                          <p className="text-[8px] text-gray-500 font-mono whitespace-nowrap pt-0.5">{formatTime(notif.created_at)}</p>
                        </div>
                        <p className="text-[11px] text-gray-300">{notif.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
