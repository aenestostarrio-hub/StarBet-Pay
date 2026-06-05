import React, { useState, useEffect, useRef } from 'react';
import { 
  Star, Shield, RefreshCw, LogOut, CheckCircle2, AlertCircle, XCircle, 
  Plus, Copy, Check, Upload, Send, MessageSquare, Phone, Info, MapPin, 
  PlusCircle, Sparkles, AlertTriangle, ArrowUpRight, BarChart3, TrendingUp, Users, Wallet, Eye, Download, Bell, Volume2, ShieldAlert
} from 'lucide-react';
import { InstallPrompt } from './components/InstallPrompt';
import { DBUser, DBTransaction, PaymentMethod, AppConfig, SportCoupon } from './types';
import { dbService, isSupabaseConfigured, useLocalStorageSandbox } from './lib/supabase';

// Web audio API programmatic chime synthesizer to alert the admin
function playChimeNotification() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Low crisp tone
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 0.4);

    // High sparkling tone
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
    gain2.gain.setValueAtTime(0.15, audioCtx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    
    osc2.start(audioCtx.currentTime + 0.1);
    osc2.stop(audioCtx.currentTime + 0.5);
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

  // Client Side UI Active Tab ('home', 'deposit', 'pronos', 'withdrawal', 'history')
  const [activeTab, setActiveTab] = useState<string>('home');
  const [transactions, setTransactions] = useState<DBTransaction[]>([]);

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
  const [adminTab, setAdminTab] = useState<'deposits' | 'withdrawals' | 'gains' | 'pronos' | 'config'>('deposits');
  const [adminSubTab, setAdminSubTab] = useState<'pending' | 'validated' | 'rejected'>('pending');
  const [adminRejectedReason, setAdminRejectedReason] = useState<Record<string, string>>({});
  const [activeReceiptLightbox, setActiveReceiptLightbox] = useState<string | null>(null);
  
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
  const [selectedCouponId, setSelectedCouponId] = useState<string>('secured');
  const [couponEditForm, setCouponEditForm] = useState<{
    id: string;
    title: string;
    confidence: 'ÉLEVÉ' | 'MOYEN' | 'RISQUE ÉLEVÉ';
    totalCote: number;
    matches: { homeTeam: string; awayTeam: string; prediction: string; odd: number }[];
  }>({
    id: 'secured',
    title: '',
    confidence: 'ÉLEVÉ',
    totalCote: 2.0,
    matches: []
  });

  // Load selected active coupon into edit form
  useEffect(() => {
    if (coupons && coupons.length > 0) {
      const activeCoup = coupons.find(c => c.id === selectedCouponId);
      if (activeCoup) {
        setCouponEditForm({
          id: activeCoup.id,
          title: activeCoup.title,
          confidence: activeCoup.confidence,
          totalCote: activeCoup.totalCote,
          matches: activeCoup.matches.map(m => ({
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            prediction: m.prediction,
            odd: m.odd,
            status: m.status || 'pending'
          }))
        });
      }
    }
  }, [selectedCouponId, coupons]);

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

      const statsData = await dbService.getUserStats(phone);
      setRefStats(statsData);
    } catch (err) {
      console.error('Error fetching client credentials:', err);
    }
  };

  // Fetch ALL transactions for Admin Dashboard
  const fetchAdminTransactions = async () => {
    try {
      const txData = await dbService.getTransactions();
      setTransactions(txData);
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

  // Establish Real-Time or Polling notifications for administrators
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: any = null;
    
    if (user && user.role === 'admin') {
      if (isSupabaseConfigured || useLocalStorageSandbox) {
        // Direct polling to avoid SSE / server failure on Vercel or Sandbox
        let lastCount = transactions.length;
        pollInterval = setInterval(async () => {
          try {
            const txData = await dbService.getTransactions();
            if (txData.length > lastCount) {
              const newTxs = txData.slice(0, txData.length - lastCount);
              newTxs.forEach(tx => {
                playChimeNotification();
                setAdminNotifications(prev => [tx, ...prev]);
              });
              setTransactions(txData);
            }
            lastCount = txData.length;
          } catch (e) {
            console.warn('Real-time poll error:', e);
          }
        }, 8000);
      } else {
        try {
          eventSource = new EventSource('/api/admin/notifications-sse');
          
          eventSource.onmessage = (event) => {
            try {
              const newTxListObj = JSON.parse(event.data) as DBTransaction;
              console.log('[SSE Real-time notification received]:', newTxListObj);
              
              // Auditory notification buzzer simulation
              playChimeNotification();

              // Push into live banner list
              setAdminNotifications(prev => [newTxListObj, ...prev]);

              // Refresh current table transactions
              fetchAdminTransactions();
            } catch (error) {
              console.error('[SSE event source failure]:', error);
            }
          };

          eventSource.onerror = (err) => {
            console.warn('Admin SSE notification stream paused or reconnecting...', err);
          };
        } catch (err) {
          console.warn('EventSource initialization bypassed: ', err);
        }
      }
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [user, transactions.length]);

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
      alert('Veuillez saisir un motif de rejet/annulation de la demande.');
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
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Erreur lors de la mise à jour de la transaction.");
    }
  };

  // Action: Admin updates platform setting / banner config
  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedConfig = await dbService.updateConfig(configForm);
      setConfig(updatedConfig);
      alert('Configuration de StarBetPay enregistrée avec succès.');
      fetchAppConfigAndData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erreur lors de la mise à jour.');
    }
  };

  // Action: Admin adds a new payment method
  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMethodForm.name || !paymentMethodForm.number) {
      alert('Veuillez remplir les champs Nom et Numéro de dépôt');
      return;
    }

    try {
      const pms = await dbService.addOrUpdatePaymentMethod(paymentMethodForm.name, paymentMethodForm.number);
      setPaymentMethods(pms);
      setPaymentMethodForm({ name: '', number: '' });
      alert('Nouveau moyen de de paiement enregistré.');
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Erreur lors de l'enregistrement.");
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

  // Action: Admin registers manual coupon updates (title, confidence, totalCote, match rows)
  const handleSaveManualCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const updatedCoupons = await dbService.updateCoupon({
        id: couponEditForm.id,
        title: couponEditForm.title,
        confidence: couponEditForm.confidence,
        totalCote: Number(couponEditForm.totalCote),
        status: couponEditForm.status || 'pending',
        matches: couponEditForm.matches.map((m, idx) => ({
          id: idx + 1,
          homeTeam: m.homeTeam.trim(),
          awayTeam: m.awayTeam.trim(),
          prediction: m.prediction.trim(),
          odd: Number(m.odd),
          status: m.status || 'pending'
        }))
      });
      setCoupons(updatedCoupons);
      alert("Le coupon a été enregistré et publié avec succès !");
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Erreur lors de l'enregistrement du coupon.");
    } finally {
      setFormLoading(false);
    }
  };

  // Action: Set active coupon result (won / lost / pending)
  const handleSetCouponResult = async (status: 'won' | 'lost' | 'pending') => {
    if (!window.confirm("Voulez-vous vraiment mettre à jour le statut de ce coupon ?")) {
      return;
    }
    setFormLoading(true);
    try {
      const data = await dbService.setCouponResult(selectedCouponId, status);
      setCoupons(data.coupons);
      setPastCoupons(data.pastCoupons);
      setCouponEditForm(prev => ({ ...prev, status }));
      alert(`Le coupon a été enregistré à son nouvel état avec succès !`);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Erreur de connexion.");
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
                  const todayStr = new Date().toLocaleDateString('fr-FR');
                  const userTodayDeposits = transactions
                    .filter(t => t.type === 'deposit' && t.status === 'validated' && t.date?.includes(todayStr))
                    .reduce((sum, t) => sum + t.amount, 0);

                  const hasPremiumAccess = userTodayDeposits >= 1000 || user?.role === 'admin';

                  const totalPastCount = pastCoupons.length;
                  const wonPastCount = pastCoupons.filter(c => c.status === 'won').length;
                  const successRate = totalPastCount > 0 ? Math.round((wonPastCount / totalPastCount) * 100) : 85;

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

                      {/* Coupons du Jour list */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                          <span className="font-extrabold font-display text-xs uppercase tracking-wider text-gray-300">Coupons du Jour 🔥</span>
                          <span className="text-[10px] text-cyan-400 font-bold bg-[#111a33] px-2 py-0.5 rounded border border-slate-800">Cote 2 public • Côte 5 & 10 privés</span>
                        </div>

                        {coupons.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 text-xs border border-dashed border-slate-800 rounded-2xl">
                            Aucun coupon publié pour aujourd'hui.
                          </div>
                        ) : (
                          coupons.map((coupon) => {
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
                            {pastCoupons.map((coup, idx) => (
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
                                        : 'bg-red-500/15 text-red-400 border border-red-500/25'
                                    }`}>
                                      {coup.status === 'won' ? 'GAGNÉ' : 'PERDU'}
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
                    { id: 'deposits', label: 'Dépôts' },
                    { id: 'withdrawals', label: 'Retraits' },
                    { id: 'gains', label: 'Gains' },
                    { id: 'pronos', label: 'Pronos' },
                    { id: 'config', label: 'Config' }
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
                      filteredTransactions.map((tx) => (
                        <div key={tx.id} className="bg-[#111a33] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-base font-extrabold font-mono text-[#00f0ff]">{tx.amount.toLocaleString()} FCFA</p>
                              <p className="text-[11px] font-semibold text-gray-300 mt-0.5">{tx.userName} • {tx.userPhone}</p>
                              <p className="text-[10px] text-cyan-400 font-semibold mt-1">Compte 1xBet : {tx.xbetAccount}</p>
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono">{tx.date}</span>
                          </div>

                          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-[11px] text-gray-300 space-y-2">
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
                                  className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold transition-opacity text-cyan-400 gap-1"
                                >
                                  <Eye size={16} />
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
                      ))
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
                      filteredTransactions.map((tx) => (
                        <div key={tx.id} className="bg-[#111a33] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-base font-extrabold font-mono text-pink-400">{tx.amount.toLocaleString()} FCFA</p>
                              <p className="text-[11px] font-semibold text-gray-300 mt-0.5">{tx.userName} • {tx.userPhone}</p>
                              {tx.type === 'commission_payout' && (
                                <span className="text-[9px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded mt-1.5 block w-fit">Retrait de Commission</span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono">{tx.date}</span>
                          </div>

                          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-[11px] text-gray-300 space-y-2">
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
                                    className="w-1/2 py-2 border border-red-500/30 hover:bg-red-500/10 text-red-500 text-xs font-bold rounded-xl transition-all"
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
                                    className="w-1/2 py-1.5 bg-red-950/50 hover:bg-red-900/60 border border-red-500/30 text-xs text-red-00 font-bold rounded-xl transition-all"
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
                      ))
                    )}
                  </div>
                )}

                {/* 3. ADMINISTRATION: PLATFORM GAINS & ANALYTICS VIEW */}
                {adminTab === 'gains' && (
                  <div className="space-y-5 animate-fade-in">
                    <h3 className="text-sm font-extrabold uppercase font-display tracking-wider text-gray-200">Rapport de Gains analytiques</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#111a33] border border-slate-800 rounded-2xl p-4">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Volume Dépôts validés</p>
                        <p className="text-lg font-black font-mono text-[#00f0ff]">{depositTotalVolume.toLocaleString()} F</p>
                      </div>

                      <div className="bg-[#111a33] border border-slate-800 rounded-2xl p-4">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Volume Retraits validés</p>
                        <p className="text-lg font-black font-mono text-pink-400">{withdrawalTotalVolume.toLocaleString()} F</p>
                      </div>

                      <div className="bg-[#111a33] border border-slate-800 rounded-2xl p-4">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Commissions Versées</p>
                        <p className="text-lg font-black font-mono text-yellow-500">{totalCommissionDisbursed.toLocaleString()} F</p>
                      </div>

                      <div className="bg-[#111a33] border border-slate-800 rounded-2xl p-4">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Revenus d'opérations (est.)</p>
                        <p className="text-lg font-black font-mono text-white">{platformRevenue.toLocaleString()} F</p>
                      </div>
                    </div>

                    {/* Operational chart visualizer */}
                    <div className="bg-[#111a33] border border-slate-800 rounded-2xl p-4">
                      <h4 className="text-xs font-bold text-gray-300 mb-3">Flux d'opérations validées</h4>
                      <div className="h-32 flex items-end justify-between gap-4 pt-4 px-2">
                        <div className="flex-1 flex flex-col items-center gap-1.5">
                          <div className="w-full bg-[#1b2b52] rounded shadow-inner relative" style={{ height: `${Math.min(100, Math.max(20, depositTotalVolume / 3000))}px` }}>
                            <div className="absolute inset-0 bg-cyan-400 opacity-20 rounded" />
                          </div>
                          <span className="text-[9px] text-gray-400 font-semibold font-display">Dépôts</span>
                        </div>

                        <div className="flex-1 flex flex-col items-center gap-1.5">
                          <div className="w-full bg-[#1b2b52] rounded shadow-inner relative" style={{ height: `${Math.min(100, Math.max(20, withdrawalTotalVolume / 3000))}px` }}>
                            <div className="absolute inset-0 bg-pink-400 opacity-20 rounded" />
                          </div>
                          <span className="text-[9px] text-gray-400 font-semibold font-display">Retraits</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. ADMINISTRATION: MANUAL PRONOS MANAGEMENT PANEL */}
                {adminTab === 'pronos' && (() => {
                  const addMatchRow = () => {
                    setCouponEditForm(prev => ({
                      ...prev,
                      matches: [...prev.matches, { homeTeam: '', awayTeam: '', prediction: '', odd: 1.5 }]
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
                            <h4 className="text-sm font-bold text-white">Gestionnaire de Pronostics Sportifs</h4>
                            <p className="text-[10px] text-gray-400">Modifiez les coupons du jour et validez les résultats après le match.</p>
                          </div>
                        </div>
                      </div>

                      {/* Select active coupon tab */}
                      <div className="bg-[#111a33] border border-slate-800 rounded-3xl p-4 space-y-3">
                        <label className="block text-gray-300 text-[11px] font-black uppercase tracking-wider">Sélectionner le Coupon à administrer :</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'secured', name: 'Côte 2', badge: 'Public' },
                            { id: 'medium', name: 'Côte 5', badge: 'Minimum 1000F' },
                            { id: 'bold', name: 'Côte 10', badge: 'Minimum 1000F' }
                          ].map((choice) => (
                            <button
                              key={choice.id}
                              type="button"
                              onClick={() => setSelectedCouponId(choice.id)}
                              className={`py-2 px-3 rounded-xl border text-center transition-all flex flex-col justify-center items-center ${
                                selectedCouponId === choice.id
                                  ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-black'
                                  : 'bg-slate-950/60 border-slate-800 text-gray-300 hover:border-slate-700'
                              }`}
                            >
                              <span className="text-xs font-bold">{choice.name}</span>
                              <span className={`text-[8px] mt-0.5 px-1.5 py-0.5 rounded font-mono ${
                                selectedCouponId === choice.id 
                                  ? 'bg-slate-950 text-cyan-400' 
                                  : 'bg-slate-800 text-gray-400'
                              }`}>
                                {choice.badge}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Results scoring configuration block */}
                      <div className="bg-[#111a33] border border-yellow-500/20 rounded-3xl p-5 space-y-3">
                        <div className="flex justify-between items-center pb-1 border-b border-slate-800">
                          <h4 className="text-xs font-extrabold uppercase text-yellow-400 flex items-center gap-1.5">
                            <CheckCircle2 size={14} />
                            Valider le résultat de ce coupon
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            couponEditForm.status === 'won' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : couponEditForm.status === 'lost' 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}>
                            {couponEditForm.status === 'won' ? '✓ GAGNÉ' : couponEditForm.status === 'lost' ? '✗ PERDU' : '⏳ EN COURS'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-300 leading-relaxed">
                          Marquez ce coupon comme GAGNÉ, PERDU ou en cours pour adapter l'historique et les statistiques d'accès.
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => handleSetCouponResult('won')}
                            className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] rounded-xl transition-all shadow-md flex items-center justify-center gap-1"
                          >
                            <CheckCircle2 size={12} />
                            GAGNÉ ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetCouponResult('pending')}
                            className="py-2.5 bg-slate-800 hover:bg-slate-700 text-gray-300 border border-slate-700 font-black text-[11px] rounded-xl transition-all shadow-md flex items-center justify-center gap-1"
                          >
                            <RefreshCw size={12} />
                            EN COURS
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetCouponResult('lost')}
                            className="py-2.5 bg-red-500 hover:bg-red-400 text-white font-black text-[11px] rounded-xl transition-all shadow-md flex items-center justify-center gap-1"
                          >
                            <AlertTriangle size={12} />
                            PERDU ✗
                          </button>
                        </div>
                      </div>

                      {/* Manual configuration editor form */}
                      <form onSubmit={handleSaveManualCoupon} className="bg-[#111a33] border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                        <h4 className="text-xs font-extrabold text-cyan-400 uppercase tracking-widest pb-2 border-b border-slate-800 flex items-center gap-1.5">
                          <Sparkles size={14} />
                          Modifier les détails du coupon
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
                                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
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
                            <p className="text-center py-4 text-xs text-gray-400 italic">Aucun match dans ce coupon. Cliquez sur Ajouter pour en créer un.</p>
                          ) : (
                            <div className="space-y-3">
                              {couponEditForm.matches.map((match, idx) => (
                                <div key={idx} className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 space-y-2.5 relative">
                                  <button
                                    type="button"
                                    onClick={() => removeMatchRow(idx)}
                                    className="absolute top-2 right-2 text-red-400 hover:text-red-300 text-[10px] font-bold"
                                  >
                                    Supprimer
                                  </button>
                                  <span className="text-[10px] text-gray-500 font-mono">Match #{idx+1}</span>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-gray-500 text-[9px] uppercase mb-0.5">Équipe Domicile</label>
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
                                      <label className="block text-gray-500 text-[9px] uppercase mb-0.5">Équipe Extérieur</label>
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
                                      <label className="block text-gray-500 text-[9px] uppercase mb-0.5">Pronostic proposé</label>
                                      <input
                                        type="text"
                                        placeholder="Ex: Vainqueur Real (1)"
                                        value={match.prediction}
                                        onChange={(e) => updateMatchRow(idx, 'prediction', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white font-semibold"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-gray-500 text-[9px] uppercase mb-0.5">Cote</label>
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
                                      <label className="block text-cyan-400 text-[9px] uppercase mb-0.5 font-bold">État Match</label>
                                      <select
                                        value={match.status || 'pending'}
                                        onChange={(e) => updateMatchRow(idx, 'status', e.target.value)}
                                        className={`w-full bg-slate-900 border rounded-lg px-2 py-1 text-[11px] font-bold ${
                                          match.status === 'won' 
                                            ? 'border-emerald-500/45 text-emerald-400' 
                                            : match.status === 'lost' 
                                            ? 'border-red-500/45 text-red-500' 
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

                      {/* Admin validation history timeline view list */}
                      <div className="bg-[#111a33] border border-slate-800 rounded-3xl p-5 space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                          <h4 className="text-xs font-extrabold uppercase text-gray-300">Archives de validation</h4>
                          <button
                            onClick={handleClearHistory}
                            className="text-[10px] text-red-400 hover:underline font-bold"
                          >
                            Réinitialiser l'historique
                          </button>
                        </div>

                        {pastCoupons.length === 0 ? (
                          <div className="text-center py-4 text-xs text-gray-500 italic">Aucun historique enregistré pour le moment.</div>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {pastCoupons.map((c) => (
                              <div key={c.id} className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-900 flex justify-between items-center text-[11px]">
                                <div>
                                  <p className="font-extrabold text-gray-200">{c.title}</p>
                                  <p className="text-[10px] text-gray-500">{c.date || 'Archives'} • Cote {c.totalCote.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    c.status === 'won' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                  }`}>
                                    {c.status === 'won' ? 'GAGNÉ' : 'PERDU'}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteHistoryItem(c.id)}
                                    className="text-red-400 hover:text-red-300 ml-1"
                                    title="Supprimer de l'historique"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

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
          title="Contacter le Support"
          className="fixed bottom-20 right-1/2 translate-x-[180px] z-50 w-12 h-12 rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-xl flex items-center justify-center transition-transform hover:scale-110 shadow-emerald-500/10 cursor-pointer animate-bounce"
        >
          <Phone size={22} fill="currentColor" />
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
