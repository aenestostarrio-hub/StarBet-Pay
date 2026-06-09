import React, { useState, useEffect, useRef } from 'react';
import { 
  Star, Shield, RefreshCw, LogOut, CheckCircle2, AlertCircle, XCircle, X, 
  Plus, Copy, Check, Upload, Send, MessageSquare, Phone, Info, MapPin, 
  PlusCircle, Sparkles, AlertTriangle, ArrowUpRight, BarChart3, TrendingUp, Users, Wallet, Eye, Download, Bell, Volume2, ShieldAlert,
  Edit, Calendar, ChevronDown
} from 'lucide-react';
import { InstallPrompt } from './components/InstallPrompt';
import { DBUser, DBTransaction, PaymentMethod, AppConfig, SportCoupon } from './types';
import { dbService, isSupabaseConfigured, useLocalStorageSandbox } from './lib/supabase';
// @ts-ignore
import promoStarrio from './assets/images/promo_starrio_1780940672432.png';

// Global shared AudioContext to bypass modern browser autoplay restrictions elegantly
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioCtx;
}

// Automatically resume and unlock the AudioContext on any real interaction with the screen
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        console.log('[StarBetPay] AudioContext successfully authorized inside user session. 🎉');
        // Play an ultra-short silence to force hardware audio pipe activation
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(0);
        osc.stop(0.01);
        
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      }).catch(e => console.warn('Failed to unlock Audio:', e));
    } else if (ctx && ctx.state === 'running') {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    }
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('touchstart', unlockAudio);
}

// Web audio API programmatic chime synthesizer to alert the admin
function playChimeNotification() {
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const now = audioCtx.currentTime;
    
    // Low crisp tone
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc1.start(now);
    osc1.stop(now + 0.4);

    // High sparkling tone
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.1); // A5
    gain2.gain.setValueAtTime(0.15, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc2.start(now + 0.1);
    osc2.stop(now + 0.5);
  } catch (error) {
    console.warn('Audio Context block / play error:', error);
  }
}

export default function App() {
  // Session & Auth state
  const [user, setUser] = useState<Omit<DBUser, 'passwordHash'>>(() => {
    const stored = localStorage.getItem('starbetpay_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [tempUser, setTempUser] = useState<any | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [copiedPromo, setCopiedPromo] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [authForm, setAuthForm] = useState({
    phone: '',
    name: '',
    password: '',
    parentPhone: ''
  });
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // App Config and General Data State
  const [config, setConfig] = useState<AppConfig>({
    popupEnabled: true,
    popupTitle: 'Chers clients',
    popupMessage: 'Bienvenue sur StarBet Pay, la solution de dépôt & retrait rapide.',
    supportWhatsapp: '+22900000000',
    withdrawalPhysVille: 'Abomey Calavi',
    withdrawalPhysRue: 'Chez star prono'
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [coupons, setCoupons] = useState<SportCoupon[]>([]);

  const knownTxIdsRef = useRef<Set<string>>(new Set());
  const transactionsRef = useRef<DBTransaction[]>([]);

  // Client Side UI Active Tab ('home', 'deposit', 'pronos', 'withdrawal', 'history')
  const [activeTab, setActiveTab] = useState<string>('home');
  const [transactions, setTransactions] = useState<DBTransaction[]>([]);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  // Forms / Input State
  const [depositForm, setDepositForm] = useState({
    xbetAccount: '',
    amount: '',
    paymentMethod: ''
  });
  const [screenshotBase64, setScreenshotBase64] = useState<string>('');
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    withdrawCode: '',
    paymentMethod: '',
    paymentNumber: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Referral UI State
  const [refStats, setRefStats] = useState({
    balanceCommission: 0,
    balanceCommissionWithdrawn: 0,
    filleulsCount: 0,
    referralCode: ''
  });

  // Admin Dashboard UI State
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminTab, setAdminTab] = useState<'stats' | 'deposits' | 'withdrawals' | 'pronos' | 'config' | 'users'>('stats');
  const [adminSubTab, setAdminSubTab] = useState<'pending' | 'validated' | 'rejected'>('pending');
  const [adminRejectedReason, setAdminRejectedReason] = useState<Record<string, string>>({});
  const [activeReceiptLightbox, setActiveReceiptLightbox] = useState<string | null>(null);
  const [expandedTxIds, setExpandedTxIds] = useState<Record<string, boolean>>({});
  const [allUsers, setAllUsers] = useState<DBUser[]>([]);
  const [usersSearchQuery, setUsersSearchQuery] = useState('');
  
  // Client interactive overlay modal state
  const [isClientPopupDismissed, setIsClientPopupDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('starbetpay_popup_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  // Modern Toast notification system to replace window.alert (which are blocked in browser iframes)
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }>>([]);
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    try {
      return 'Notification' in window ? Notification.permission : 'default';
    } catch {
      return 'default';
    }
  });

  const dismissClientPopup = () => {
    setIsClientPopupDismissed(true);
    try {
      sessionStorage.setItem('starbetpay_popup_dismissed', 'true');
    } catch (e) {
      console.warn(e);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showToast("Ce navigateur ne prend pas en charge les notifications de bureau.", "warning");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification("Notifications activées ! 🎉", {
            body: "Vous recevrez désormais les alertes de vos dépôts et retraits même si l'application est fermée.",
            icon: "https://cdn-icons-png.flaticon.com/512/10043/10043372.png"
          });
        } else {
          new Notification("Notifications activées ! 🎉", {
            body: "Vous recevrez désormais les alertes de transaction sur cet appareil.",
            icon: "https://cdn-icons-png.flaticon.com/512/10043/10043372.png"
          });
        }
        showToast("Notifications activées avec succès ! 🎉", "success");
      } else {
        showToast("L'autorisation pour les notifications a été refusée.", "info");
      }
    } catch (err) {
      console.error("Erreur de demande de permission de notification :", err);
      showToast("Impossible d'activer les notifications.", "error");
    }
  };
  
  // Real-time Administrator notifications & status list
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [mfaHelperShown, setMfaHelperShown] = useState(false);

  // AI Generation Loading states
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgressText, setAiProgressText] = useState('');

  // Config tab form states
  const [configForm, setConfigForm] = useState({
    popupEnabled: true,
    popupTitle: '',
    popupMessage: '',
    supportWhatsapp: '',
    withdrawalPhysVille: '',
    withdrawalPhysRue: ''
  });
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    name: '',
    number: ''
  });

  const [pastCoupons, setPastCoupons] = useState<SportCoupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<string>(''); // Default empty to open creator on demand
  const [editingPastCoupon, setEditingPastCoupon] = useState<SportCoupon | null>(null); // For history editing flow
  const [couponEditForm, setCouponEditForm] = useState<{
    id: string;
    title: string;
    confidence: 'ÉLEVÉ' | 'MOYEN' | 'RISQUE ÉLEVÉ';
    totalCote: number;
    matches: { homeTeam: string; awayTeam: string; prediction: string; odd: number; status?: 'pending' | 'won' | 'lost' }[];
    status?: 'pending' | 'won' | 'lost';
  }>({
    id: '',
    title: '',
    confidence: 'ÉLEVÉ',
    totalCote: 2.0,
    matches: []
  });

  // Action: Triggered when admin chooses a cote caliber they want to create
  const handleSelectCouponToCreate = (id: string) => {
    setSelectedCouponId(id);
    let title = '';
    let confidence: 'ÉLEVÉ' | 'MOYEN' | 'RISQUE ÉLEVÉ' = 'ÉLEVÉ';
    let totalCote = 2.00;

    if (id === 'secured') {
      title = 'COUPON COTE 2 SÉCURISÉ 🌟';
      confidence = 'ÉLEVÉ';
      totalCote = 2.00;
    } else if (id === 'medium') {
      title = 'COUPON COTE 5 MÉDIUM ⚡';
      confidence = 'MOYEN';
      totalCote = 5.00;
    } else if (id === 'bold') {
      title = 'COUPON COTE 10 AUDACIEUX 🔥';
      confidence = 'RISQUE ÉLEVÉ';
      totalCote = 10.00;
    }

    setCouponEditForm({
      id,
      title,
      confidence,
      totalCote,
      matches: [], // starts clean with zero events
      status: 'pending'
    });
  };

  // Fetch general app configurations
  const fetchAppConfigAndData = async () => {
    try {
      const configData = await dbService.getConfig();
      setConfig(configData);
      setConfigForm({
        popupEnabled: configData.popupEnabled,
        popupTitle: configData.popupTitle,
        popupMessage: configData.popupMessage,
        supportWhatsapp: configData.supportWhatsapp,
        withdrawalPhysVille: configData.withdrawalPhysVille,
        withdrawalPhysRue: configData.withdrawalPhysRue
      });

      const pmData = await dbService.getPaymentMethods();
      setPaymentMethods(pmData);
      // Default select active payment method
      const activePm = pmData.find((p: PaymentMethod) => p.active);
      if (activePm) {
        setDepositForm(prev => ({ ...prev, paymentMethod: activePm.name }));
        setWithdrawalForm(prev => ({ ...prev, paymentMethod: activePm.name }));
      }

      const couponsData = await dbService.getCoupons();
      setCoupons(couponsData);

      const historyData = await dbService.getPastCoupons();
      setPastCoupons(historyData);
    } catch (err) {
      console.error('Error fetching baseline app data:', err);
    }
  };

// Fetch client specific transactions and referral stats
  const fetchClientUserData = async (phone: string) => {
    try {
      const txData = await dbService.getTransactions(phone);
      setTransactions(txData);
      
      // Seed the known transaction state to prevent false alarms on historic list
      txData.forEach(tx => knownTxIdsRef.current.add(tx.id));

      const statsData = await dbService.getUserStats(phone);
      setRefStats(statsData);
    } catch (err) {
      console.error('Error fetching client credentials:', err);
    }
  };

  // Fetch ALL transactions and users for Admin Dashboard
  const fetchAdminTransactions = async () => {
    try {
      const txData = await dbService.getTransactions();
      setTransactions(txData);
      
      // Seed the known transaction state immediately to detect new arrivals in real-time
      txData.forEach(tx => knownTxIdsRef.current.add(tx.id));
      
      const usersData = await dbService.getUsers();
      setAllUsers(usersData);
    } catch (e) {
      console.error(e);
    }
  };

  // Initialize general app configs
  useEffect(() => {
    fetchAppConfigAndData();
    
    // Check if referee link is active via URL params
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
      setAuthForm(prev => ({ ...prev, parentPhone: refCode }));
      setAuthTab('register');
    }
  }, []);

  // Update data state depending on user session
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        setIsAdminMode(true);
        fetchAdminTransactions();
      } else {
        setIsAdminMode(false);
        fetchClientUserData(user.phone);
      }
    } else {
      setIsAdminMode(false);
    }
  }, [user]);

  // Establish Real-Time or Polling notifications for administrators & clients
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: any = null;

    const triggerNativeNotification = (title: string, body: string) => {
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: "https://cdn-icons-png.flaticon.com/512/10043/10043372.png"
          });
        }
      } catch (e) {
        console.warn("Native desktop notification helper:", e);
      }
    };

    if (!user) {
      knownTxIdsRef.current.clear();
      return;
    }

    // A. SYNC WORKER FOR ADMINISTRATORS
    if (user.role === 'admin') {
      // 1. Setup SSE connection (if local standalone fallback is not active)
      if (!isSupabaseConfigured && !useLocalStorageSandbox) {
        try {
          eventSource = new EventSource('/api/admin/notifications-sse');
          
          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data && data.heartbeat) {
                return; // skip heartbeat raw pings
              }
              const tx = data as DBTransaction;
              if (tx && tx.id && !knownTxIdsRef.current.has(tx.id)) {
                knownTxIdsRef.current.add(tx.id);
                playChimeNotification();
                setAdminNotifications(prev => {
                  if (prev.some(p => p.id === tx.id)) return prev;
                  return [tx, ...prev];
                });
                
                // Show alerts
                const notifyMsg = `Nouveau dépôt/retrait de ${tx.userName} (${tx.amount.toLocaleString()} FCFA)`;
                showToast(notifyMsg, 'info');
                triggerNativeNotification("Nouvelle transaction StarBetPay 🔔", notifyMsg);

                // Refresh current tables
                fetchAdminTransactions();
              }
            } catch (err) {
              console.error('[SSE event processing failed]:', err);
            }
          };

          eventSource.onerror = (err) => {
            console.warn('Admin SSE notification stream paused or reconnecting...', err);
          };
        } catch (err) {
          console.warn('EventSource initialization bypassed: ', err);
        }
      }

      // 2. Active, ultra-robust background polling fallback every 2.0 seconds
      pollInterval = setInterval(async () => {
        try {
          const freshTxs = await dbService.getTransactions();
          
          // Populate reference set if raw empty on mount
          const isFirstRun = knownTxIdsRef.current.size === 0;
          if (isFirstRun) {
            freshTxs.forEach(t => knownTxIdsRef.current.add(t.id));
          }

          freshTxs.forEach(tx => {
            if (!knownTxIdsRef.current.has(tx.id)) {
              knownTxIdsRef.current.add(tx.id);
              
              // Only trigger chime if it's not the first loading list execution
              if (!isFirstRun) {
                playChimeNotification();
                setAdminNotifications(prev => {
                  if (prev.some(p => p.id === tx.id)) return prev;
                  return [tx, ...prev];
                });
                
                // Trigger desktop & in-app alerts
                const notifyMsg = `Nouveau dépôt/retrait de ${tx.userName} (${tx.amount.toLocaleString()} FCFA)`;
                showToast(notifyMsg, 'info');
                triggerNativeNotification("Nouvelle transaction StarBetPay 🔔", notifyMsg);
              }
            }
          });

          // Update transactions list
          setTransactions(freshTxs);

          // Periodically load baseline active users
          const usersData = await dbService.getUsers();
          setAllUsers(usersData);
        } catch (e) {
          console.warn('Admin background sync loop issue:', e);
        }
      }, 2000);

    } 
    // B. SYNC WORKER FOR CLIENTS (REGULAR USERS)
    else {
      // Setup client automatic synchronization polling every 2.0 seconds
      pollInterval = setInterval(async () => {
        try {
          // 1. Fetch user transactions list
          const freshTxs = await dbService.getTransactions(user.phone);
          
          // Detect status transitions (pending -> validated/rejected)
          transactionsRef.current.forEach(oldTx => {
            const correspondingFresh = freshTxs.find(f => f.id === oldTx.id);
            if (correspondingFresh && oldTx.status === 'pending' && correspondingFresh.status !== 'pending') {
              if (correspondingFresh.status === 'validated') {
                playChimeNotification();
                const text = `Félicitations ! Votre demande de ${correspondingFresh.amount.toLocaleString()} FCFA a été VALIDÉE. 🎉`;
                showToast(text, 'success');
                triggerNativeNotification("StarBetPay - Opération Validée 🎉", text);
              } else if (correspondingFresh.status === 'rejected') {
                playChimeNotification();
                const text = `Votre demande de ${correspondingFresh.amount.toLocaleString()} FCFA a été ANNULÉE / REJETÉE : ${correspondingFresh.rejectionReason || 'Non specifié'}`;
                showToast(text, 'error');
                triggerNativeNotification("StarBetPay - Opération Refusée ❌", text);
              }
            }
          });

          setTransactions(freshTxs);

          // 2. Fetch user parent/referral stats
          const freshStats = await dbService.getUserStats(user.phone);
          setRefStats(freshStats);

          // 3. Keep sport coupons & popup settings up to date
          const freshCoupons = await dbService.getCoupons();
          setCoupons(freshCoupons);
        } catch (e) {
          console.warn('Client background sync loop issue:', e);
        }
      }, 2000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (eventSource) eventSource.close();
    };
  }, [user]);

  // Handle generic clipboard copies with robust iframe fallback support
  const handleCopyToClipboard = (text: string) => {
    const performCopy = () => {
      setCopiedText(text);
      setTimeout(() => {
        setCopiedText(null);
      }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(performCopy)
        .catch(() => {
          fallbackCopyText(text, performCopy);
        });
    } else {
      fallbackCopyText(text, performCopy);
    }
  };

  const fallbackCopyText = (text: string, onSuccess: () => void) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        onSuccess();
      }
    } catch (err) {
      console.warn('Fallback copy failed', err);
    }
  };

  // Action: Register User Action
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      await dbService.register(
        authForm.phone.trim(),
        authForm.name.trim(),
        authForm.password,
        authForm.parentPhone ? authForm.parentPhone.trim() : undefined
      );

      setAuthSuccess('Votre compte a été enregistré avec succès ! Veuillez vous connecter.');
      setAuthForm(prev => ({ ...prev, password: '' })); // clear password
      setAuthTab('login');
    } catch (err: any) {
      setAuthError(err.message || 'Erreur lors de l\'enregistrement.');
    }
  };

  // Action: Login User Action (Triggers MFA prompt)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      const data = await dbService.login(
        authForm.phone.trim(),
        authForm.password
      );

      // Correct credentials, proceed to full-factor verification block
      setTempUser(data.tempUser);
      setMfaCode('');
    } catch (err: any) {
      setAuthError(err.message || 'Une erreur de connexion est survenue. Veuillez vérifier votre réseau.');
    }
  };

  // Action: Verify MFA security token check
  const handleVerifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      const userData = await dbService.verifyMfa(
        tempUser.phone,
        mfaCode.trim()
      );

      setUser(userData);
      localStorage.setItem('starbetpay_user', JSON.stringify(userData));
      setTempUser(null);
      // Reset popup view state so it shows up beautifully on login
      try {
        sessionStorage.removeItem('starbetpay_popup_dismissed');
      } catch {}
      setIsClientPopupDismissed(false);
    } catch (e: any) {
      setAuthError(e.message || 'Code MFA incorrect ou expiré. Veillez utiliser le code de démo.');
    }
  };

  // Action: Log Out
  const handleLogout = () => {
    localStorage.removeItem('starbetpay_user');
    setUser(null);
    setIsAdminMode(false);
    setActiveTab('home');
    setTempUser(null);
    // Reset popup view state on logout
    try {
      sessionStorage.removeItem('starbetpay_popup_dismissed');
    } catch {}
    setIsClientPopupDismissed(false);
  };

  // Action: Handle Screenshot receipt conversion
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Action: Client submits a new transaction (Deposit / Recharge 1xBet)
  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMsg(null);

    const activePmObj = paymentMethods.find(p => p.name === depositForm.paymentMethod);
    const paymentNumberValue = activePmObj ? activePmObj.number : '';

    if (!depositForm.xbetAccount || !depositForm.amount || !depositForm.paymentMethod) {
      setFormLoading(false);
      setFormMsg({ type: 'error', text: 'Veuillez remplir la totalité des champs requis.' });
      return;
    }

    if (Number(depositForm.amount) < 500) {
      setFormLoading(false);
      setFormMsg({ type: 'error', text: 'Le montant minimum requis pour un dépôt est de 500 FCFA.' });
      return;
    }

    if (!screenshotBase64) {
      setFormLoading(false);
      setFormMsg({ type: 'error', text: 'Vous devez joindre une capture d\'écran du reçu de transfert afin de valider l\'opération.' });
      return;
    }

    try {
      const transaction = await dbService.createTransaction({
        type: 'deposit',
        amount: Number(depositForm.amount),
        userPhone: user!.phone,
        userName: user!.name,
        xbetAccount: depositForm.xbetAccount,
        paymentMethod: depositForm.paymentMethod,
        paymentNumber: paymentNumberValue,
        screenshot: screenshotBase64
      });

      setFormMsg({ type: 'success', text: 'Demande enregistrée en temps réel, en attente de vérification par l\'administration.' });
      setDepositForm({ xbetAccount: '', amount: '', paymentMethod: paymentMethods[0]?.name || '' });
      setScreenshotBase64('');
      fetchClientUserData(user!.phone);
    } catch (e: any) {
      setFormMsg({ type: 'error', text: e.message || 'Erreur lors de la validation du dépôt.' });
    } finally {
      setFormLoading(false);
    }
  };

  // Action: Client submits a client withdrawal (Withdrawal from 1xBet)
  const handleCreateWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMsg(null);

    if (!withdrawalForm.amount || !withdrawalForm.withdrawCode || !withdrawalForm.paymentMethod || !withdrawalForm.paymentNumber) {
      setFormLoading(false);
      setFormMsg({ type: 'error', text: 'Tous les champs requis du formulaire de retrait doivent être saisis.' });
      return;
    }

    if (Number(withdrawalForm.amount) < 500) {
      setFormLoading(false);
      setFormMsg({ type: 'error', text: 'Le montant minimum requis pour un retrait est de 500 FCFA.' });
      return;
    }

    if (withdrawalForm.withdrawCode.length > 4) {
      setFormLoading(false);
      setFormMsg({ type: 'error', text: 'Le code de retrait 1xBet doit comporter au maximum 4 caractères.' });
      return;
    }

    try {
      const transaction = await dbService.createTransaction({
        type: 'withdrawal',
        amount: Number(withdrawalForm.amount),
        userPhone: user!.phone,
        userName: user!.name,
        xbetAccount: 'COMPTE_RETRAIT',
        paymentMethod: withdrawalForm.paymentMethod,
        paymentNumber: withdrawalForm.paymentNumber,
        withdrawCode: withdrawalForm.withdrawCode
      });

      setFormMsg({ type: 'success', text: 'Demande enregistrée en temps réel, en attente de vérification par l\'administration.' });
      setWithdrawalForm({ amount: '', withdrawCode: '', paymentMethod: paymentMethods[0]?.name || '', paymentNumber: '' });
      fetchClientUserData(user!.phone);
    } catch (e: any) {
      setFormMsg({ type: 'error', text: e.message || 'Une erreur est survenue lors de la validation.' });
    } finally {
      setFormLoading(false);
    }
  };

  // Action: User requests commission payout
  const handleWithdrawCommissionGains = async () => {
    if (refStats.balanceCommission < 2000) {
      alert('Le montant minimum requis pour retirer vos gains de commission est de 2 000 FCFA.');
      return;
    }

    if (!confirm(`Souhaitez-vous vraiment effectuer une demande de retrait pour la totalité de vos gains d'un montant de ${refStats.balanceCommission} FCFA ?`)) {
      return;
    }

    setFormLoading(true);
    try {
      const data = await dbService.requestCommissionPayout(user!.phone);
      alert(data.transaction ? 'Demande de retrait de gain effectuée avec succès.' : 'Erreur de retrait');
      fetchClientUserData(user!.phone);
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Erreur lors de la demande de retrait.');
    } finally {
      setFormLoading(false);
    }
  };

  // Action: Admin updates status of a transaction (Approve / Reject / Reset)
  const handleAdminUpdateStatus = async (txId: string, status: 'pending' | 'validated' | 'rejected') => {
    const reason = adminRejectedReason[txId] || '';
    if (status === 'rejected' && !reason.trim()) {
      showToast('Veuillez saisir un motif de rejet/annulation de la demande.', 'warning');
      return;
    }

    try {
      const updatedTx = await dbService.updateTransactionStatus(txId, status, reason);
      setAdminRejectedReason(prev => {
        const next = { ...prev };
        delete next[txId];
        return next;
      });
      fetchAdminTransactions();
      const statusText = status === 'validated' ? 'validée' : status === 'rejected' ? 'rejetée' : 'remise en attente';
      showToast(`Opération ${statusText} avec succès ! 🎉`, 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Erreur lors de la mise à jour.", 'error');
    }
  };

  // Action: Admin updates platform setting / banner config
  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedConfig = await dbService.updateConfig(configForm);
      setConfig(updatedConfig);
      showToast('Configuration de StarBetPay enregistrée avec succès. ✅', 'success');
      fetchAppConfigAndData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erreur lors de la mise à jour.', 'error');
    }
  };

  // Action: Admin adds a new payment method
  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMethodForm.name || !paymentMethodForm.number) {
      showToast('Veuillez remplir les champs Nom et Numéro de dépôt', 'warning');
      return;
    }

    try {
      const pms = await dbService.addOrUpdatePaymentMethod(paymentMethodForm.name, paymentMethodForm.number);
      setPaymentMethods(pms);
      setPaymentMethodForm({ name: '', number: '' });
      showToast('Nouveau moyen de de paiement enregistré. 💳', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Erreur lors de l'enregistrement.", 'error');
    }
  };

  // Action: Toggle payment method active/inactive
  const handleTogglePaymentMethod = async (name: string) => {
    try {
      const pms = await dbService.togglePaymentMethod(name);
      setPaymentMethods(pms);
    } catch (e) {
      console.error(e);
    }
  };

  // Action: Admin registers manual coupon updates (publishes daily active AND saves directly to history)
  const handleSaveManualCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponEditForm.id) {
      showToast("Veuillez sélectionner le coupon à créer d'abord.", "warning");
      return;
    }
    if (couponEditForm.matches.length === 0) {
      showToast("Veuillez ajouter au moins un match/événement à votre coupon.", "warning");
      return;
    }

    setFormLoading(true);
    try {
      const formattedMatches = couponEditForm.matches.map((m, idx) => ({
        id: idx + 1,
        homeTeam: m.homeTeam.trim(),
        awayTeam: m.awayTeam.trim(),
        prediction: m.prediction.trim(),
        odd: Number(m.odd),
        status: m.status || 'pending'
      }));

      // 1. Update the live active daily coupon so users can access/purchase it
      const updatedCoupons = await dbService.updateCoupon({
        id: couponEditForm.id,
        title: couponEditForm.title.trim(),
        confidence: couponEditForm.confidence,
        totalCote: Number(couponEditForm.totalCote),
        status: couponEditForm.status || 'pending',
        matches: formattedMatches
      });
      setCoupons(updatedCoupons);

      // 2. Automatically create and append a copy of this coupon straight to the archives with today's date
      const todayString = new Date().toLocaleDateString('fr-FR');
      const uniqueHistoryId = `${couponEditForm.id}_${Date.now()}`;
      
      const updatedHistory = await dbService.addPastCoupon({
        id: uniqueHistoryId,
        title: couponEditForm.title.trim(),
        confidence: couponEditForm.confidence,
        totalCote: Number(couponEditForm.totalCote),
        status: couponEditForm.status || 'pending',
        matches: formattedMatches,
        date: todayString
      });
      setPastCoupons(updatedHistory);

      // 3. Reset form fields completely to pristine empty state as requested
      setCouponEditForm({
        id: '',
        title: '',
        confidence: 'ÉLEVÉ',
        totalCote: 2.0,
        matches: [],
        status: 'pending'
      });
      setSelectedCouponId(''); // Deselect creator level

      showToast("Le coupon a été créé, publié, et enregistré dans les archives d'historique ! 🌟", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Erreur lors de l'enregistrement du coupon.", "error");
    } finally {
      setFormLoading(false);
    }
  };

  // Action: Admin saves updates made to a historical/archived coupon
  const handleSaveEditedPastCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPastCoupon) return;
    setFormLoading(true);
    try {
      const updatedHistory = await dbService.updatePastCoupon({
        ...editingPastCoupon,
        title: editingPastCoupon.title.trim(),
        totalCote: Number(editingPastCoupon.totalCote),
        matches: editingPastCoupon.matches.map((m, idx) => ({
          ...m,
          homeTeam: m.homeTeam.trim(),
          awayTeam: m.awayTeam.trim(),
          prediction: m.prediction.trim(),
          odd: Number(m.odd),
          status: m.status || 'pending'
        }))
      });
      setPastCoupons(updatedHistory);
      setEditingPastCoupon(null);
      showToast("Coupon d'historique modifié et enregistré avec succès ! 💾", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Erreur lors de l'enregistrement de l'historique.", "error");
    } finally {
      setFormLoading(false);
    }
  };

  // Action: Set active coupon result (won / lost / pending)
  const handleSetCouponResult = async (status: 'won' | 'lost' | 'pending') => {
    if (!selectedCouponId) {
      showToast("Sélectionnez d'abord un coupon", "warning");
      return;
    }
    if (!window.confirm("Voulez-vous vraiment mettre à jour le statut de ce coupon ?")) {
      return;
    }
    setFormLoading(true);
    try {
      const data = await dbService.setCouponResult(selectedCouponId, status);
      setCoupons(data.coupons);
      setPastCoupons(data.pastCoupons);
      setCouponEditForm(prev => ({ ...prev, status }));
      showToast("Le coupon a été enregistré à son nouvel état avec succès ! ✅", "success");
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Erreur de connexion.", "error");
    } finally {
      setFormLoading(false);
    }
  };

  // Action: Delete a single history item
  const handleDeleteHistoryItem = async (historyId: string) => {
    if (!window.confirm("Voulez-vous supprimer cette entrée de l'historique ?")) {
      return;
    }
    try {
      const historyData = await dbService.deleteHistoryEntry(historyId);
      setPastCoupons(historyData);
    } catch (e: any) {
      console.warn(e);
      alert(e.message || "Erreur lors de la suppression.");
    }
  };

  // Action: Clear all Coupon History Items
  const handleClearHistory = async () => {
    if (!window.confirm("Voulez-vous vraiment réinitialiser TOUT l'historique des coupons ?")) {
      return;
    }
    try {
      const historyData = await dbService.clearHistory();
      setPastCoupons(historyData);
      alert("L'historique a été réinitialisé.");
    } catch (e: any) {
      console.warn(e);
    }
  };

  // Filter transactions based on active status/subtabs
  const filteredTransactions = transactions.filter((t) => {
    if (isAdminMode) {
      // Admin filter Dépôts vs Retraits
      if (adminTab === 'deposits') {
        if (t.type !== 'deposit') return false;
      } else if (adminTab === 'withdrawals') {
        if (t.type !== 'withdrawal' && t.type !== 'commission_payout') return false;
      } else {
        return false;
      }

      // Filter subtab En attente, Validés, Rejetés
      if (adminSubTab === 'pending') return t.status === 'pending';
      if (adminSubTab === 'validated') return t.status === 'validated';
      if (adminSubTab === 'rejected') return t.status === 'rejected';
    } else {
      // Client views depending on screen
      if (activeTab === 'history') return true;
    }
    return true;
  });

  // Calculate stats for Gains admin view
  const depositTotalVolume = transactions.filter(t => t.type === 'deposit' && t.status === 'validated').reduce((sum, t) => sum + t.amount, 0);
  const withdrawalTotalVolume = transactions.filter(t => t.type === 'withdrawal' && t.status === 'validated').reduce((sum, t) => sum + t.amount, 0);
  const totalCommissionDisbursed = transactions.filter(t => t.type === 'commission_payout' && t.status === 'validated').reduce((sum, t) => sum + t.amount, 0);
  // Platform keeps custom markup or net calculations
  const platformRevenue = Math.max(0, (depositTotalVolume + withdrawalTotalVolume) * 0.05); // Simulated static profit marge of 5%

  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-[#070e20] text-gray-100 flex flex-col font-sans relative shadow-2xl border-x border-slate-800">
      
      {/* Dynamic Toast Notifications */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[340px] flex flex-col gap-2.5 pointer-events-none px-4">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-2xl flex items-start gap-3 border text-xs text-white animate-fade-in transition-all duration-300 ${
              toast.type === 'success' ? 'bg-[#0a2f1d]/95 border-emerald-500/35 text-emerald-100 shadow-emerald-500/5' :
              toast.type === 'error' ? 'bg-[#3b1212]/95 border-rose-500/35 text-rose-100 shadow-rose-500/5' :
              toast.type === 'warning' ? 'bg-[#3b2b0a]/95 border-amber-500/35 text-amber-100 shadow-amber-500/5' :
              'bg-[#0d1b3a]/95 border-blue-500/35 text-blue-100 shadow-blue-500/5'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 size={16} className="text-emerald-400" />}
              {toast.type === 'error' && <XCircle size={16} className="text-rose-400" />}
              {toast.type === 'warning' && <AlertTriangle size={16} className="text-amber-400" />}
              {toast.type === 'info' && <Info size={16} className="text-blue-400" />}
            </div>
            <div className="flex-1 font-semibold leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-gray-400 hover:text-white shrink-0 p-0.5 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* CENTRAL INFORMATION MODAL (POP-UP overlay) */}
      {config.popupEnabled && user && activeTab === 'home' && !isClientPopupDismissed && !isAdminMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070b19]/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121b36] border border-cyan-500/30 rounded-3xl max-w-[360px] w-full p-6 relative shadow-2xl animate-scale-up">
            <button
              onClick={dismissClientPopup}
              type="button"
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white transition-all cursor-pointer"
              title="Fermer"
            >
              <X size={16} />
            </button>

            <div className="text-center mb-4">
              <div className="mx-auto w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mb-3 border border-cyan-500/25 shadow-lg shadow-cyan-500/10">
                <Bell size={24} className="animate-bounce" />
              </div>
              <h3 className="text-base font-extrabold font-display text-gray-100">{config.popupTitle || 'Annonce Spéciale'}</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Message de l'administration</p>
            </div>

            <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800/80 text-center max-h-[180px] overflow-y-auto mb-5">
              <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap">{config.popupMessage || 'Bienvenue sur la plateforme !'}</p>
            </div>

            <button
              onClick={dismissClientPopup}
              type="button"
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-500/15 text-xs text-center cursor-pointer font-sans"
            >
              D'accord, j'ai compris
            </button>
          </div>
        </div>
      )}

      {/* HEADER BAR */}
      <header className="px-5 py-4 bg-[#0d152c] border-b border-cyan-500/10 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
            <Star size={18} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-base font-extrabold font-display tracking-tight bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">StarBetPay</h1>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-gray-400 font-medium font-mono uppercase tracking-widest">1XBET • DÉPÔT & RETRAIT</span>
              {isSupabaseConfigured ? (
                <span className="text-[8px] font-mono tracking-wider text-emerald-400 font-bold bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                  ● CLOUD
                </span>
              ) : useLocalStorageSandbox ? (
                <span className="text-[8px] font-mono tracking-wider text-amber-400 font-bold bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                  ▲ SANDBOX
                </span>
              ) : (
                <span className="text-[8px] font-mono tracking-wider text-cyan-400 font-bold bg-cyan-500/10 px-1 py-0.2 rounded border border-cyan-500/20">
                  ▲ LOCAL
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ADMIN OVERLAY OR ACTIONS HEADER */}
        {user && (
          <div className="flex items-center gap-2">
            {user.role === 'admin' ? (
              <button 
                onClick={() => setIsAdminMode(!isAdminMode)}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all ${
                  isAdminMode 
                    ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20' 
                    : 'bg-slate-800 hover:bg-slate-700 text-cyan-400'
                }`}
              >
                <Shield size={12} />
                {isAdminMode ? 'Admin' : 'Vers Client'}
              </button>
            ) : (
              <span className="text-xs bg-slate-800 text-gray-300 font-semibold px-2.5 py-1 rounded-lg">
                Utilisateur
              </span>
            )}

            <button 
              onClick={handleLogout}
              title="Se déconnecter"
              className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </header>

      {/* BODY WRAPPER */}
      <main className="flex-1 overflow-y-auto px-5 pt-4 pb-24">
        
        {/* IF USER NOT AUTHENTICATED */}
        {!user && (
          <div className="my-auto py-4">
            
            {/* BRAND HERO */}
            <div className="text-center mb-8 mt-4 animate-fade-in">
              <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center text-slate-900 shadow-xl shadow-cyan-500/10 mb-4">
                <Star size={32} fill="currentColor" className="text-slate-950 animate-pulse" />
              </div>
              <h2 className="text-2xl font-extrabold font-display">Bienvenue sur StarBetPay</h2>
              <p className="text-gray-400 text-xs mt-1 px-4 leading-relaxed">
                Effectuez vos dépôts et retraits 1xBet de manière instantanée, sécurisée et gagnez des bonus d'affiliation attractifs.
              </p>
            </div>

            {/* DEMO ACCOUNTS HELPER PRE-AUTH */}
            <div className="bg-gradient-to-br from-[#12213e]/80 to-[#10192e]/80 border border-cyan-500/20 rounded-2xl p-4 mb-6 text-xs text-gray-300">
              <div className="flex items-center gap-2 mb-2 text-cyan-400 font-bold">
                <ShieldAlert size={15} />
                <span>ACCÈS DÉMONSTRATION COMPLET</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-1">Visualisez immédiatement l'application avec les deux comptes :</p>
              <div className="space-y-1 mt-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 font-mono text-[10px] space-y-1">
                <div>🔑 <strong className="text-cyan-400">ADMINISTRATEUR :</strong> Phone: <strong className="text-white">0197656263</strong> | Pass: <strong className="text-white">Azertyui0p</strong></div>
                <div className="pt-1 border-t border-slate-800/60">👤 <strong className="text-cyan-400">CLIENT COMPTE :</strong> Phone: <strong className="text-white">0161616161</strong> | Pass: <strong className="text-white">Password123</strong></div>
              </div>
            </div>

            {/* LOGIN / SIGNUP CARD */}
            {!tempUser ? (
              <div className="bg-[#111a33] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                
                {/* Visual tabs */}
                <div className="grid grid-cols-2 bg-slate-950/50 p-1.5 rounded-xl mb-6">
                  <button 
                    onClick={() => { setAuthTab('login'); setAuthError(''); }}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${authTab === 'login' ? 'bg-[#1b2b52] text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                    Connexion
                  </button>
                  <button 
                    onClick={() => { setAuthTab('register'); setAuthError(''); }}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${authTab === 'register' ? 'bg-[#1b2b52] text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                    Inscription
                  </button>
                </div>

                <form onSubmit={authTab === 'login' ? handleLogin : handleRegister} className="space-y-4">
                  {authTab === 'register' && (
                    <div>
                      <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold mb-1">Nom Complet</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Agbozo"
                        className="w-full bg-[#0d1326] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        value={authForm.name}
                        onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold mb-1">Téléphone</label>
                    <input 
                      type="tel" 
                      placeholder="Ex: 97 00 00 00"
                      className="w-full bg-[#0d1326] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono transition-colors"
                      value={authForm.phone}
                      onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold mb-1">Mot de passe</label>
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      className="w-full bg-[#0d1326] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      required
                    />
                  </div>

                  {authTab === 'register' && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold">Téléphone Parrain (Facultatif)</label>
                        <span className="text-[10px] text-cyan-400 font-mono font-bold">Bonus 1%</span>
                      </div>
                      <input 
                        type="tel" 
                        placeholder="Ex: 0197656263"
                        className="w-full bg-[#0d1326] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono transition-colors"
                        value={authForm.parentPhone}
                        onChange={(e) => setAuthForm({ ...authForm, parentPhone: e.target.value })}
                      />
                    </div>
                  )}

                  {authError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2 text-xs text-red-400">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {authSuccess && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex gap-2 text-xs text-green-400">
                      <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                      <span>{authSuccess}</span>
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-[#070e20] font-bold py-2.5 rounded-xl text-xs transition-colors shadow-lg shadow-cyan-500/15"
                  >
                    {authTab === 'login' ? 'Se connecter' : "S'inscrire"}
                  </button>
                </form>

                <p className="text-center text-[10px] text-gray-400 mt-5 leading-normal">
                  En continuant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité StarBetPay.
                </p>
              </div>
            ) : (
              /* SECURE MULTI-FACTOR AUTHENTICATION COMPONENT SCREEN */
              <div className="bg-[#111a33] border border-cyan-500/20 rounded-3xl p-6 shadow-xl relative animate-fade-in">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-3 border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
                    <Shield size={22} className="animate-pulse" />
                  </div>
                  <h3 className="text-lg font-bold font-display">Double Facteur Sécurisé</h3>
                  <p className="text-gray-300 text-xs mt-1">Authentification Multifacteur (MFA) récurrente active.</p>
                </div>

                <div className="bg-cyan-950/40 rounded-xl p-3 border border-cyan-500/20 text-[11px] text-gray-300 mb-5 leading-relaxed">
                  <p className="font-semibold text-cyan-400">🚨 Code MFA Démonstration :</p>
                  <p className="mt-1">Entrez le code de vérification <strong className="text-white bg-cyan-900 px-1 py-0.5 rounded">1234</strong> ou tout code de votre choix pour passer cette étape de sécurité élevée.</p>
                </div>

                <form onSubmit={handleVerifyMFA} className="space-y-4">
                  <div>
                    <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold mb-1">Code de Vérification MFA</label>
                    <input 
                      type="text" 
                      maxLength={6}
                      placeholder="Ex: 1234"
                      className="w-full bg-[#0d1326] border border-slate-800 rounded-xl px-4 py-3 text-center text-sm font-bold tracking-widest text-[#00f0ff] focus:outline-none focus:border-cyan-500 font-mono"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      required
                    />
                  </div>

                  {authError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2 text-xs text-red-400">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => setTempUser(null)}
                      className="w-1/3 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs"
                    >
                      Retour
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-colors"
                    >
                      Valider le code
                    </button>
                  </div>
                </form>
              </div>
            )}
            
          </div>
        )}

        {/* IF USER COMPLETED LOGIN PROCESS */}
        {user && (
          <div>
            
            {/* PUBLIC BANNER INFO DIALOG */}
            {config.popupEnabled && activeTab === 'home' && !isAdminMode && (
              <div className="bg-gradient-to-r from-blue-950/90 to-cyan-950/80 border border-cyan-500/20 rounded-2xl p-4 mb-5 shadow-lg flex gap-3 relative animate-fade-in">
                <div className="text-cyan-400 shrink-0 mt-0.5">
                  <Info size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white font-display mb-1">{config.popupTitle}</h4>
                  <p className="text-gray-300 text-[11px] leading-relaxed">{config.popupMessage}</p>
                </div>
              </div>
            )}

            {/* PWA INSTALLATION TRIGGER AT TOP FOR RELEVANCE */}
            {activeTab === 'home' && !isAdminMode && (
              <InstallPrompt />
            )}

            {/* ------------------------------------------- */}
            {/* CLIENT VIEW FLOWS */}
            {/* ------------------------------------------- */}
            {!isAdminMode && (
              <div>
                
                {/* 1. HOME TAB */}
                {activeTab === 'home' && (
                  <div className="space-y-5 animate-fade-in">
                    
                    {/* Welcome greeting */}
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-black font-display text-gray-100">Bonjour, {user.name} 👋</h3>
                        <p className="text-xs text-gray-400 font-mono">ID parrainage : {user.phone}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">MFA Sécurisé</span>
                      </div>
                    </div>

                    {/* Active Push notifications enabler banner */}
                    {notificationPermission !== 'granted' && (
                      <div className="bg-gradient-to-r from-purple-950/65 to-violet-950/55 border border-purple-500/25 rounded-3xl p-4 flex flex-col gap-3 text-xs shadow-xl animate-fade-in relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 bg-purple-500/15 text-purple-400 rounded-2xl shrink-0 mt-0.5">
                            <Bell size={18} className="animate-pulse" />
                          </div>
                          <div>
                            <h4 className="font-extrabold font-display text-gray-100 text-xs">Activer les Notifications Push 📱</h4>
                            <p className="text-gray-300 text-[10px] leading-relaxed mt-0.5">
                              Soyez alerté en temps réel du traitement de vos dépôts, retraits et gains d'affiliation, ainsi que de nouveaux coupons, même si l'application est fermée.
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2.5 items-center">
                          {notificationPermission === 'denied' ? (
                            <span className="text-[9px] text-amber-400 font-semibold italic">Bloqué. Activez les notifications dans les réglages de votre navigateur.</span>
                          ) : (
                            <button
                              onClick={requestNotificationPermission}
                              type="button"
                              className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-[10px] transition-all shadow-md shadow-purple-600/25 cursor-pointer"
                            >
                              Activer maintenant
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Affiliated referral program box */}
                    <div className="bg-gradient-to-tr from-[#121c3b] to-[#172754] border border-cyan-500/20 rounded-3xl p-5 relative overflow-hidden shadow-xl">
                      <div className="absolute top-2 right-2 p-1.5 bg-cyan-500/10 text-cyan-400 rounded-full">
                        <Sparkles size={16} />
                      </div>
                      <h4 className="font-extrabold font-display text-sm text-[#00f0ff] mb-1">StarBetPay Parrainage</h4>
                      <p className="text-gray-300 text-[11px] leading-relaxed mb-4">
                        Gagnez <strong className="text-white">1% de commission</strong> sur tous les dépôts et retraits effectués et validés par vos filleuls inscrits grâce à vous !
                      </p>

                      <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800 flex justify-between gap-2.5">
                        <div className="text-center w-1/2">
                          <p className="text-[9px] text-gray-400 uppercase font-bold mb-1">Total Gagné</p>
                          <p className="text-xs font-mono font-bold text-yellow-400">{refStats.balanceCommission + refStats.balanceCommissionWithdrawn} FCFA</p>
                        </div>
                        <div className="w-px bg-slate-800" />
                        <div className="text-center w-1/2">
                          <p className="text-[9px] text-gray-400 uppercase font-bold mb-1">Total Retiré</p>
                          <p className="text-xs font-mono font-bold text-gray-300">{refStats.balanceCommissionWithdrawn} FCFA</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] text-gray-400">Disponible pour retrait</p>
                          <p className="text-lg font-mono font-black text-cyan-400">{refStats.balanceCommission} FCFA</p>
                        </div>
                        <button
                          onClick={handleWithdrawCommissionGains}
                          disabled={refStats.balanceCommission < 2000}
                          className="px-4 py-2 bg-cyan-500 disabled:bg-slate-800 disabled:text-gray-500 hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl text-xs transition-colors shadow-md"
                        >
                          Retirer ces gains
                        </button>
                      </div>

                      <p className="text-[9px] text-gray-400 text-center mt-3 font-medium">
                        * Retrait disponible à partir de 2 000 FCFA minimum
                      </p>
                    </div>

                    {/* Stats referrals count */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#111a33] border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400">
                          <Users size={16} />
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Vos Statisques</p>
                          <p className="text-sm font-extrabold font-mono text-white">{refStats.filleulsCount} Filleul(s) inscrit(s)</p>
                        </div>
                      </div>

                      <div className="bg-[#111a33] border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                          <Wallet size={16} />
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Lien de parrainage</p>
                          <button
                            onClick={() => handleCopyToClipboard(`${window.location.origin}/?ref=${user.phone}`)}
                            className="bg-slate-950 text-cyan-400 hover:text-white border border-slate-800 text-[10px] px-2 py-0.5 rounded mt-1.5 flex items-center gap-1 font-semibold text-center w-full"
                          >
                            <Copy size={10} />
                            Code: {user.phone}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Referral performance analytical visualizer graph (Custom high polishes React SVG Chart) */}
                    <div className="bg-[#111a33] border border-slate-800 rounded-3xl p-5 shadow-xl">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-extrabold font-display text-xs text-gray-200">Suivi Analytique des Gains (Mensuel)</h4>
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                          <TrendingUp size={10} />
                          +12.4%
                        </span>
                      </div>
                      
                      {/* Interactive Visual Graph representation */}
                      <div className="h-28 flex items-end justify-between gap-1 pt-3">
                        {[
                          { m: 'Jan', v: 45 },
                          { m: 'Fév', v: 70 },
                          { m: 'Mar', v: 38 },
                          { m: 'Avr', v: 110 },
                          { m: 'Mai', v: 85 },
                          { m: 'Juin', v: refStats.balanceCommission / 20 || 30 }
                        ].map((idx, index) => (
                          <div key={index} className="flex-1 flex flex-col items-center gap-2">
                            <div className="w-full bg-[#1b2b52] rounded-t-md relative group cursor-pointer" style={{ height: `${Math.min(100, Math.max(15, idx.v))}px` }}>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 bg-slate-950 text-white rounded text-[8px] font-mono px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap shadow-md pointer-events-none">
                                {Math.round(idx.v * 20)} FCFA
                              </div>
                              <div className="absolute inset-0 bg-cyan-400 rounded-t-md opacity-20 group-hover:opacity-60 transition-opacity" />
                            </div>
                            <span className="text-[8px] font-mono text-gray-500">{idx.m}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Fast links buttons list */}
                    <div className="bg-[#111a33]/50 border border-slate-800 rounded-2xl p-4 flex justify-between gap-3 text-center">
                      <button 
                        onClick={() => setActiveTab('deposit')} 
                        className="flex-1 py-2 bg-gradient-to-tr from-cyan-600 to-cyan-500 rounded-xl text-slate-950 font-bold text-xs"
                      >
                        Recharger Compte
                      </button>
                      <button 
                        onClick={() => setActiveTab('withdrawal')} 
                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl"
                      >
                        Demander Retrait
                      </button>
                    </div>

                  </div>
                )}

                {/* 2. DEPOSIT TAB */}
                {activeTab === 'deposit' && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-lg font-black font-display text-gray-100 mb-1">Dépôt sur votre compte 1xBet</h3>
                    
                    <form onSubmit={handleCreateDeposit} className="space-y-4">
                      <div>
                        <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold mb-1">ID du compte à recharger</label>
                        <input 
                          type="text" 
                          placeholder="Ex: 31354567"
                          className="w-full bg-[#111a33] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white"
                          value={depositForm.xbetAccount}
                          onChange={(e) => setDepositForm({ ...depositForm, xbetAccount: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold mb-1">Montant (FCFA)</label>
                        <input 
                          type="number" 
                          placeholder="Minimum 500 FCFA"
                          className="w-full bg-[#111a33] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white"
                          value={depositForm.amount}
                          onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold mb-2">Moyen de paiement</label>
                        
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {paymentMethods.filter(p => p.active).map((pm) => (
                            <button
                              key={pm.name}
                              type="button"
                              onClick={() => setDepositForm({ ...depositForm, paymentMethod: pm.name })}
                              className={`py-2 p-3 rounded-xl text-xs font-extrabold flex items-center justify-center border transition-all ${
                                depositForm.paymentMethod === pm.name
                                  ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                                  : 'bg-[#111a33] border-slate-800 text-gray-300 hover:border-slate-700'
                              }`}
                            >
                              {pm.name}
                            </button>
                          ))}
                        </div>

                        {/* Instructions detail box context */}
                        {depositForm.paymentMethod && (
                          <div className="bg-[#12213e] rounded-xl p-4 border border-cyan-500/20 mb-4 animate-fade-in">
                            <h4 className="text-[10px] text-cyan-400 uppercase font-bold mb-1">Instructions de paiement</h4>
                            <p className="text-gray-300 text-xs mt-1">Faites un dépôt compte à compte sur le numéro suivant :</p>
                            
                            <div className="flex items-center justify-between text-base font-extrabold font-mono text-cyan-400 mt-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                              <span>
                                {paymentMethods.find(p => p.name === depositForm.paymentMethod)?.number || 'Non configuré'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyToClipboard(paymentMethods.find(p => p.name === depositForm.paymentMethod)?.number || '')}
                                className="flex items-center gap-1 text-[10px] bg-slate-800 text-cyan-400 border border-slate-700 px-2 py-1 rounded"
                              >
                                {copiedText === paymentMethods.find(p => p.name === depositForm.paymentMethod)?.number ? (
                                  <>
                                    <Check size={10} />
                                    Copié
                                  </>
                                ) : (
                                  <>
                                    <Copy size={10} />
                                    Copier
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Receipt capture screenshot upload */}
                      <div>
                        <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold mb-2">Capture d'écran du reçu de transfert</label>
                        
                        <div className="bg-[#111a33] border-2 border-dashed border-slate-800 rounded-2xl p-5 text-center cursor-pointer relative hover:border-slate-700 transition-colors">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          
                          {screenshotBase64 ? (
                            <div className="space-y-2">
                              <img src={screenshotBase64} className="h-24 mx-auto object-contain rounded" alt="Mock ticket" />
                              <p className="text-xs text-emerald-400 truncate">Image enregistrée avec succès</p>
                              <button 
                                type="button" 
                                onClick={() => setScreenshotBase64('')}
                                className="text-[10px] text-red-400 underline font-semibold"
                              >
                                Supprimer
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="w-10 h-10 bg-[#1b2b52] rounded-xl flex items-center justify-center mx-auto text-cyan-400">
                                <Upload size={18} />
                              </div>
                              <p className="font-extrabold text-[#00f0ff] text-xs">Cliquez pour choisir votre capture d'écran</p>
                              <p className="text-[10px] text-gray-400">Format d'image standard pris en charge</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {formMsg && (
                        <div className={`p-3.5 rounded-xl border flex gap-2 text-xs font-medium ${
                          formMsg.type === 'success' 
                            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}>
                          {formMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                          <span>{formMsg.text}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={formLoading}
                        className="w-full bg-cyan-500 hover:bg-cyan-400 text-[#070e20] font-bold py-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/15"
                      >
                        {formLoading ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            Traitement...
                          </>
                        ) : (
                          <>
                            Valider l'opération
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* 3. PRONOS TAB */}
                {activeTab === 'pronos' && (() => {
                  const normalizeToISODate = (dateStr?: string): string => {
                    if (!dateStr) return '';
                    const firstPart = dateStr.trim().split(' ')[0];
                    if (firstPart.includes('/')) {
                      const parts = firstPart.split('/');
                      if (parts.length === 3) {
                        let day = parts[0];
                        let month = parts[1];
                        let year = parts[2];
                        if (year.length === 2) year = '20' + year;
                        day = day.padStart(2, '0');
                        month = month.padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      }
                    }
                    try {
                      const d = new Date(dateStr || '');
                      if (!isNaN(d.getTime())) {
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      }
                    } catch (e) {}
                    return firstPart;
                  };

                  const todayObj = new Date();
                  const todayYear = todayObj.getFullYear();
                  const todayMonth = String(todayObj.getMonth() + 1).padStart(2, '0');
                  const todayDay = String(todayObj.getDate()).padStart(2, '0');
                  const normalizedToday = `${todayYear}-${todayMonth}-${todayDay}`;

                  const userTodayDeposits = transactions
                    .filter(t => {
                      if (t.type !== 'deposit' || t.status !== 'validated') return false;
                      const txDate = normalizeToISODate(t.date);
                      return txDate === normalizedToday;
                    })
                    .reduce((sum, t) => sum + t.amount, 0);

                  const hasPremiumAccess = userTodayDeposits >= 1000 || user?.role === 'admin';

                  const totalPastCount = pastCoupons.length;
                  const wonPastCount = pastCoupons.filter(c => c.status === 'won').length;
                  const successRate = totalPastCount > 0 ? Math.round((wonPastCount / totalPastCount) * 100) : 85;

                  // Order coupons so Cote 2 (secured) is on top, then Cote 5 (medium), then Cote 10 (bold)
                  const sortOrder = { 'secured': 1, 'medium': 2, 'bold': 3 };
                  const sortedCoupons = [...coupons].sort((a, b) => {
                    const orderA = sortOrder[a.id as keyof typeof sortOrder] || 99;
                    const orderB = sortOrder[b.id as keyof typeof sortOrder] || 99;
                    return orderA - orderB;
                  });

                  const availableCoupons = sortedCoupons.filter(c => {
                    if (!c.matches || c.matches.length === 0) return false;
                    if (!c.date) return false;
                    const normalizedCouponDate = normalizeToISODate(c.date);
                    return normalizedCouponDate === normalizedToday;
                  });

                  return (
                    <div className="space-y-5 animate-fade-in">
                      
                      {/* Header */}
                      <div>
                        <h3 className="text-lg font-black font-display text-gray-100">Pronostics Professionnels</h3>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                          <TrendingUp size={11} className="text-cyan-400 animate-pulse" />
                          Sélection quotidienne de coupons à très haute probabilité.
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded ml-auto">Précision Maximale</span>
                        </p>
                      </div>

                      {/* Category-specific stats segment */}
                      <div className="grid grid-cols-3 gap-2 px-0.5">
                        {[
                          { id: 'secured', name: 'Côte 2 Sécurisé', color: 'cyan', rate: 92 },
                          { id: 'medium', name: 'Côte 5 Médium', color: 'amber', rate: 82 },
                          { id: 'bold', name: 'Côte 10 Audacieux', color: 'pink', rate: 75 }
                        ].map((cat) => {
                          const catPast = pastCoupons.filter(c => c.id.startsWith(cat.id) || (cat.id === 'secured' && c.totalCote < 3.5) || (cat.id === 'medium' && c.totalCote >= 3.5 && c.totalCote < 7.5) || (cat.id === 'bold' && c.totalCote >= 7.5));
                          const total = catPast.length;
                          const won = catPast.filter(c => c.status === 'won').length;
                          const rateOfCat = total > 0 ? Math.round((won / total) * 100) : cat.rate;

                          return (
                            <div key={cat.id} className="bg-[#111a33]/80 border border-slate-800 rounded-2xl p-2.5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg">
                              <div>
                                <span className={`text-[8px] font-black uppercase tracking-wider ${
                                  cat.id === 'secured' ? 'text-cyan-400' : cat.id === 'medium' ? 'text-amber-400' : 'text-pink-400'
                                }`}>
                                  {cat.name}
                                </span>
                                <div className="text-lg font-mono font-black text-white mt-1">{rateOfCat}%</div>
                                <span className="text-[8px] text-gray-500 block">Réussite</span>
                              </div>
                              <span className="text-[8px] font-semibold text-gray-400 mt-2 font-mono bg-black/30 py-0.5 px-1.5 rounded text-center block w-full whitespace-nowrap">
                                {won} Gagnés / {total} Total
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* 1XBET PARTNER PROMO BLOCK */}
                      <div className="bg-gradient-to-b from-[#111e3b] to-[#0a1125] border border-cyan-500/20 rounded-3xl p-4 md:p-5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#00f0ff]/5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>
                        
                        <div className="flex items-center gap-2 mb-3 bg-[#0a1125]/80 py-1.5 px-3 rounded-full border border-slate-800 self-start w-fit">
                          <span className="animate-pulse w-2 h-2 rounded-full bg-emerald-400"></span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Offre Partenaire Exclusive 1xBet 🎁</span>
                        </div>

                        {/* YouTube Style Banner image */}
                        <div className="relative group overflow-hidden rounded-2xl border border-slate-800 shadow-xl aspect-video w-full mb-4">
                          <img 
                            src={promoStarrio} 
                            alt="1xBet Code Promo STARRIO" 
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
                          
                          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                            <div>
                              <div className="text-[10px] text-gray-300 font-medium">StarBetPay Partenariat</div>
                              <div className="text-sm font-black text-white font-display tracking-tight leading-none mt-0.5">Code Promo STARRIO</div>
                            </div>
                            <span className="bg-cyan-500 text-slate-950 text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider leading-none shadow-lg shadow-cyan-500/20">
                              +200% Bonus
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3.5">
                          <p className="text-gray-300 text-[11px] leading-relaxed">
                            Créez votre compte dès aujourd'hui sur <strong className="text-white">1xBet</strong> en saisissant le code officiel de parrainage <strong className="text-white text-base font-mono font-black mx-1 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">STARRIO</strong> pour débloquer automatiquement un bonus exceptionnel de <strong className="text-emerald-400 font-extrabold text-xs bg-emerald-500/5 py-1 px-1.5 rounded">+200% sur votre tout premier dépôt</strong> !
                          </p>

                          {/* Code Copy Box */}
                          <div className="flex items-center justify-between gap-2.5 bg-[#070b19] border border-slate-800 rounded-2xl p-2.5">
                            <div className="pl-1.5">
                              <span className="text-[8px] text-gray-500 uppercase tracking-widest font-black block">Code Promo à Insérer</span>
                              <span className="text-sm font-black font-mono tracking-wider text-cyan-400">STARRIO</span>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText('STARRIO');
                                setCopiedPromo(true);
                                showToast('Code promo "STARRIO" copié avec succès ! 📋', 'success');
                                setTimeout(() => setCopiedPromo(false), 2000);
                              }}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                                copiedPromo 
                                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                                  : 'bg-[#121c38] border border-slate-700 text-gray-300 hover:text-white hover:border-slate-500 active:scale-95'
                              }`}
                            >
                              {copiedPromo ? (
                                <>
                                  <Check size={12} className="text-emerald-400" />
                                  <span>Copié !</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copier le code</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Registration Redirect Button */}
                          <a
                            href="https://reffpa.com/L?tag=d_1151631m_97c_&site=1151631&ad=97&r=registration/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold font-display text-xs uppercase tracking-wider py-3.5 px-4 rounded-2xl text-center shadow-lg shadow-emerald-900/40 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <span>Créer un compte 1xBet</span>
                            <ArrowUpRight size={14} className="animate-pulse" />
                          </a>
                        </div>
                      </div>

                      {/* Coupons du Jour list */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                          <span className="font-extrabold font-display text-xs uppercase tracking-wider text-gray-300">Coupons du Jour 🔥</span>
                          <span className="text-[10px] text-cyan-400 font-bold bg-[#111a33] px-2 py-0.5 rounded border border-slate-800">Cote 2 public • Côte 5 & 10 privés</span>
                        </div>

                        {availableCoupons.length === 0 ? (
                          <div className="bg-[#111a33]/90 border border-cyan-500/20 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden animate-fade-in max-w-sm mx-auto">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl"></div>
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00f0ff]/5 rounded-full blur-3xl"></div>
                            <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center text-cyan-400 mx-auto mb-4 border border-cyan-500/20 shadow-inner">
                              <Bell size={20} className="animate-pulse" />
                            </div>
                            <h4 className="text-white font-extrabold text-xs uppercase tracking-wider font-display">Coupons du jour indisponibles</h4>
                            <p className="text-gray-300 text-[11px] leading-relaxed max-w-xs mx-auto mt-2 font-sans">
                              Les coupons de la journée seront disponibles dans un instant. Veuillez patienter, vous serez notifié une fois publiés.
                            </p>
                          </div>
                        ) : (
                          availableCoupons.map((coupon) => {
                            const isPremium = coupon.id !== 'secured';
                            const isLocked = isPremium && !hasPremiumAccess;

                            if (isLocked) {
                              return (
                                <div key={coupon.id} className="bg-gradient-to-b from-[#111c38] to-[#0c1224] border border-cyan-500/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                                  <div className="absolute inset-0 bg-[#070d1e]/95 backdrop-blur-[4px] flex flex-col justify-center items-center text-center p-4 z-10">
                                    <div className="w-10 h-10 bg-cyan-500/10 rounded-full flex items-center justify-center text-cyan-400 mb-2 border border-cyan-500/20">
                                      <Shield size={18} />
                                    </div>
                                    <h3 className="text-white font-extrabold text-xs uppercase tracking-wider">{coupon.title}</h3>
                                    <p className="text-gray-300 text-[10px] leading-relaxed max-w-xs mt-1.5 font-sans">
                                      Ce coupon est réservé uniquement aux abonnés ayant cumulé ou fait un dépôt minimum validé d'au moins <strong className="text-cyan-400">1 000 FCFA dans la journée</strong>.
                                    </p>
                                    <div className="mt-2 text-[10px] bg-slate-950/60 border border-slate-800 px-3 py-1 rounded max-w-[240px]">
                                      Cumul déposé aujourd'hui : <strong className="text-yellow-400">{userTodayDeposits} FCFA</strong>
                                    </div>
                                    <button 
                                      onClick={() => setActiveTab('deposit')}
                                      className="mt-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[10px] font-black px-4 py-2 rounded-xl transition-all font-display uppercase tracking-wider inline-flex items-center gap-1.5"
                                    >
                                      Faire un dépôt pour débloquer
                                      <ArrowUpRight size={12} />
                                    </button>
                                  </div>
                                  <div className="opacity-15 pointer-events-none select-none blur-[2px]">
                                    <div className="flex justify-between items-center mb-3">
                                      <div>
                                        <span className="text-[10px] font-bold font-mono text-cyan-400">{coupon.title}</span>
                                        <div className="text-[9px] text-gray-400 uppercase mt-0.5">Confiance : <strong className="text-cyan-300">{coupon.confidence}</strong></div>
                                      </div>
                                      <span className="text-xs font-mono font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">Cote: {coupon.totalCote.toFixed(2)}</span>
                                    </div>
                                    <div className="space-y-2 pt-1 border-t border-slate-800/40">
                                      <div className="flex justify-between text-[11px] text-gray-300">
                                        <span>Équipe A vs Équipe B</span>
                                        <span>Cote: 1.80</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={coupon.id} className="bg-gradient-to-b from-[#111c38] to-[#0c1224] border border-cyan-500/10 rounded-2xl p-4 shadow-md relative">
                                {coupon.status && coupon.status !== 'pending' && (
                                  <span className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded ${
                                    coupon.status === 'won' 
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                      : 'bg-red-500/20 text-red-500 border border-red-500/30'
                                  }`}>
                                    {coupon.status === 'won' ? 'GAGNÉ ✓' : 'PERDU ✗'}
                                  </span>
                                )}
                                <div className="flex justify-between items-center mb-3">
                                  <div>
                                    <span className="text-[10px] font-bold font-mono text-cyan-400">{coupon.title}</span>
                                    <div className="text-[9px] text-gray-400 uppercase mt-0.5">Confiance : <strong className="text-cyan-300">{coupon.confidence}</strong></div>
                                  </div>
                                  <span className="text-xs font-mono font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg mr-16">Cote: {coupon.totalCote.toFixed(2)}</span>
                                </div>

                                {/* Football matches lists inside coupon block */}
                                <div className="space-y-2.5 pt-1.5 border-t border-slate-800/40">
                                  {coupon.matches.map((item, index) => (
                                    <div key={index} className="flex gap-2.5 text-xs">
                                      <div className="text-[#00f0ff] font-mono select-none text-[11px] font-bold">{index+1}</div>
                                      <div className="flex-1">
                                        <div className="flex justify-between text-gray-100 font-semibold text-[11px]">
                                          <span>{item.homeTeam} vs {item.awayTeam}</span>
                                          <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                            <span className="text-gray-400">Cote: {item.odd.toFixed(2)}</span>
                                            {item.status === 'won' && (
                                              <span className="text-[8px] bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 font-bold px-1 py-[1px] rounded font-sans">✓ GAGNÉ</span>
                                            )}
                                            {item.status === 'lost' && (
                                              <span className="text-[8px] bg-red-500/15 border border-red-500/20 text-red-400 font-bold px-1 py-[1px] rounded font-sans">✗ PERDU</span>
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-gray-400 text-[10px] italic mt-0.5">{item.prediction}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Historical past coupons */}
                      <div className="space-y-3">
                        <h4 className="font-extrabold font-display text-xs text-gray-300 mb-2 px-1 flex items-center justify-between">
                          <span>Historique de Validation</span>
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">Vérifié</span>
                        </h4>
                        
                        {pastCoupons.length === 0 ? (
                          <div className="bg-[#111a33]/50 border border-slate-800 rounded-2xl p-4 text-center text-[11px] text-gray-400">
                            Aucun historique de coupon archivé pour le moment.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {pastCoupons.slice(0, 5).map((coup, idx) => (
                              <div key={coup.id || idx} className="bg-gradient-to-b from-[#111c38]/40 to-[#0c1224]/30 border border-slate-800/80 rounded-2xl p-4">
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800/40">
                                  <div>
                                    <span className="text-[10px] font-extrabold text-gray-200 block">{coup.title}</span>
                                    <span className="text-[9px] text-gray-500 font-mono">{coup.date || 'Archives'}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-gray-300 bg-slate-800/80 px-2 py-0.5 rounded">Cote {coup.totalCote.toFixed(2)}</span>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                                      coup.status === 'won' 
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                        : coup.status === 'lost'
                                          ? 'bg-red-500/15 text-red-500 border border-red-500/25'
                                          : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 font-black uppercase'
                                    }`}>
                                      {coup.status === 'won' ? 'GAGNÉ ✓' : coup.status === 'lost' ? 'PERDU ✗' : 'EN COURS ⏳'}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-1.5 opacity-80">
                                  {coup.matches.map((item, matchIdx) => (
                                    <div key={matchIdx} className="flex justify-between items-center text-[10px]">
                                      <span className="text-gray-300">{item.homeTeam} vs {item.awayTeam}</span>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-gray-400 italic">{item.prediction} (Cote : {item.odd.toFixed(2)})</span>
                                        {item.status === 'won' && <span className="text-[8px] text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">✓</span>}
                                        {item.status === 'lost' && <span className="text-[8px] text-red-500 font-bold bg-red-500/10 px-1 rounded font-sans">✗</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })()}

                {/* 4. WITHDRAWAL TAB */}
                {activeTab === 'withdrawal' && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-lg font-black font-display text-gray-100 mb-1">Formulaire de retrait</h3>

                    {/* Physical withdrawal notice */}
                    <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 border border-yellow-500/30 rounded-2xl p-4 flex gap-3">
                      <div className="text-yellow-400 shrink-0 mt-0.5">
                        <AlertTriangle size={18} />
                      </div>
                      <div className="text-sm">
                        <h4 className="font-extrabold text-xs text-yellow-300">Avis important de retrait</h4>
                        <p className="text-gray-300 text-[11px] leading-relaxed mt-1">
                          Veuillez envoyer les retraits sur l'adresse suivante :
                        </p>
                        <p className="text-[#00f0ff] text-xs font-semibold font-display mt-0.5">
                          Ville : {config.withdrawalPhysVille} ; Rue : {config.withdrawalPhysRue}
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleCreateWithdrawal} className="space-y-4">
                      <div>
                        <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold mb-1">Montant du retrait (FCFA)</label>
                        <input 
                          type="number" 
                          placeholder="Ex: 5000"
                          className="w-full bg-[#111a33] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                          value={withdrawalForm.amount}
                          onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold mb-1">Code de retrait 1xBet</label>
                        <input 
                          type="text" 
                          maxLength={4}
                          placeholder="Entrer le code (4 caract. max)"
                          className="w-full bg-[#111a33] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono tracking-widest text-[#00f0ff]"
                          value={withdrawalForm.withdrawCode}
                          onChange={(e) => setWithdrawalForm({ ...withdrawalForm, withdrawCode: e.target.value.toUpperCase() })}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold mb-2">Recevoir sur (Moyen de paiement)</label>
                        
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {paymentMethods.filter(p => p.active).map((pm) => (
                            <button
                              key={pm.name}
                              type="button"
                              onClick={() => setWithdrawalForm({ ...withdrawalForm, paymentMethod: pm.name })}
                              className={`py-2 p-3 rounded-xl text-xs font-bold border transition-all ${
                                withdrawalForm.paymentMethod === pm.name
                                  ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md'
                                  : 'bg-[#111a33] border-slate-800 text-gray-300 hover:border-slate-705'
                              }`}
                            >
                              {pm.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {withdrawalForm.paymentMethod && (
                        <div>
                          <label className="block text-gray-400 text-[11px] uppercase tracking-wider font-semibold mb-1">Numéro de paiement ({withdrawalForm.paymentMethod})</label>
                          <input 
                            type="text" 
                            placeholder="Numéro pour recevoir l'argent"
                            className="w-full bg-[#111a33] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white"
                            value={withdrawalForm.paymentNumber}
                            onChange={(e) => setWithdrawalForm({ ...withdrawalForm, paymentNumber: e.target.value })}
                            required
                          />
                        </div>
                      )}

                      {formMsg && (
                        <div className={`p-3.5 rounded-xl border flex gap-2 text-xs font-medium ${
                          formMsg.type === 'success' 
                            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}>
                          {formMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                          <span>{formMsg.text}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={formLoading}
                        className="w-full bg-cyan-500 hover:bg-cyan-400 text-[#070e20] font-bold py-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/15"
                      >
                        {formLoading ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            Validation...
                          </>
                        ) : (
                          <>Valider l'opération</>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* 5. HISTORY TAB */}
                {activeTab === 'history' && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-lg font-black font-display text-gray-100">Historique de vos opérations</h3>
                    
                    {transactions.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 text-xs border border-dashed border-slate-800 rounded-2xl">
                        Aucun historique disponible pour l'instant.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {transactions.map((tx) => (
                          <div 
                            key={tx.id} 
                            className="bg-[#111a33] border border-slate-800 rounded-2xl p-4 flex justify-between items-start"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                                  tx.type === 'deposit' 
                                    ? 'bg-cyan-500/10 text-cyan-400' 
                                    : tx.type === 'withdrawal'
                                      ? 'bg-pink-500/10 text-pink-400'
                                      : 'bg-yellow-500/10 text-yellow-500'
                                }`}>
                                  {tx.type === 'deposit' ? 'Dépôt' : tx.type === 'withdrawal' ? 'Retrait' : 'Gain Ref'}
                                </span>
                                <span className="text-[10px] font-mono text-gray-500">ID: {tx.id.replace('TX_', '')}</span>
                              </div>

                              <p className="text-sm font-extrabold font-mono mt-2 text-white">{tx.amount.toLocaleString('en-US')} FCFA</p>
                              <p className="text-[10px] text-gray-500 mt-1">{tx.date}</p>
                              
                              {tx.rejectionReason && (
                                <p className="text-[10px] text-red-400 bg-red-400/5 p-1.5 rounded border border-red-400/10 mt-1.5 leading-normal">
                                  <strong>Rejet :</strong> {tx.rejectionReason}
                                </p>
                              )}
                            </div>

                            <div className="text-right">
                              <span className={`text-xs font-bold px-3 py-1 rounded-lg ${
                                tx.status === 'pending'
                                  ? 'bg-yellow-500/10 text-yellow-400'
                                  : tx.status === 'validated'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-red-500/10 text-red-500'
                              }`}>
                                {tx.status === 'pending' ? 'En attente' : tx.status === 'validated' ? 'Réussi' : 'Rejeté'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}


            {/* ------------------------------------------- */}
            {/* ADMINISTRATION DASHBOARD VIEW */}
            {/* ------------------------------------------- */}
            {isAdminMode && (
              <div className="space-y-5 animate-fade-in">
                
                {/* Header title */}
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black font-display text-gray-100">Administration</h3>
                    <p className="text-[10px] text-gray-400 tracking-wider">Gérer les opérations et la configuration.</p>
                  </div>
                </div>

                {/* Sub-tabs admin choices */}
                <div className="flex gap-1.5 bg-slate-950/60 p-1 rounded-xl overflow-x-auto text-[11px] font-extrabold scrollbar-none">
                  {[
                    { id: 'stats', label: 'Statistiques' },
                    { id: 'deposits', label: 'Dépôts' },
                    { id: 'withdrawals', label: 'Retraits' },
                    { id: 'pronos', label: 'Pronos' },
                    { id: 'config', label: 'Config' },
                    { id: 'users', label: 'Utilisateurs' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setAdminTab(tab.id as any)}
                      className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap outline-none ${
                        adminTab === tab.id
                          ? 'bg-[#1b2b52] text-white shadow-md'
                          : 'text-gray-450 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* REAL-TIME AUDITORY & VISUAL ALERTS CONTAINER */}
                {adminNotifications.length > 0 && adminTab === 'deposits' && (
                  <div className="bg-gradient-to-r from-amber-600/10 to-transparent border border-amber-500/30 rounded-2xl p-4 animate-pulse">
                    <div className="flex items-center gap-2.5 text-amber-300 font-bold text-xs mb-2">
                      <Bell size={15} />
                      <span>{adminNotifications.length} Nouvelle(s) demande(s) en temps réel !</span>
                      <button 
                        onClick={() => setAdminNotifications([])}
                        className="ml-auto text-[10px] underline hover:text-white"
                      >
                        Masquer
                      </button>
                    </div>
                    <div className="text-[11px] space-y-1.5 text-gray-300">
                      {adminNotifications.slice(0, 2).map((item, id) => (
                        <div key={id} className="flex justify-between items-center bg-black/30 p-1.5 rounded border border-slate-800">
                          <span>👤 {item.userName} ({item.paymentMethod})</span>
                          <span className="font-mono text-cyan-400 font-semibold">+{item.amount} F</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SUB TAB CONTROLS (Only for Deposits and Withdrawals table) */}
                {(adminTab === 'deposits' || adminTab === 'withdrawals') && (
                  <div className="flex gap-2 text-xs font-semibold">
                    {[
                      { id: 'pending', label: 'En attente' },
                      { id: 'validated', label: 'Validés' },
                      { id: 'rejected', label: 'Rejetés' }
                    ].map((st) => (
                      <button
                        key={st.id}
                        onClick={() => setAdminSubTab(st.id as any)}
                        className={`flex-1 py-1.5 rounded-lg text-center font-bold tracking-tight border transition-all ${
                          adminSubTab === st.id
                            ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                            : 'bg-slate-950/20 border-slate-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* 1. ADMINISTRATION: DEPOSITS TABLE CARD LIST */}
                {adminTab === 'deposits' && (
                  <div className="space-y-4">
                    {filteredTransactions.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 text-xs border border-dashed border-slate-800 rounded-3xl">
                        Aucun élément dans cette catégorie.
                      </div>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const isExpanded = !!expandedTxIds[tx.id];
                        return (
                          <div key={tx.id} className="bg-[#111a33] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg transition-all">
                            {/* COLLAPSIBLE HEADER CARD */}
                            <div 
                              onClick={() => setExpandedTxIds(prev => ({ ...prev, [tx.id]: !prev[tx.id] }))}
                              className="flex justify-between items-center cursor-pointer select-none"
                            >
                              <div>
                                <p className="text-base font-extrabold font-mono text-[#00f0ff]">{tx.amount.toLocaleString()} FCFA</p>
                                <p className="text-[11px] font-semibold text-gray-300 mt-0.5">{tx.userName} • {tx.userPhone}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 font-mono">{tx.date}</span>
                                <ChevronDown 
                                  size={16} 
                                  className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} 
                                />
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="space-y-3 pt-3 border-t border-slate-800/60 animate-fade-in">
                                <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 text-[11px] text-gray-300 space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Moyen de paiement:</span>
                                    <span className="font-bold text-white">{tx.paymentMethod}</span>
                                  </div>
                                  {tx.paymentNumber && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Envoyé sur le numéro:</span>
                                      <span className="font-mono text-cyan-300">{tx.paymentNumber}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500">ID COMPTE 1XBET:</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-yellow-400 font-bold">{tx.xbetAccount}</span>
                                      <button 
                                        onClick={() => handleCopyToClipboard(tx.xbetAccount)}
                                        className="text-[9px] text-cyan-400 hover:text-white px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded flex items-center gap-1 font-bold"
                                      >
                                        {copiedText === tx.xbetAccount ? (
                                          <>
                                            <Check size={10} className="text-emerald-400" />
                                            <span className="text-emerald-400">Copié !</span>
                                          </>
                                        ) : (
                                          'Copier'
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Render Screenshot Receipt if uploaded */}
                                {tx.screenshot ? (
                                  <div className="space-y-2">
                                    <span className="text-[10px] text-gray-500 tracking-wider font-semibold uppercase block">Capture d'écran envoyée</span>
                                    <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 max-h-48 flex items-center justify-center">
                                      <img src={tx.screenshot} className="max-h-48 object-contain rounded-xl" alt="Ticket client" />
                                      <button
                                        onClick={() => setActiveReceiptLightbox(tx.screenshot || null)}
                                        className="absolute inset-x-0 bottom-0 bg-slate-950/70 p-2 flex items-center justify-center text-[10px] font-bold text-cyan-400 gap-1"
                                      >
                                        <Eye size={12} />
                                        Agrandir la capture
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-amber-500 bg-amber-500/10 p-2 rounded">Aucune capture d'écran fournie par l'utilisateur.</p>
                                )}

                                {/* Reject comment display if validated / rejected */}
                                {tx.status === 'rejected' && tx.rejectionReason && (
                                  <p className="text-xs text-red-400 p-2 bg-red-500/5 rounded border border-red-500/10">
                                    <strong>Raison du rejet :</strong> {tx.rejectionReason}
                                  </p>
                                )}

                                {/* Approval Controls */}
                                <div className="space-y-3 pt-2.5 border-t border-slate-800/40">
                                  {tx.status === 'pending' && (
                                    <div className="space-y-2.5">
                                      <input 
                                        type="text" 
                                        placeholder="Motif du rejet (Obligatoire pour annuler)"
                                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500"
                                        value={adminRejectedReason[tx.id] || ''}
                                        onChange={(e) => setAdminRejectedReason({ ...adminRejectedReason, [tx.id]: e.target.value })}
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleAdminUpdateStatus(tx.id, 'rejected')}
                                          className="w-1/2 py-2 border border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs font-bold rounded-xl transition-all"
                                        >
                                          Annuler / Refuser
                                        </button>
                                        <button
                                          onClick={() => handleAdminUpdateStatus(tx.id, 'validated')}
                                          className="w-1/2 py-2 bg-gradient-to-tr from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 text-xs font-black rounded-xl shadow-md transition-all"
                                        >
                                          Valider le dépôt
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {tx.status === 'validated' && (
                                    <div className="space-y-2.5">
                                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/20 px-2 py-1 rounded block w-fit">
                                        ✓ Opération Validée
                                      </span>
                                      <input 
                                        type="text" 
                                        placeholder="Motif d'annulation de force (Saisir si vous annulez)"
                                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500"
                                        value={adminRejectedReason[tx.id] || ''}
                                        onChange={(e) => setAdminRejectedReason({ ...adminRejectedReason, [tx.id]: e.target.value })}
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleAdminUpdateStatus(tx.id, 'pending')}
                                          className="w-1/2 py-1.5 border border-slate-700 hover:bg-slate-800 text-xs text-gray-300 font-bold rounded-xl transition-all"
                                          title="Remettre cette opération à l'état en attente de vérification"
                                        >
                                          Remettre En attente
                                        </button>
                                        <button
                                          onClick={() => handleAdminUpdateStatus(tx.id, 'rejected')}
                                          className="w-1/2 py-1.5 bg-red-950/50 hover:bg-red-900/60 border border-red-500/30 text-xs text-red-400 font-bold rounded-xl transition-all"
                                        >
                                          Annuler de force
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {tx.status === 'rejected' && (
                                    <div className="space-y-2.5">
                                      <span className="text-[10px] text-red-400 font-bold bg-red-500/15 border border-red-500/20 px-2 py-1 rounded block w-fit">
                                        ✗ Opération Annulée / Rejetée
                                      </span>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleAdminUpdateStatus(tx.id, 'pending')}
                                          className="w-1/2 py-1.5 border border-slate-700 hover:bg-slate-800 text-xs text-gray-300 font-bold rounded-xl transition-all"
                                        >
                                          Rétablir l'opération
                                        </button>
                                        <button
                                          onClick={() => handleAdminUpdateStatus(tx.id, 'validated')}
                                          className="w-1/2 py-1.5 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/30 text-xs text-cyan-400 font-bold rounded-xl transition-all"
                                        >
                                          Rétablir et Valider
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 2. ADMINISTRATION: WITHDRAWALS TABLE CARD LIST */}
                {adminTab === 'withdrawals' && (
                  <div className="space-y-4">
                    {filteredTransactions.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 text-xs border border-dashed border-slate-800 rounded-3xl">
                        Aucun retrait trouvé dans cette catégorie.
                      </div>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const isExpanded = !!expandedTxIds[tx.id];
                        return (
                          <div key={tx.id} className="bg-[#111a33] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg transition-all">
                            {/* COLLAPSIBLE HEADER CARD */}
                            <div 
                              onClick={() => setExpandedTxIds(prev => ({ ...prev, [tx.id]: !prev[tx.id] }))}
                              className="flex justify-between items-center cursor-pointer select-none"
                            >
                              <div>
                                <p className="text-base font-extrabold font-mono text-pink-400">{tx.amount.toLocaleString()} FCFA</p>
                                <p className="text-[11px] font-semibold text-gray-300 mt-0.5">{tx.userName} • {tx.userPhone}</p>
                                {tx.type === 'commission_payout' && (
                                  <span className="text-[9px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded mt-1.5 block w-fit">Retrait de Commission</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 font-mono">{tx.date}</span>
                                <ChevronDown 
                                  size={16} 
                                  className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} 
                                />
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="space-y-3 pt-3 border-t border-slate-800/60 animate-fade-in">
                                <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 text-[11px] text-gray-300 space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Recevoir sur:</span>
                                    <span className="font-bold text-white">{tx.paymentMethod}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Numéro destinataire:</span>
                                    <span className="font-mono text-cyan-300 font-bold">{tx.paymentNumber}</span>
                                  </div>
                                  {tx.withdrawCode && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Code de retrait 1xBet:</span>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono text-[#00f0ff] font-black">{tx.withdrawCode}</span>
                                        <button 
                                          onClick={() => handleCopyToClipboard(tx.withdrawCode || '')}
                                          className="text-[9px] text-cyan-400 hover:text-white px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded flex items-center gap-1 font-bold"
                                        >
                                          {copiedText === tx.withdrawCode ? (
                                            <>
                                              <Check size={10} className="text-emerald-400" />
                                              <span className="text-emerald-400">Copié !</span>
                                            </>
                                          ) : (
                                            'Copier'
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Reject comment display if validated / rejected */}
                                {tx.status === 'rejected' && tx.rejectionReason && (
                                  <p className="text-xs text-red-300 p-2 bg-red-500/5 rounded border border-red-500/10">
                                    <strong>Raison du rejet :</strong> {tx.rejectionReason}
                                  </p>
                                )}

                                {/* Approval Controls */}
                                <div className="space-y-3 pt-2.5 border-t border-slate-800/40">
                                  {tx.status === 'pending' && (
                                    <div className="space-y-2.5">
                                      <input 
                                        type="text" 
                                        placeholder="Motif du rejet (Obligatoire pour annuler)"
                                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500"
                                        value={adminRejectedReason[tx.id] || ''}
                                        onChange={(e) => setAdminRejectedReason({ ...adminRejectedReason, [tx.id]: e.target.value })}
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleAdminUpdateStatus(tx.id, 'rejected')}
                                          className="w-1/2 py-2 border border-red-500/30 hover:bg-red-500/10 text-red-550 text-xs font-bold rounded-xl transition-all"
                                        >
                                          Annuler / Refuser
                                        </button>
                                        <button
                                          onClick={() => handleAdminUpdateStatus(tx.id, 'validated')}
                                          className="w-1/2 py-2 bg-gradient-to-tr from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 text-xs font-black rounded-xl shadow-md transition-all"
                                        >
                                          Valider le retrait
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {tx.status === 'validated' && (
                                    <div className="space-y-2.5">
                                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/20 px-2 py-1 rounded block w-fit">
                                        ✓ Retrait Validé
                                      </span>
                                      <input 
                                        type="text" 
                                        placeholder="Motif d'annulation de force (Saisir si vous annulez)"
                                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500"
                                        value={adminRejectedReason[tx.id] || ''}
                                        onChange={(e) => setAdminRejectedReason({ ...adminRejectedReason, [tx.id]: e.target.value })}
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleAdminUpdateStatus(tx.id, 'pending')}
                                          className="w-1/2 py-1.5 border border-slate-700 hover:bg-slate-800 text-xs text-gray-300 font-bold rounded-xl transition-all"
                                          title="Remettre cette opération à l'état en attente de vérification"
                                        >
                                          Remettre En attente
                                        </button>
                                        <button
                                          onClick={() => handleAdminUpdateStatus(tx.id, 'rejected')}
                                          className="w-1/2 py-1.5 bg-red-950/50 hover:bg-red-900/60 border border-red-500/30 text-xs text-red-400 font-bold rounded-xl transition-all"
                                        >
                                          Annuler de force
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {tx.status === 'rejected' && (
                                    <div className="space-y-2.5">
                                      <span className="text-[10px] text-red-400 font-bold bg-red-500/15 border border-red-500/20 px-2 py-1 rounded block w-fit">
                                        ✗ Retrait Annulé / Rejeté
                                      </span>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleAdminUpdateStatus(tx.id, 'pending')}
                                          className="w-1/2 py-1.5 border border-slate-700 hover:bg-slate-800 text-xs text-gray-300 font-bold rounded-xl transition-all"
                                        >
                                          Remettre En attente
                                        </button>
                                        <button
                                          onClick={() => handleAdminUpdateStatus(tx.id, 'validated')}
                                          className="w-1/2 py-1.5 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/30 text-xs text-cyan-400 font-bold rounded-xl transition-all"
                                        >
                                          Rétablir et Valider
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 3. ADMINISTRATION: PLATFORM STATS & ANALYTICS VIEW */}
                {adminTab === 'stats' && (() => {
                  // Operational Stats
                  const depositCount = transactions.filter(t => t.type === 'deposit').length;
                  const validatedDepositCount = transactions.filter(t => t.type === 'deposit' && t.status === 'validated').length;
                  const depositTotalSum = transactions.filter(t => t.type === 'deposit' && t.status === 'validated').reduce((sum, t) => sum + t.amount, 0);

                  const withdrawalCount = transactions.filter(t => t.type === 'withdrawal').length;
                  const validatedWithdrawalCount = transactions.filter(t => t.type === 'withdrawal' && t.status === 'validated').length;
                  const withdrawalTotalSum = transactions.filter(t => t.type === 'withdrawal' && t.status === 'validated').reduce((sum, t) => sum + t.amount, 0);

                  // Users activity: active vs inactive
                  const totalUsersCount = allUsers.length;
                  const activeUsersCount = allUsers.filter(u => 
                    transactions.some(t => t.userPhone === u.phone && t.status === 'validated')
                  ).length;
                  const inactiveUsersCount = Math.max(0, totalUsersCount - activeUsersCount);

                  // Referral calculations:
                  const sponsorBalanceTotal = allUsers.reduce((sum, u) => sum + (u.balanceCommission || 0), 0);
                  const sponsorWithdrawnTotal = allUsers.reduce((sum, u) => sum + (u.balanceCommissionWithdrawn || 0), 0);
                  const sponsorAccumulatedTotal = sponsorBalanceTotal + sponsorWithdrawnTotal;

                  return (
                    <div className="space-y-6 animate-fade-in text-gray-100 pb-10">
                      
                      {/* Operational Cards */}
                      <div>
                        <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-display">
                          <TrendingUp size={14} />
                          Opérations de la plateforme
                        </h4>
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="bg-[#111a33] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase mb-1">Dépôts validés</p>
                              <p className="text-base font-extrabold font-mono text-[#00f0ff]">{depositTotalSum.toLocaleString()} FCFA</p>
                            </div>
                            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded w-fit mt-3.5 font-mono font-bold">
                              {validatedDepositCount}/{depositCount} validés
                            </span>
                          </div>

                          <div className="bg-[#111a33] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase mb-1">Retraits validés</p>
                              <p className="text-base font-extrabold font-mono text-pink-400">{withdrawalTotalSum.toLocaleString()} FCFA</p>
                            </div>
                            <span className="text-[9px] text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded w-fit mt-3.5 font-mono font-bold">
                              {validatedWithdrawalCount}/{withdrawalCount} validés
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Parrainage Stats */}
                      <div>
                        <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-display">
                          <Users size={14} />
                          Système d'Affiliation (Parrainage)
                        </h4>
                        <div className="bg-[#111a33] border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
                          <div className="flex justify-between items-center pb-3 border-b border-slate-800/60">
                            <div>
                              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Gains cumulés parrains</span>
                              <span className="text-lg font-black font-mono text-yellow-550">{sponsorAccumulatedTotal.toLocaleString()} FCFA</span>
                            </div>
                            <span className="p-2.5 bg-yellow-500/10 text-yellow-400 rounded-xl">
                              <Wallet size={18} />
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                              <span className="text-[9px] text-gray-400 uppercase font-bold block mb-1">Gains Payés / Retirés</span>
                              <span className="font-mono text-emerald-450 font-extrabold text-sm">{sponsorWithdrawnTotal.toLocaleString()} F</span>
                            </div>

                            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                              <span className="text-[9px] text-gray-400 uppercase font-bold block mb-1">Gains en attente</span>
                              <span className="font-mono text-amber-500 font-extrabold text-sm">{sponsorBalanceTotal.toLocaleString()} F</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Inscriptions Stats */}
                      <div>
                        <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-display">
                          <CheckCircle2 size={14} />
                          Activité des Utilisateurs
                        </h4>
                        <div className="bg-[#111a33] border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Inscriptions totales</span>
                              <span className="text-2xl font-mono text-white font-extrabold">{totalUsersCount}</span>
                            </div>
                            <div className="flex gap-1.5">
                              <div className="text-center px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <span className="text-[8px] font-bold text-emerald-400 block uppercase">Actifs</span>
                                <span className="text-xs font-bold text-white font-mono">{activeUsersCount}</span>
                              </div>
                              <div className="text-center px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
                                <span className="text-[8px] font-bold text-gray-400 block uppercase">Inactifs</span>
                                <span className="text-xs font-bold text-gray-400 font-mono">{inactiveUsersCount}</span>
                              </div>
                            </div>
                          </div>

                          {/* Progress visualizer bar */}
                          {totalUsersCount > 0 && (
                            <div className="space-y-1.5">
                              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex">
                                <div 
                                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" 
                                  style={{ width: `${Math.round((activeUsersCount / totalUsersCount) * 100)}%` }} 
                                />
                              </div>
                              <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase font-mono">
                                <span>Taux d'activité : {Math.round((activeUsersCount / totalUsersCount) * 100)}%</span>
                                <span>{activeUsersCount} sur {totalUsersCount}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })()}

                {/* 6. ADMINISTRATION: REAL-TIME USERS list AND ACCOUNT DELETION */}
                {adminTab === 'users' && (() => {
                  const filteredUsersList = allUsers.filter(u => {
                    const q = usersSearchQuery.toLowerCase().trim();
                    if (!q) return true;
                    return u.name.toLowerCase().includes(q) || u.phone.includes(q);
                  });

                  const handleDeleteUserClick = async (phone: string, name: string) => {
                    if (!window.confirm(`⚠️ ATTENTION ! Voulez-vous vraiment supprimer définitivement le compte de ${name} (${phone}) ? Cette action est irréversible.`)) {
                      return;
                    }
                    try {
                      await dbService.deleteUser(phone);
                      fetchAdminTransactions();
                      showToast(`Compte de ${name} supprimé avec succès ! 🗑️`, 'success');
                    } catch (e: any) {
                      showToast("Erreur lors de la suppression de l'utilisateur.", 'error');
                    }
                  };

                  return (
                    <div className="space-y-4 animate-fade-in pb-10">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold uppercase font-display tracking-wider text-gray-200 font-display">Utilisateurs inscrits</h3>
                        <span className="text-[10px] bg-slate-950 uppercase border border-slate-800 text-gray-400 px-2.5 py-1 rounded-full font-bold">
                          {filteredUsersList.length} Utilisateurs
                        </span>
                      </div>

                      {/* Search bar */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Rechercher par nom ou numéro..."
                          className="w-full bg-[#111a33] border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                          value={usersSearchQuery}
                          onChange={(e) => setUsersSearchQuery(e.target.value)}
                        />
                        <span className="absolute right-3.5 top-3 text-gray-500">
                          <Users size={14} />
                        </span>
                      </div>

                      {/* Users lists results */}
                      <div className="space-y-3">
                        {filteredUsersList.length === 0 ? (
                          <div className="text-center py-12 text-gray-400 text-xs border border-dashed border-slate-800 rounded-3xl">
                            Aucun utilisateur trouvé.
                          </div>
                        ) : (
                          filteredUsersList.map((usr) => {
                            const isUserActive = transactions.some(t => t.userPhone === usr.phone && t.status === 'validated');
                            return (
                              <div key={usr.phone} className="bg-[#111a33] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-md">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <h5 className="text-xs font-bold text-white uppercase">{usr.name}</h5>
                                      {isUserActive ? (
                                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-bold uppercaseScale">Actif</span>
                                      ) : (
                                        <span className="text-[8px] bg-slate-800 text-gray-400 border border-slate-700 px-1.5 py-0.2 rounded font-bold uppercaseScale">Inactif</span>
                                      )}
                                    </div>
                                    <p className="text-[11px] font-mono text-cyan-400 font-semibold mt-0.5">{usr.phone}</p>
                                  </div>
                                  {usr.role !== 'admin' && (
                                    <button
                                      onClick={() => handleDeleteUserClick(usr.phone, usr.name)}
                                      className="p-2 border border-red-500/25 bg-red-500/5 hover:bg-red-500/15 text-red-400 rounded-xl transition-all cursor-pointer"
                                      title="Supprimer cet utilisateur"
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900 text-[10px]">
                                  <div>
                                    <span className="text-gray-500 block uppercase font-bold tracking-tight mb-0.5">Commissions dispo</span>
                                    <span className="font-mono text-yellow-500 font-bold">{usr.balanceCommission.toLocaleString()} FCFA</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 block uppercase font-bold tracking-tight mb-0.5">Commissions retirées</span>
                                    <span className="font-mono text-emerald-400 font-bold">{usr.balanceCommissionWithdrawn.toLocaleString()} FCFA</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 4. ADMINISTRATION: MANUAL PRONOS MANAGEMENT PANEL */}
                {adminTab === 'pronos' && (() => {
                  const addMatchRow = () => {
                    setCouponEditForm(prev => ({
                      ...prev,
                      matches: [...prev.matches, { homeTeam: '', awayTeam: '', prediction: '', odd: 1.5, status: 'pending' }]
                    }));
                  };

                  const updateMatchRow = (index: number, field: string, value: any) => {
                    setCouponEditForm(prev => {
                      const updated = [...prev.matches];
                      updated[index] = { ...updated[index], [field]: value };
                      return { ...prev, matches: updated };
                    });
                  };

                  const removeMatchRow = (index: number) => {
                    setCouponEditForm(prev => ({
                      ...prev,
                      matches: prev.matches.filter((_, i) => i !== index)
                    }));
                  };

                  const autoComputeCote = () => {
                    const prod = couponEditForm.matches.reduce((product, m) => product * (Number(m.odd) || 1), 1);
                    setCouponEditForm(prev => ({
                      ...prev,
                      totalCote: Number(prod.toFixed(2))
                    }));
                  };

                  return (
                    <div className="space-y-6 animate-fade-in pb-10">
                      
                      {/* Dashboard Title & Introduction */}
                      <div className="bg-[#111a33] border border-slate-800 rounded-3xl p-5 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
                            <TrendingUp size={18} />
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-white">Créateur et Validation de Coupons</h4>
                            <p className="text-[10px] text-gray-400">Sélectionnez le calibre de coupon à créer, personnalisez les événements sportifs et mettez à jour votre historique de validation.</p>
                          </div>
                        </div>
                      </div>

                      {/* Select type coupon to create */}
                      <div className="bg-[#111a33] border border-slate-800 rounded-3xl p-4 space-y-3">
                        <label className="block text-gray-300 text-[11px] font-black uppercase tracking-wider">Sélectionner le Coupon à créer / Gérer les publications :</label>
                        <div className="grid grid-cols-1 gap-2.5">
                          {[
                            { id: 'secured', name: 'Côte 2 Sécurisé', badge: 'Public', titleDefault: 'COUPON COTE 2 SÉCURISÉ 🌟', conf: 'ÉLEVÉ' },
                            { id: 'medium', name: 'Côte 5 Médium', badge: 'Minimum 1000FCFA', titleDefault: 'COUPON COTE 5 MÉDIUM ⚡', conf: 'MOYEN' },
                            { id: 'bold', name: 'Côte 10 Audacieux', badge: 'Minimum 1000FCFA', titleDefault: 'COUPON COTE 10 AUDACIEUX 🔥', conf: 'RISQUE ÉLEVÉ' }
                          ].map((choice) => {
                            const currentCoupon = coupons.find(c => c.id === choice.id);
                            const hasActiveMatches = currentCoupon && currentCoupon.matches && currentCoupon.matches.length > 0;
                            const matchCount = currentCoupon?.matches?.length || 0;

                            return (
                              <div key={choice.id} className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white text-xs font-bold">{choice.name}</span>
                                    <span className="text-[7.5px] px-1.5 py-0.5 rounded font-mono bg-[#1c2c54]/75 text-cyan-300 border border-cyan-500/10">
                                      {choice.badge}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    {hasActiveMatches ? (
                                      <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                        Publié ({matchCount} match{matchCount > 1 ? 'es' : ''})
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-gray-400 bg-slate-900/60 px-2 py-0.5 rounded-full border border-slate-800">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                                        Non publié (Vide)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Create/Edit action button */}
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCouponToCreate(choice.id)}
                                    className={`flex-1 sm:flex-none py-1.5 px-3.5 rounded-xl border text-[10.5px] font-bold transition-all cursor-pointer ${
                                      selectedCouponId === choice.id
                                        ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-black scale-102 shadow-md hover:bg-cyan-400'
                                        : 'bg-slate-900 border-slate-800 text-gray-300 hover:border-slate-705'
                                    }`}
                                  >
                                    Éditer / Créer
                                  </button>

                                  {/* Unpublish action button */}
                                  {hasActiveMatches && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (window.confirm(`Voulez-vous vraiment dépublier le coupon "${choice.name}" ? Tous ses matchs en cours seront vidés.`)) {
                                          try {
                                            const updatedCoupons = await dbService.updateCoupon({
                                              id: choice.id,
                                              title: choice.titleDefault,
                                              confidence: choice.conf as any,
                                              totalCote: choice.id === 'secured' ? 2.0 : choice.id === 'medium' ? 5.0 : 10.0,
                                              status: 'pending',
                                              matches: []
                                            });
                                            setCoupons(updatedCoupons);
                                            showToast(`Le coupon "${choice.name}" a été dépublié avec succès ! 🗑️`, "success");
                                          } catch (e: any) {
                                            showToast("Erreur lors de la dépublication du coupon.", "error");
                                          }
                                        }
                                      }}
                                      className="py-1.5 px-2.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/20 text-red-400 text-[10.5px] font-bold transition-all cursor-pointer"
                                      title="Vider et Dépublier pour aujourd'hui"
                                    >
                                      Dépublier
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Display Creator Options below only when selection has happened */}
                      {selectedCouponId === '' ? (
                        <div className="bg-[#111a33] border border-dashed border-slate-800 rounded-3xl p-8 text-center space-y-3">
                          <span className="inline-block p-4 bg-cyan-500/5 text-cyan-400 rounded-2xl animate-pulse">
                            <Sparkles size={28} />
                          </span>
                          <div>
                            <h5 className="text-white text-xs font-bold">Prêt pour la création</h5>
                            <p className="text-[10px] text-gray-400 max-w-xs mx-auto mt-1 leading-relaxed">
                              Veuillez choisir un type de coupon ci-dessus (Côte 2, Côte 5, Côte 10) pour ouvrir instantanément l'éditeur de création personnalisé.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleSaveManualCoupon} className="bg-[#111a33] border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl animate-fade-in">
                          <h4 className="text-xs font-extrabold text-cyan-400 uppercase tracking-widest pb-2 border-b border-slate-800 flex items-center gap-1.5">
                            <Sparkles size={14} />
                            Options de création : {selectedCouponId === 'secured' ? 'COUPON COTE 2' : selectedCouponId === 'medium' ? 'COUPON COTE 5' : 'COUPON COTE 10'}
                          </h4>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-gray-400 text-[10px] uppercase font-bold mb-1">Nom du Coupon</label>
                              <input
                                type="text"
                                value={couponEditForm.title}
                                onChange={(e) => setCouponEditForm({ ...couponEditForm, title: e.target.value })}
                                placeholder="Ex: COUPON SÉCURISÉ (COTE ~2)"
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                                required
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-gray-400 text-[10px] uppercase font-bold mb-1">Confiance</label>
                                <select
                                  value={couponEditForm.confidence}
                                  onChange={(e) => setCouponEditForm({ ...couponEditForm, confidence: e.target.value as any })}
                                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                                >
                                  <option value="ÉLEVÉ">ÉLEVÉ (95%)</option>
                                  <option value="MOYEN">MOYEN (85%)</option>
                                  <option value="RISQUE ÉLEVÉ">RISQUE ÉLEVÉ (75%)</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-gray-400 text-[10px] uppercase font-bold mb-1">Cote Globale</label>
                                <div className="flex gap-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={couponEditForm.totalCote}
                                    onChange={(e) => setCouponEditForm({ ...couponEditForm, totalCote: Number(e.target.value) })}
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white shadow-inner font-mono font-bold"
                                    required
                                  />
                                  <button
                                    type="button"
                                    onClick={autoComputeCote}
                                    className="bg-slate-800 hover:bg-slate-700 text-cyan-400 px-2 py-1 rounded-lg text-[9px] font-bold"
                                    title="Calculer automatiquement par multiplication"
                                  >
                                    Auto
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Match rows editor */}
                          <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-center">
                              <label className="block text-[#00f0ff] text-[10px] uppercase font-extrabold tracking-wider">Événements / Matchs ({couponEditForm.matches.length})</label>
                              <button
                                type="button"
                                onClick={addMatchRow}
                                className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[10px] px-2.5 py-1 rounded-lg font-bold border border-cyan-500/20 flex items-center gap-1"
                              >
                                + Ajouter un Match
                              </button>
                            </div>

                            {couponEditForm.matches.length === 0 ? (
                              <p className="text-center py-4 text-xs text-gray-400 italic bg-slate-950/40 rounded-2xl border border-slate-900 border-dashed">Aucun match inscrit. Cliquez sur ajouter ci-dessus.</p>
                            ) : (
                              <div className="space-y-3">
                                {couponEditForm.matches.map((match, idx) => (
                                  <div key={idx} className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 space-y-2.5 relative">
                                    <button
                                      type="button"
                                      onClick={() => removeMatchRow(idx)}
                                      className="absolute top-2 right-2 text-red-500 hover:text-red-400 text-[10px] font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850"
                                    >
                                      Supprimer
                                    </button>
                                    <span className="text-[10px] text-gray-500 font-mono">Match #{idx+1}</span>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-gray-550 text-[8px] uppercase mb-0.5">Équipe Domicile</label>
                                        <input
                                          type="text"
                                          placeholder="Ex: Real Madrid"
                                          value={match.homeTeam}
                                          onChange={(e) => updateMatchRow(idx, 'homeTeam', e.target.value)}
                                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-gray-550 text-[8px] uppercase mb-0.5">Équipe Extérieur</label>
                                        <input
                                          type="text"
                                          placeholder="Ex: FC Barcelone"
                                          value={match.awayTeam}
                                          onChange={(e) => updateMatchRow(idx, 'awayTeam', e.target.value)}
                                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white"
                                          required
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <label className="block text-gray-550 text-[8px] uppercase mb-0.5">Pronostic proposé</label>
                                        <input
                                          type="text"
                                          placeholder="Ex: V1"
                                          value={match.prediction}
                                          onChange={(e) => updateMatchRow(idx, 'prediction', e.target.value)}
                                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white font-semibold"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-gray-550 text-[8px] uppercase mb-0.5">Cote de l'événement</label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder="1.50"
                                          value={match.odd}
                                          onChange={(e) => updateMatchRow(idx, 'odd', Number(e.target.value))}
                                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white font-mono"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-cyan-400 text-[8px] uppercase mb-0.5 font-bold">État Match</label>
                                        <select
                                          value={match.status || 'pending'}
                                          onChange={(e) => updateMatchRow(idx, 'status', e.target.value)}
                                          className={`w-full bg-slate-900 border rounded-lg px-2 py-1 text-[11px] font-bold ${
                                            match.status === 'won' 
                                              ? 'border-emerald-500/45 text-emerald-400' 
                                              : match.status === 'lost' 
                                                ? 'border-red-500/45 text-red-500' 
                                                : 'border-slate-805 text-gray-300'
                                          }`}
                                        >
                                          <option value="pending">⏳ En cours</option>
                                          <option value="won">✓ Gagné</option>
                                          <option value="lost">✗ Perdu</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Submit Actions */}
                          <div className="pt-2">
                            <button
                              type="submit"
                              disabled={formLoading}
                              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black py-3 rounded-xl text-xs transition-colors shadow-lg flex items-center justify-center gap-1.5"
                            >
                              {formLoading ? (
                                <>
                                  <RefreshCw size={14} className="animate-spin" />
                                  Enregistrement...
                                </>
                              ) : (
                                <>
                                  Enregistrer et publier le coupon
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Admin validation history timeline view list */}
                      <div className="bg-[#111a33] border border-slate-800 rounded-3xl p-5 space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                          <h4 className="text-xs font-extrabold uppercase text-gray-300">Archives de validation / Historique</h4>
                          <button
                            onClick={handleClearHistory}
                            className="text-[10px] text-red-400 hover:underline font-bold font-display"
                          >
                            Réinitialiser l'historique
                          </button>
                        </div>

                        {pastCoupons.length === 0 ? (
                          <div className="text-center py-4 text-xs text-gray-500 italic">Aucun historique enregistré pour le moment.</div>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {pastCoupons.map((c) => (
                              <div key={c.id} className="bg-slate-950/40 p-3 rounded-2xl border border-slate-900/60 flex justify-between items-center text-[11px] gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-extrabold text-gray-200 truncate">{c.title}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500">
                                    <span className="flex items-center gap-0.5"><Calendar size={10} /> {c.date || 'Archives'}</span>
                                    <span>•</span>
                                    <span>Cote {Number(c.totalCote).toFixed(2)}</span>
                                    {c.matches && c.matches.length > 0 && (
                                      <>
                                        <span>•</span>
                                        <span className="font-mono text-cyan-400">{c.matches.length} match{c.matches.length > 1 ? 'es' : ''}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Status Indicator */}
                                  <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-lg ${
                                    c.status === 'won' 
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                      : c.status === 'lost' 
                                        ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                                        : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                                  }`}>
                                    {c.status === 'won' ? '✓ GAGNÉ' : c.status === 'lost' ? '✗ PERDU' : '⏳ EN COURS'}
                                  </span>

                                  {/* ACTION: Edit Archived Coupon */}
                                  <button
                                    type="button"
                                    onClick={() => setEditingPastCoupon(JSON.parse(JSON.stringify(c)))} // deep clone isolated model
                                    className="bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-slate-950 px-2 py-1 rounded-lg text-[9px] font-extrabold border border-cyan-500/20 transition-all flex items-center gap-1 cursor-pointer"
                                    title="Ouvrir les modificateurs de ce coupon"
                                  >
                                    <Edit size={10} />
                                    Modifier
                                  </button>

                                  {/* ACTION: Delete Entry */}
                                  <button
                                    onClick={() => handleDeleteHistoryItem(c.id)}
                                    className="text-red-400 hover:text-white p-1 hover:bg-red-500/15 rounded-lg transition-colors border border-transparent hover:border-red-500/10"
                                    title="Supprimer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* POPUP/OVERLAY INLINE MODAL TO ADJUST HISTORICAL COUPONS DETAILS */}
                      {editingPastCoupon && (() => {
                        const editPastCouponTitle = (val: string) => {
                          setEditingPastCoupon(prev => prev ? { ...prev, title: val } : null);
                        };
                        const editPastCouponConfidence = (val: any) => {
                          setEditingPastCoupon(prev => prev ? { ...prev, confidence: val } : null);
                        };
                        const editPastCouponCote = (val: number) => {
                          setEditingPastCoupon(prev => prev ? { ...prev, totalCote: val } : null);
                        };
                        const editPastCouponDate = (val: string) => {
                          setEditingPastCoupon(prev => prev ? { ...prev, date: val } : null);
                        };
                        const editPastCouponOverallStatus = (val: 'pending' | 'won' | 'lost') => {
                          setEditingPastCoupon(prev => prev ? { ...prev, status: val } : null);
                        };

                        const addModalMatchRow = () => {
                          setEditingPastCoupon(prev => {
                            if (!prev) return null;
                            const prevMatches = prev.matches || [];
                            return {
                              ...prev,
                              matches: [...prevMatches, { id: prevMatches.length + 1, homeTeam: '', awayTeam: '', prediction: '', odd: 1.5, status: 'pending' }]
                            };
                          });
                        };

                        const updateModalMatchRow = (index: number, field: string, value: any) => {
                          setEditingPastCoupon(prev => {
                            if (!prev) return null;
                            const matchesCopy = [...(prev.matches || [])];
                            matchesCopy[index] = { ...matchesCopy[index], [field]: value };
                            return { ...prev, matches: matchesCopy };
                          });
                        };

                        const removeModalMatchInEdit = (index: number) => {
                          setEditingPastCoupon(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              matches: (prev.matches || []).filter((_, i) => i !== index)
                            };
                          });
                        };

                        const autoComputeModalCote = () => {
                          if (!editingPastCoupon) return;
                          const prod = (editingPastCoupon.matches || []).reduce((product, m) => product * (Number(m.odd) || 1), 1);
                          setEditingPastCoupon(prev => prev ? { ...prev, totalCote: Number(prod.toFixed(2)) } : null);
                        };

                        return (
                          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-[#0b132a] border border-slate-800 rounded-3xl w-full max-w-lg p-5 space-y-4 shadow-2xl relative animate-fade-in max-h-[90vh] overflow-y-auto">
                              
                              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                                <h3 className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                                  <Edit size={14} />
                                  Modifier le Coupon Historique
                                </h3>
                                <button
                                  type="button"
                                  onClick={() => setEditingPastCoupon(null)}
                                  className="text-gray-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors border-none"
                                >
                                  <X size={16} />
                                </button>
                              </div>

                              <form onSubmit={handleSaveEditedPastCoupon} className="space-y-4">
                                
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-gray-400 text-[9px] uppercase font-bold mb-1">Nom du Coupon</label>
                                    <input
                                      type="text"
                                      required
                                      value={editingPastCoupon.title}
                                      onChange={(e) => editPastCouponTitle(e.target.value)}
                                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-gray-400 text-[9px] uppercase font-bold mb-1">Confiance</label>
                                      <select
                                        value={editingPastCoupon.confidence}
                                        onChange={(e) => editPastCouponConfidence(e.target.value as any)}
                                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white cursor-pointer"
                                      >
                                        <option value="ÉLEVÉ">ÉLEVÉ (95%)</option>
                                        <option value="MOYEN">MOYEN (85%)</option>
                                        <option value="RISQUE ÉLEVÉ">RISQUE ÉLEVÉ (75%)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-gray-400 text-[9px] uppercase font-bold mb-1">Date d'archivage</label>
                                      <input
                                        type="text"
                                        required
                                        value={editingPastCoupon.date || ''}
                                        onChange={(e) => editPastCouponDate(e.target.value)}
                                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                                        placeholder="JJ/MM/AAAA"
                                      />
                                    </div>
                                  </div>

                                  {/* Status Validation Panel */}
                                  <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800 space-y-2">
                                    <label className="block text-yellow-400 text-[10px] uppercase font-black tracking-wider text-center">
                                      Validation: Statut Global du Coupon
                                    </label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => editPastCouponOverallStatus('pending')}
                                        className={`py-1.5 text-[9px] font-bold rounded-lg transition-all ${
                                          editingPastCoupon.status === 'pending' || !editingPastCoupon.status
                                            ? 'bg-yellow-500 text-slate-950 font-black'
                                            : 'bg-slate-900 text-gray-400 hover:text-white'
                                        }`}
                                      >
                                        ⏳ EN COURS
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => editPastCouponOverallStatus('won')}
                                        className={`py-1.5 text-[9px] font-bold rounded-lg transition-all ${
                                          editingPastCoupon.status === 'won'
                                            ? 'bg-emerald-500 text-slate-950 font-black'
                                            : 'bg-slate-900 text-gray-400 hover:text-white'
                                        }`}
                                      >
                                        ✓ GAGNÉ
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => editPastCouponOverallStatus('lost')}
                                        className={`py-1.5 text-[9px] font-bold rounded-lg transition-all ${
                                          editingPastCoupon.status === 'lost'
                                            ? 'bg-red-500 text-white font-black'
                                            : 'bg-slate-900 text-gray-400 hover:text-white'
                                        }`}
                                      >
                                        ✗ PERDU
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Match events inline editor inside Modal */}
                                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[#00f0ff] text-[10px] uppercase font-extrabold tracking-wider">
                                      Matchs à Valider ({editingPastCoupon.matches?.length || 0})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={addModalMatchRow}
                                      className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[9px] px-2 py-0.5 rounded-md font-bold border border-cyan-500/20 cursor-pointer"
                                    >
                                      + Ajouter Match
                                    </button>
                                  </div>

                                  {(!editingPastCoupon.matches || editingPastCoupon.matches.length === 0) ? (
                                    <p className="text-center py-2 text-[10px] text-gray-450 italic">Aucun événement inscrit.</p>
                                  ) : (
                                    <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                                      {editingPastCoupon.matches.map((m, idx) => (
                                        <div key={idx} className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-2 relative">
                                          <button
                                            type="button"
                                            onClick={() => removeModalMatchInEdit(idx)}
                                            className="absolute top-1.5 right-2 text-red-500 hover:text-red-400 text-[8px] font-bold"
                                          >
                                            Effacer
                                          </button>
                                          <span className="text-[8px] text-gray-500 font-mono">Match #{idx+1}</span>

                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <label className="block text-gray-500 text-[8px] uppercase">Domicile</label>
                                              <input
                                                type="text"
                                                required
                                                value={m.homeTeam}
                                                onChange={(e) => updateModalMatchRow(idx, 'homeTeam', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-[10px] text-white"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-gray-500 text-[8px] uppercase">Extérieur</label>
                                              <input
                                                type="text"
                                                required
                                                value={m.awayTeam}
                                                onChange={(e) => updateModalMatchRow(idx, 'awayTeam', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-[10px] text-white"
                                              />
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-3 gap-2">
                                            <div>
                                              <label className="block text-gray-500 text-[8px] uppercase">Pronostic</label>
                                              <input
                                                type="text"
                                                required
                                                value={m.prediction}
                                                onChange={(e) => updateModalMatchRow(idx, 'prediction', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-[10px] text-white font-bold"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-gray-500 text-[8px] uppercase">Cote (Odd)</label>
                                              <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={m.odd}
                                                onChange={(e) => updateModalMatchRow(idx, 'odd', Number(e.target.value))}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-[10px] text-white"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-cyan-400 text-[8px] uppercase font-bold">État Match</label>
                                              <select
                                                value={m.status || 'pending'}
                                                onChange={(e) => updateModalMatchRow(idx, 'status', e.target.value)}
                                                className={`w-full bg-slate-900 border rounded px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                                                  m.status === 'won' 
                                                    ? 'border-emerald-500/40 text-emerald-400' 
                                                    : m.status === 'lost' 
                                                      ? 'border-red-500/40 text-red-500' 
                                                      : 'border-slate-800 text-gray-300'
                                                }`}
                                              >
                                                <option value="pending">⏳ En cours</option>
                                                <option value="won">✓ Gagné</option>
                                                <option value="lost">✗ Perdu</option>
                                              </select>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Total Cote calculations & Actions spacer */}
                                <div className="flex justify-between items-center text-xs py-1.5 border-t border-slate-800">
                                  <span className="text-gray-400 font-display">Calcul Cote Globale:</span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      step="0.01"
                                      required
                                      value={editingPastCoupon.totalCote}
                                      onChange={(e) => editPastCouponCote(Number(e.target.value))}
                                      className="w-16 text-center bg-slate-950 font-mono text-xs text-white border border-slate-800 rounded-lg py-0.5"
                                    />
                                    <button
                                      type="button"
                                      onClick={autoComputeModalCote}
                                      className="bg-slate-800 hover:bg-slate-700 text-cyan-400 px-1.5 py-0.5 rounded text-[8px] font-bold"
                                    >
                                      Auto
                                    </button>
                                  </div>
                                </div>

                                {/* Footer Buttons */}
                                <div className="grid grid-cols-2 gap-2.5 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingPastCoupon(null)}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                                    disabled={formLoading}
                                  >
                                    Annuler
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-colors shadow-lg flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    {formLoading ? (
                                      <>
                                        <RefreshCw size={12} className="animate-spin" />
                                        Mise à jour...
                                      </>
                                    ) : (
                                      <>
                                        Enregistrer
                                      </>
                                    )}
                                  </button>
                                </div>

                              </form>
                            </div>
                          </div>
                        );
                      })()}

                    </div>
                  );
                })()}

                {/* 5. ADMINISTRATION: CONFIG SHEET CONTROLLER */}
                {adminTab === 'config' && (
                  <div className="space-y-5 animate-fade-in">
                    
                    {/* Public Banner Form */}
                    <form onSubmit={handleUpdateConfig} className="bg-[#111a33] border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                      <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
                        <h4 className="text-xs font-extrabold font-display uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                          <Info size={14} />
                          Pop-up 1 : Informationnel
                        </h4>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-semibold">{configForm.popupEnabled ? 'Afficher' : 'Caché'}</span>
                          <button
                            type="button"
                            onClick={() => setConfigForm({ ...configForm, popupEnabled: !configForm.popupEnabled })}
                            className={`w-10 h-5.5 rounded-full p-0.5 transition-colors relative ${configForm.popupEnabled ? 'bg-cyan-500' : 'bg-slate-800'}`}
                          >
                            <div className={`w-4.5 h-4.5 rounded-full bg-slate-950 transition-all ${configForm.popupEnabled ? 'translate-x-4.5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-gray-400 text-[10px] uppercase font-bold mb-1">Titre du Pop-up</label>
                        <input 
                          type="text" 
                          placeholder="Chers clients"
                          className="w-full bg-[#0d1326] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                          value={configForm.popupTitle}
                          onChange={(e) => setConfigForm({ ...configForm, popupTitle: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-gray-400 text-[10px] uppercase font-bold mb-1">Message d'information</label>
                        <textarea 
                          rows={3}
                          placeholder="Texte de bienvenue..."
                          className="w-full bg-[#0d1326] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                          value={configForm.popupMessage}
                          onChange={(e) => setConfigForm({ ...configForm, popupMessage: e.target.value })}
                        />
                      </div>

                      {/* WhatsApp Support number */}
                      <div className="pt-2 border-t border-slate-800/60">
                        <label className="block text-gray-400 text-[10px] uppercase font-bold mb-1 flex items-center gap-1">
                          <Phone size={11} className="text-cyan-400" />
                          Numéro WhatsApp de Support
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: +22900000000"
                          className="w-full bg-[#0d1326] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                          value={configForm.supportWhatsapp}
                          onChange={(e) => setConfigForm({ ...configForm, supportWhatsapp: e.target.value })}
                        />
                      </div>

                      {/* Physical withdrawal address details */}
                      <div className="pt-2 border-t border-slate-800/60 space-y-3">
                        <span className="block text-xs font-bold text-gray-200 uppercase tracking-widest text-[9px] flex items-center gap-1">
                          <MapPin size={11} className="text-cyan-400" />
                          Adresse de retrait physique
                        </span>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-400 text-[9px] uppercase font-semibold mb-1">Ville / Quartier</label>
                            <input 
                              type="text" 
                              className="w-full bg-[#0d1326] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                              value={configForm.withdrawalPhysVille}
                              onChange={(e) => setConfigForm({ ...configForm, withdrawalPhysVille: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 text-[9px] uppercase font-semibold mb-1">Rue / Lieu-dit</label>
                            <input 
                              type="text" 
                              className="w-full bg-[#0d1326] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                              value={configForm.withdrawalPhysRue}
                              onChange={(e) => setConfigForm({ ...configForm, withdrawalPhysRue: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs rounded-xl transition-colors"
                      >
                        Enregistrer la Configuration
                      </button>
                    </form>

                    {/* Pay channels form / add new method */}
                    <div className="bg-[#111a33] border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                      <h4 className="text-xs font-extrabold font-display uppercase tracking-wider text-cyan-400">Moyens de paiement</h4>
                      
                      <div className="space-y-3">
                        {paymentMethods.map((pmObj) => (
                          <div key={pmObj.name} className="flex items-center justify-between bg-[#0d1326] p-3 rounded-2xl border border-slate-800 text-xs">
                            <div>
                              <p className="font-extrabold font-display text-white">{pmObj.name}</p>
                              <p className="font-mono text-gray-400 text-[11px] mt-0.5">N° dépôt: {pmObj.number}</p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold ${pmObj.active ? 'text-cyan-400' : 'text-gray-500'}`}>{pmObj.active ? 'Actif' : 'Inactif'}</span>
                              <button
                                type="button"
                                onClick={() => handleTogglePaymentMethod(pmObj.name)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${pmObj.active ? 'bg-cyan-500' : 'bg-slate-800'}`}
                              >
                                <div className={`w-4 h-4 rounded-full bg-slate-950 transition-transform ${pmObj.active ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add new pay channel form */}
                      <form onSubmit={handleAddPaymentMethod} className="pt-3 border-t border-slate-800/60 space-y-3">
                        <span className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider">Ajouter un nouveau moyen</span>
                        <div>
                          <input 
                            type="text" 
                            placeholder="Nom (ex : MOOV)" 
                            className="w-full bg-[#0d1326] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                            value={paymentMethodForm.name}
                            onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <input 
                            type="text" 
                            placeholder="Numéro de dépôt" 
                            className="w-full bg-[#0d1326] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white text-mono"
                            value={paymentMethodForm.number}
                            onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, number: e.target.value })}
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2 bg-[#1b2b52] hover:bg-[#203666] text-white font-bold text-xs rounded-xl transition-all"
                        >
                          + Ajouter
                        </button>
                      </form>

                    </div>

                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </main>

      {/* LIGHTBOX FOR FULL VIEWING SCREENSHOTS IMAGES */}
      {activeReceiptLightbox && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-slate-950/95 animate-fade-in">
          <button
            onClick={() => setActiveReceiptLightbox(null)}
            className="absolute top-5 right-5 p-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 rounded-full text-gray-300"
          >
            <XCircle size={28} />
          </button>
          <img src={activeReceiptLightbox} className="max-w-full max-h-[75vh] object-contain rounded-2xl border border-slate-800 shadow-2xl" alt="Ticket Grand" />
          <p className="text-gray-400 text-xs mt-3 select-none">Capture d'écran du reçu de transfert StarBetPay</p>
        </div>
      )}

      {/* FLOAT GREEN WHATSAPP COMPONENT CHAT ACTION BUTTON */}
      {user && config.supportWhatsapp && (
        <a 
          href={`https://wa.me/${config.supportWhatsapp.replace('+', '')}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Contacter le Support WhatsApp"
          className="fixed bottom-20 right-1/2 translate-x-[180px] z-50 w-12 h-12 rounded-full bg-[#25D366] text-white hover:bg-[#128C7E] shadow-xl flex items-center justify-center transition-transform hover:scale-110 shadow-emerald-500/30 cursor-pointer animate-bounce"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[24px] h-[24px]">
            <path d="M12.012 2c-5.506 0-9.988 4.471-9.988 9.978 0 1.764.46 3.42 1.263 4.869L2 22l5.318-1.393c1.401.764 2.99 1.199 4.68 1.199 5.506 0 10-4.471 10-9.978C22.012 6.471 17.518 2 12.012 2zm6.273 14.153c-.274.776-1.571 1.408-2.158 1.482-.572.074-1.284.14-3.791-.861-3.21-1.282-5.228-4.544-5.385-4.757-.156-.214-1.284-1.713-1.284-3.27 0-1.558.802-2.325 1.096-2.618.293-.294.636-.367.847-.367.21 0 .422.001.606.01.2.009.467-.076.732.569.274.673.931 2.274 1.01 2.433.08.16.133.344.027.553-.105.21-.157.344-.316.524-.157.18-.328.401-.469.539-.157.152-.321.319-.138.634.183.314.811 1.336 1.737 2.158.919.814 1.696 1.066 2.008 1.223.312.157.5.133.687-.08.187-.214.802-.931 1.01-1.25.21-.318.42-.267.712-.162.293.105 1.865.88 2.178 1.037.312.157.525.234.603.366.078.132.078.761-.196 1.537z" />
          </svg>
        </a>
      )}

      {/* ------------------------------------------- */}
      {/* BOTTOM MOBILE NAV BAR */}
      {/* ------------------------------------------- */}
      {user && !isAdminMode && (
        <nav className="fixed bottom-0 left-1/2 translate-x-[-50%] w-full max-w-[480px] h-16 bg-[#0c1228]/95 border-t border-cyan-500/10 grid grid-cols-5 text-center text-[10px] text-gray-400 font-semibold z-40 backdrop-blur-md">
          {[
            { id: 'home', label: 'Accueil', icon: Sparkles },
            { id: 'deposit', label: 'Dépôt', icon: ArrowUpRight },
            { id: 'pronos', label: 'Pronos', icon: Star },
            { id: 'withdrawal', label: 'Retrait', icon: Download },
            { id: 'history', label: 'Historique', icon: BarChart3 }
          ].map((nav) => {
            const IconComponent = nav.icon;
            const isActive = activeTab === nav.id;
            return (
              <button
                key={nav.id}
                onClick={() => { setActiveTab(nav.id); setFormMsg(null); }}
                className={`flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all ${
                  isActive ? 'text-cyan-400' : 'hover:text-white'
                }`}
              >
                <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-cyan-500/10 text-cyan-400 scale-110' : ''}`}>
                  <IconComponent size={20} />
                </div>
                <span>{nav.label}</span>
              </button>
            );
          })}
        </nav>
      )}

    </div>
  );
}
