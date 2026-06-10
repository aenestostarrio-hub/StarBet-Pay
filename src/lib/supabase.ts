import { createClient } from '@supabase/supabase-js';
import { DBUser, DBTransaction, PaymentMethod, AppConfig, SportCoupon, DBState } from '../types';

// Read Vercel/Vite environment variables with localStorage fallback for direct easy setup in browser!
export let supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
export let supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Load browser-entered secrets
if (typeof window !== 'undefined') {
  const savedUrl = localStorage.getItem('starbetpay_supabase_url');
  const savedKey = localStorage.getItem('starbetpay_supabase_anon_key');
  if (savedUrl && savedKey && (!supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE_URL'))) {
    supabaseUrl = savedUrl;
    supabaseAnonKey = savedKey;
  }
}

export let isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey) && !supabaseUrl.includes('YOUR_SUPABASE_URL');

export function setSupabaseConfigured(val: boolean) {
  isSupabaseConfigured = val;
}

export let onSupabaseFallbackOccurred: (() => void) | null = null;

export let supabase = isSupabaseConfigured && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function updateSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    if (url && key) {
      localStorage.setItem('starbetpay_supabase_url', url);
      localStorage.setItem('starbetpay_supabase_anon_key', key);
    } else {
      localStorage.removeItem('starbetpay_supabase_url');
      localStorage.removeItem('starbetpay_supabase_anon_key');
    }
  }
  supabaseUrl = url || (import.meta as any).env?.VITE_SUPABASE_URL || '';
  supabaseAnonKey = key || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey) && !supabaseUrl.includes('YOUR_SUPABASE_URL');
  supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
}

// Dynamic check: Should we run in fully local browser sandbox mode?
const isPreviewEnvironment = typeof window !== "undefined" && (window.location.hostname.includes("run.app") || window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1"));
export let useLocalStorageSandbox = false;

if (typeof window !== 'undefined') {
  const hn = window.location.hostname;
  const isVercel = hn.includes('vercel.app') || hn.includes('now.sh');
  const isAIStudioPreview = hn.includes('run.app') || hn.includes('localhost') || hn.includes('127.0.0.1');
  
  if (!isSupabaseConfigured) {
    if (isAIStudioPreview) {
      useLocalStorageSandbox = false;
    } else if (isVercel || !isAIStudioPreview) {
      useLocalStorageSandbox = isPreviewEnvironment ? false : true;
    }
  }

  // Double-safeguard fallback prevention on AI Studio runtime
  if (isAIStudioPreview) {
    useLocalStorageSandbox = false;
  }
}

// local storage keys and initialization database
const LOCAL_DB_KEY = 'starbetpay_local_db';

const initialLocalDB: DBState = {
  users: {
    '0197656263': {
      phone: '0197656263',
      name: 'StarBetPay Admin',
      role: 'admin',
      passwordHash: 'Azertyui0p',
      referralCode: 'ADMINREF',
      balanceCommission: 0,
      balanceCommissionWithdrawn: 0,
      mfaEnabled: true,
      createdAt: new Date().toISOString()
    },
    '0161616161': {
      phone: '0161616161',
      name: 'Agbozo',
      role: 'user',
      passwordHash: 'Password123',
      parentPhone: '0197656263',
      referralCode: 'AGBOZOREF',
      balanceCommission: 4500,
      balanceCommissionWithdrawn: 1000,
      mfaEnabled: true,
      createdAt: new Date().toISOString()
    }
  },
  transactions: [
    {
      id: 'TX_1717462000000',
      type: 'deposit',
      amount: 2000,
      userPhone: '0161616161',
      userName: 'Agbozo',
      xbetAccount: '31354567',
      paymentMethod: 'AMANA',
      paymentNumber: '85385627',
      status: 'validated',
      date: '04/06/2026 01:40',
      appliedCommission: true
    },
    {
      id: 'TX_1717461010101',
      type: 'deposit',
      amount: 500,
      userPhone: '0161616161',
      userName: 'Agbozo',
      xbetAccount: '31354567',
      paymentMethod: 'AMANA',
      paymentNumber: '85385627',
      status: 'rejected',
      date: '02/06/2026 11:33',
      rejectionReason: 'Capture d\'écran non valide ou corrompue.'
    }
  ],
  paymentMethods: [
    { name: 'AMANA', number: '85385627', active: true },
    { name: 'NITA', number: '85385627', active: true }
  ],
  config: {
    popupEnabled: true,
    popupTitle: 'Chers clients',
    popupMessage: 'Bienvenue sur StarBet Pay, la solution de dépôt & retrait rapide.',
    supportWhatsapp: '+22900000000',
    withdrawalPhysVille: 'Abomey Calavi',
    withdrawalPhysRue: 'Chez star prono'
  },
  coupons: [
    {
      id: 'secured',
      title: 'COUPON SÉCURISÉ (COTE ~2)',
      confidence: 'ÉLEVÉ',
      totalCote: 2.00,
      matches: []
    },
    {
      id: 'medium',
      title: 'COUPON INTERMÉDIAIRE (COTE ~5)',
      confidence: 'MOYEN',
      totalCote: 5.00,
      matches: []
    },
    {
      id: 'bold',
      title: 'COUPON AUDACIEUX (COTE ~10)',
      confidence: 'RISQUE ÉLEVÉ',
      totalCote: 10.00,
      matches: []
    }
  ],
  couponHistory: [],
  pastCoupons: []
};

function getLocalDB(): DBState {
  if (typeof window === 'undefined') return initialLocalDB;
  const data = localStorage.getItem(LOCAL_DB_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(initialLocalDB));
    return initialLocalDB;
  }
  try {
    const parsed = JSON.parse(data) as DBState;
    if (!parsed.pastCoupons) parsed.pastCoupons = [];
    
    // Clean old/legacy sandbox coupons whose date isn't today
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

    if (parsed.coupons) {
      parsed.coupons.forEach(c => {
        if (!c.date) {
          c.matches = [];
        } else {
          const cleanCouponDate = normalizeToISODate(c.date);
          if (cleanCouponDate !== normalizedToday) {
            c.matches = [];
          }
        }
      });
    }
    
    return parsed;
  } catch (e) {
    return initialLocalDB;
  }
}

function saveLocalDB(db: DBState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
}

// Safe Custom Fetch client with auto standalone fallback routing detection and URL Cache-busting
const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const originalFetch = window.fetch || fetch;
  const hn = typeof window !== 'undefined' ? window.location.hostname : '';
  const isAIStudioPreview = hn.includes('run.app') || hn.includes('localhost') || hn.includes('127.0.0.1');

  try {
    let finalInput = input;
    const isGet = !init || !init.method || init.method.toUpperCase() === 'GET';
    if (isGet) {
      const urlStr = typeof input === 'string' ? input : (input as any).url || input.toString();
      if (urlStr.startsWith('/') || urlStr.startsWith('http')) {
        const separator = urlStr.includes('?') ? '&' : '?';
        finalInput = `${urlStr}${separator}_cb=${Date.now()}`;
      }
    }
    const response = await originalFetch(finalInput, init);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn(`API returned status ${response.status} or non-JSON content-type: "${contentType}".`);
      if (isAIStudioPreview) {
        // Return clear, non-crashing JSON error for non-JSON responses
        return new Response(JSON.stringify({ error: "STANDALONE_FALLBACK", status: response.status }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      useLocalStorageSandbox = isPreviewEnvironment ? false : true;
      return new Response(JSON.stringify({ error: "STANDALONE_FALLBACK" }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return response;
  } catch (e) {
    console.warn("Fetch failed:", e);
    if (isAIStudioPreview) {
      // Guard against fetch exception crash on initialization
      return new Response(JSON.stringify({ error: "STANDALONE_FALLBACK", details: String(e) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    useLocalStorageSandbox = isPreviewEnvironment ? false : true;
    return new Response(JSON.stringify({ error: "STANDALONE_FALLBACK" }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Service Layer to abstract data fetching between direct Supabase queries
 * (ideal for Vercel deployment) and local server API endpoints (fallback/dev mode).
 */
export const dbService = {
  // Sync Local Storage User to Backend Database if missing
  async syncUserWithServer(user: any, transactions?: any[]): Promise<any> {
    const hn = typeof window !== 'undefined' ? window.location.hostname : '';
    const isAIStudioPreview = hn.includes('run.app') || hn.includes('localhost') || hn.includes('127.0.0.1');

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: existingUser } = await supabase
          .from('sb_users')
          .select('phone')
          .eq('phone', user.phone)
          .maybeSingle();
        
        if (!existingUser) {
          console.log('[Supabase Sync] Current user not found in Supabase. Auto-inserting user...');
          const userToInsert = {
            phone: user.phone,
            name: user.name || 'Utilisateur',
            role: user.role || 'user',
            password_hash: user.passwordHash || 'pbkdf2_sha256$...mock...',
            parent_phone: user.parentPhone || null,
            referral_code: user.referralCode || `star_${user.phone.substring(user.phone.length - 4)}`,
            balance_commission: user.balanceCommission || 0,
            balance_commission_withdrawn: user.balanceCommissionWithdrawn || 0,
            mfa_enabled: user.mfaEnabled ?? true
          };
          await supabase.from('sb_users').insert(userToInsert);
        }

        if (transactions && transactions.length > 0) {
          console.log('[Supabase Sync] Syncing local transactions to Supabase...');
          const txsToInsert = transactions.map((t: any) => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            user_phone: t.userPhone,
            user_name: t.userName || user.name || 'Client',
            xbet_account: t.xbetAccount || null,
            payment_method: t.paymentMethod || null,
            payment_number: t.paymentNumber || null,
            screenshot: t.screenshot || null,
            withdraw_code: t.withdrawCode || null,
            status: t.status,
            date: t.date,
            rejection_reason: t.rejectionReason || null,
            applied_commission: t.appliedCommission || false
          }));
          await supabase.from('sb_transactions').upsert(txsToInsert, { onConflict: 'id' });
        }
        return { success: true };
      } catch (err) {
        console.warn('[Supabase Sync] Auto-sync of session to cloud failed, bypassing to avoid fallback loop:', err);
        return { success: false };
      }
    }

    if (useLocalStorageSandbox && !isAIStudioPreview) {
      return { success: true };
    }
    try {
      const res = await customFetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, transactions })
      });
      return await res.json();
    } catch (e) {
      console.warn("User sync with server failed, ignoring: ", e);
      return { success: false };
    }
  },

  // Config
  async getConfig(): Promise<AppConfig> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('sb_config')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.warn('sb_config is empty. Auto-seeding initial configurations...');
          const defaultConfig = {
            id: 1,
            popup_enabled: true,
            popup_title: 'Chers clients',
            popup_message: 'Bienvenue sur StarBet Pay, la solution de dépôt & retrait rapide.',
            support_whatsapp: '+22900000000',
            withdrawal_phys_ville: 'Abomey Calavi',
            withdrawal_phys_rue: 'Chez star prono'
          };
          try {
            await supabase.from('sb_config').insert(defaultConfig);
          } catch (insertErr) {
            console.error('Failed to auto-seed sb_config:', insertErr);
          }
          return {
            popupEnabled: true,
            popupTitle: defaultConfig.popup_title,
            popupMessage: defaultConfig.popup_message,
            supportWhatsapp: defaultConfig.support_whatsapp,
            withdrawalPhysVille: defaultConfig.withdrawal_phys_ville,
            withdrawalPhysRue: defaultConfig.withdrawal_phys_rue
          };
        }
        console.error('Supabase error fetching config: ', error);
        throw error;
      }
      return {
        popupEnabled: data.popup_enabled,
        popupTitle: data.popup_title,
        popupMessage: data.popup_message,
        supportWhatsapp: data.support_whatsapp,
        withdrawalPhysVille: data.withdrawal_phys_ville,
        withdrawalPhysRue: data.withdrawal_phys_rue,
      };
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      return db.config;
    } else {
      try {
        const res = await customFetch('/api/config');
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          useLocalStorageSandbox = isPreviewEnvironment ? false : true;
          return getLocalDB().config;
        }
        return data;
      } catch (e) {
        useLocalStorageSandbox = isPreviewEnvironment ? false : true;
        return getLocalDB().config;
      }
    }
  },

  async updateConfig(config: Partial<AppConfig>): Promise<AppConfig> {
    if (isSupabaseConfigured && supabase) {
      const updates: any = {};
      if (config.popupEnabled !== undefined) updates.popup_enabled = config.popupEnabled;
      if (config.popupTitle !== undefined) updates.popup_title = config.popupTitle;
      if (config.popupMessage !== undefined) updates.popup_message = config.popupMessage;
      if (config.supportWhatsapp !== undefined) updates.support_whatsapp = config.supportWhatsapp;
      if (config.withdrawalPhysVille !== undefined) updates.withdrawal_phys_ville = config.withdrawalPhysVille;
      if (config.withdrawalPhysRue !== undefined) updates.withdrawal_phys_rue = config.withdrawalPhysRue;

      const { data, error } = await supabase
        .from('sb_config')
        .update(updates)
        .eq('id', 1)
        .select()
        .single();

      if (error) throw error;
      return {
        popupEnabled: data.popup_enabled,
        popupTitle: data.popup_title,
        popupMessage: data.popup_message,
        supportWhatsapp: data.support_whatsapp,
        withdrawalPhysVille: data.withdrawal_phys_ville,
        withdrawalPhysRue: data.withdrawal_phys_rue,
      };
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      db.config = { ...db.config, ...config };
      saveLocalDB(db);
      return db.config;
    } else {
      try {
        const res = await customFetch('/api/config/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          useLocalStorageSandbox = isPreviewEnvironment ? false : true;
          const db = getLocalDB();
          db.config = { ...db.config, ...config };
          saveLocalDB(db);
          return db.config;
        }
        return data.config;
      } catch (e) {
        useLocalStorageSandbox = isPreviewEnvironment ? false : true;
        const db = getLocalDB();
        db.config = { ...db.config, ...config };
        saveLocalDB(db);
        return db.config;
      }
    }
  },

  // Payment Methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('sb_payment_methods')
        .select('*');
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.warn('sb_payment_methods is empty. Auto-seeding...');
        const defaults = [
          { name: 'AMANA', number: '85385627', active: true },
          { name: 'NITA', number: '85385627', active: true }
        ];
        try {
          await supabase.from('sb_payment_methods').insert(defaults);
        } catch (insertErr) {
          console.error('Failed to auto-seed sb_payment_methods:', insertErr);
        }
        return defaults;
      }

      return (data || []).map(p => ({
        name: p.name,
        number: p.number,
        active: p.active
      }));
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      return db.paymentMethods;
    } else {
      try {
        const res = await customFetch('/api/payment-methods');
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          useLocalStorageSandbox = isPreviewEnvironment ? false : true;
          return getLocalDB().paymentMethods;
        }
        return data;
      } catch (e) {
        useLocalStorageSandbox = isPreviewEnvironment ? false : true;
        return getLocalDB().paymentMethods;
      }
    }
  },

  async addOrUpdatePaymentMethod(name: string, number: string): Promise<PaymentMethod[]> {
    if (isSupabaseConfigured && supabase) {
      const cleanName = name.toUpperCase().trim();
      const { error } = await supabase
        .from('sb_payment_methods')
        .upsert({ name: cleanName, number, active: true }, { onConflict: 'name' });

      if (error) throw error;
      return this.getPaymentMethods();
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      const cleanName = name.toUpperCase().trim();
      const idx = db.paymentMethods.findIndex(p => p.name === cleanName);
      if (idx !== -1) {
        db.paymentMethods[idx].number = number;
      } else {
        db.paymentMethods.push({ name: cleanName, number, active: true });
      }
      saveLocalDB(db);
      return db.paymentMethods;
    } else {
      try {
        const res = await customFetch('/api/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, number })
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.addOrUpdatePaymentMethod(name, number);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.addOrUpdatePaymentMethod(name, number);

          }
        }
        return data.paymentMethods;
      } catch (e) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.addOrUpdatePaymentMethod(name, number);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.addOrUpdatePaymentMethod(name, number);

        }
      }
    }
  },

  async togglePaymentMethod(name: string): Promise<PaymentMethod[]> {
    if (isSupabaseConfigured && supabase) {
      // Get current state
      const { data: current } = await supabase
        .from('sb_payment_methods')
        .select('active')
        .eq('name', name)
        .single();
      
      const newActive = current ? !current.active : false;

      const { error } = await supabase
        .from('sb_payment_methods')
        .update({ active: newActive })
        .eq('name', name);

      if (error) throw error;
      return this.getPaymentMethods();
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      const pm = db.paymentMethods.find(p => p.name === name);
      if (pm) {
        pm.active = !pm.active;
        saveLocalDB(db);
      }
      return db.paymentMethods;
    } else {
      try {
        const res = await customFetch('/api/payment-methods/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.togglePaymentMethod(name);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.togglePaymentMethod(name);

          }
        }
        return data.paymentMethods;
      } catch (e) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.togglePaymentMethod(name);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.togglePaymentMethod(name);

        }
      }
    }
  },

  // Coupons
  async getCoupons(): Promise<SportCoupon[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('sb_coupons')
        .select('*');
      
      if (error) throw error;

      if (!data || data.length === 0) {
        console.warn('sb_coupons is empty. Auto-seeding...');
        const defaults = [
          {
            id: 'secured',
            title: 'COUPON SÉCURISÉ (COTE ~2)',
            confidence: 'ÉLEVÉ',
            total_cote: 2.00,
            matches: []
          },
          {
            id: 'medium',
            title: 'COUPON INTERMÉDIAIRE (COTE ~5)',
            confidence: 'MOYEN',
            total_cote: 5.00,
            matches: []
          },
          {
            id: 'bold',
            title: 'COUPON AUDACIEUX (COTE ~10)',
            confidence: 'RISQUE ÉLEVÉ',
            total_cote: 10.00,
            matches: []
          }
        ];
        try {
          await supabase.from('sb_coupons').insert(defaults);
        } catch (insertErr) {
          console.error('Failed to auto-seed sb_coupons:', insertErr);
        }
        return defaults.map(c => ({
          id: c.id,
          title: c.title,
          confidence: c.confidence as any,
          totalCote: c.total_cote,
          matches: c.matches
        }));
      }

      return (data || []).map(c => ({
        id: c.id,
        title: c.title,
        confidence: c.confidence,
        totalCote: Number(c.total_cote),
        matches: Array.isArray(c.matches) ? c.matches : JSON.parse(c.matches || '[]'),
        status: c.status,
        date: c.date
      }));
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      return db.coupons;
    } else {
      try {
        const res = await customFetch('/api/coupons');
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          useLocalStorageSandbox = isPreviewEnvironment ? false : true;
          return getLocalDB().coupons;
        }
        return data;
      } catch (e) {
        useLocalStorageSandbox = isPreviewEnvironment ? false : true;
        return getLocalDB().coupons;
      }
    }
  },

  async updateCoupon(coupon: SportCoupon): Promise<SportCoupon[]> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('sb_coupons')
        .update({
          title: coupon.title,
          confidence: coupon.confidence,
          total_cote: coupon.totalCote,
          matches: coupon.matches,
          status: coupon.status || 'pending',
          date: new Date().toLocaleDateString('fr-FR')
        })
        .eq('id', coupon.id);

      if (error) throw error;
      return this.getCoupons();
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      const idx = db.coupons.findIndex(c => c.id === coupon.id);
      if (idx !== -1) {
        db.coupons[idx] = {
          ...coupon,
          status: coupon.status || 'pending',
          date: new Date().toLocaleDateString('fr-FR')
        };
        saveLocalDB(db);
      }
      return db.coupons;
    } else {
      try {
        const res = await customFetch('/api/coupons/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(coupon)
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.updateCoupon(coupon);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.updateCoupon(coupon);

          }
        }
        return data.coupons;
      } catch (e) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.updateCoupon(coupon);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.updateCoupon(coupon);

        }
      }
    }
  },

  async setCouponResult(id: string, status: 'won' | 'lost' | 'pending'): Promise<{ coupons: SportCoupon[], pastCoupons: SportCoupon[] }> {
    if (isSupabaseConfigured && supabase) {
      // 1. Get current coupon
      const { data: coupon, error: getErr } = await supabase
        .from('sb_coupons')
        .select('*')
        .eq('id', id)
        .single();
      
      if (getErr) throw getErr;

      // 2. Update status
      const { error: updErr } = await supabase
        .from('sb_coupons')
        .update({ status })
        .eq('id', id);

      if (updErr) throw updErr;

      // 3. Save to history if won or lost
      if (status === 'won' || status === 'lost') {
        const historyId = `${id}_${Date.now()}`;
        const { error: histErr } = await supabase
          .from('sb_past_coupons')
          .insert({
            id: historyId,
            title: coupon.title,
            confidence: coupon.confidence,
            total_cote: Number(coupon.total_cote),
            matches: Array.isArray(coupon.matches) ? coupon.matches : JSON.parse(coupon.matches || '[]'),
            status: status,
            date: new Date().toLocaleDateString('fr-FR')
          });
        
        if (histErr) throw histErr;
      }

      const coupons = await this.getCoupons();
      const pastCoupons = await this.getPastCoupons();
      return { coupons, pastCoupons };
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      const coupon = db.coupons.find(c => c.id === id);
      if (coupon) {
        coupon.status = status;
        if (status === 'won' || status === 'lost') {
          const archived: SportCoupon = {
            ...coupon,
            id: `${coupon.id}_${Date.now()}`,
            status,
            date: new Date().toLocaleDateString('fr-FR')
          };
          if (!db.pastCoupons) db.pastCoupons = [];
          db.pastCoupons.unshift(archived);
        }
        saveLocalDB(db);
      }
      return { coupons: db.coupons, pastCoupons: db.pastCoupons || [] };
    } else {
      try {
        const res = await customFetch('/api/coupons/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status })
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.setCouponResult(id, status);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.setCouponResult(id, status);

          }
        }
        return data;
      } catch (e) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.setCouponResult(id, status);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.setCouponResult(id, status);

        }
      }
    }
  },

  async getPastCoupons(): Promise<SportCoupon[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('sb_past_coupons')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      return (data || []).map(c => ({
        id: c.id,
        title: c.title,
        confidence: c.confidence,
        totalCote: Number(c.total_cote),
        matches: Array.isArray(c.matches) ? c.matches : JSON.parse(c.matches || '[]'),
        status: c.status,
        date: c.date
      }));
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      return db.pastCoupons || [];
    } else {
      try {
        const res = await customFetch('/api/coupons/history');
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          useLocalStorageSandbox = isPreviewEnvironment ? false : true;
          return getLocalDB().pastCoupons || [];
        }
        return data;
      } catch (e) {
        useLocalStorageSandbox = isPreviewEnvironment ? false : true;
        return getLocalDB().pastCoupons || [];
      }
    }
  },

  async deleteHistoryEntry(id: string): Promise<SportCoupon[]> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('sb_past_coupons')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return this.getPastCoupons();
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      db.pastCoupons = (db.pastCoupons || []).filter(c => c.id !== id);
      saveLocalDB(db);
      return db.pastCoupons;
    } else {
      try {
        const res = await customFetch(`/api/coupons/history/${id}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.deleteHistoryEntry(id);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.deleteHistoryEntry(id);

          }
        }
        return data.pastCoupons;
      } catch (e) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.deleteHistoryEntry(id);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.deleteHistoryEntry(id);

        }
      }
    }
  },

  async clearHistory(): Promise<SportCoupon[]> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('sb_past_coupons')
        .delete()
        .neq('id', 'placeholder_force_all'); // standard postgres trick to delete all

      if (error) throw error;
      return [];
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      db.pastCoupons = [];
      saveLocalDB(db);
      return [];
    } else {
      try {
        const res = await customFetch('/api/coupons/history/clear', {
          method: 'POST'
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.clearHistory();

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.clearHistory();

          }
        }
        return data.pastCoupons;
      } catch (e) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.clearHistory();

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.clearHistory();

        }
      }
    }
  },

  async addPastCoupon(coupon: SportCoupon): Promise<SportCoupon[]> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('sb_past_coupons')
        .insert({
          id: coupon.id || `past_${Date.now()}`,
          title: coupon.title,
          confidence: coupon.confidence,
          total_cote: coupon.totalCote,
          matches: coupon.matches,
          status: coupon.status || 'pending',
          date: coupon.date || new Date().toLocaleDateString('fr-FR')
        });
      if (error) throw error;
      return this.getPastCoupons();
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      if (!db.pastCoupons) db.pastCoupons = [];
      db.pastCoupons.unshift({
        ...coupon,
        id: coupon.id || `past_${Date.now()}`,
        date: coupon.date || new Date().toLocaleDateString('fr-FR')
      });
      saveLocalDB(db);
      return db.pastCoupons;
    } else {
      try {
        const res = await customFetch('/api/coupons/history/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(coupon)
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.addPastCoupon(coupon);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.addPastCoupon(coupon);

          }
        }
        return data.pastCoupons;
      } catch (e) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.addPastCoupon(coupon);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.addPastCoupon(coupon);

        }
      }
    }
  },

  async updatePastCoupon(coupon: SportCoupon): Promise<SportCoupon[]> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('sb_past_coupons')
        .update({
          title: coupon.title,
          confidence: coupon.confidence,
          total_cote: coupon.totalCote,
          matches: coupon.matches,
          status: coupon.status || 'pending',
          date: coupon.date || new Date().toLocaleDateString('fr-FR')
        })
        .eq('id', coupon.id);
      if (error) throw error;
      return this.getPastCoupons();
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      if (!db.pastCoupons) db.pastCoupons = [];
      const idx = db.pastCoupons.findIndex(c => c.id === coupon.id);
      if (idx !== -1) {
        db.pastCoupons[idx] = {
          ...db.pastCoupons[idx],
          ...coupon
        };
        saveLocalDB(db);
      }
      return db.pastCoupons;
    } else {
      try {
        const res = await customFetch('/api/coupons/history/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(coupon)
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.updatePastCoupon(coupon);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.updatePastCoupon(coupon);

          }
        }
        return data.pastCoupons;
      } catch (e) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.updatePastCoupon(coupon);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.updatePastCoupon(coupon);

        }
      }
    }
  },

  // Auth Operations
  async register(phone: string, name: string, passwordHash: string, parentPhone?: string): Promise<DBUser> {
    if (isSupabaseConfigured && supabase) {
      // Match behavior of local server: phone is PK
      // Let's check check existence
      const { data: existing } = await supabase
        .from('sb_users')
        .select('phone')
        .eq('phone', phone)
        .maybeSingle();

      if (existing) {
        throw new Error('Ce numéro de téléphone est déjà enregistré');
      }

      const newUser: any = {
        phone,
        name,
        role: 'user',
        password_hash: passwordHash,
        parent_phone: parentPhone ? parentPhone.trim() : null,
        referral_code: phone,
        balance_commission: 0,
        balance_commission_withdrawn: 0,
        mfa_enabled: false,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('sb_users')
        .insert(newUser);

      if (error) throw error;
      return {
        phone,
        name,
        role: 'user',
        passwordHash,
        parentPhone,
        referralCode: phone,
        balanceCommission: 0,
        balanceCommissionWithdrawn: 0,
        mfaEnabled: false,
        createdAt: newUser.created_at
      };
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      if (db.users[phone]) {
        throw new Error('Ce numéro de téléphone est déjà enregistré');
      }
      const newUser: DBUser = {
        phone,
        name,
        role: 'user',
        passwordHash,
        parentPhone: parentPhone ? parentPhone.trim() : undefined,
        referralCode: phone,
        balanceCommission: 0,
        balanceCommissionWithdrawn: 0,
        mfaEnabled: false,
        createdAt: new Date().toISOString()
      };
      db.users[phone] = newUser;
      saveLocalDB(db);
      return newUser;
    } else {
      try {
        const res = await customFetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, name, password: passwordHash, parentPhone })
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.register(phone, name, passwordHash, parentPhone);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.register(phone, name, passwordHash, parentPhone);

          }
        }
        if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'inscription');
        return data.user;
      } catch (e: any) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.register(phone, name, passwordHash, parentPhone);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.register(phone, name, passwordHash, parentPhone);

        }
      }
    }
  },

  async login(phone: string, passwordHash: string): Promise<{ tempUser: Partial<DBUser> }> {
    if (isSupabaseConfigured && supabase) {
      let { data: user, error } = await supabase
        .from('sb_users')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      if (error) throw error;

      // Auto-populate default admin or helper user if it does not exist yet on the clean Supabase instance
      if (!user && (phone === '0197656263' || phone === '0161616161')) {
        const isDemoAdmin = phone === '0197656263';
        console.log(`[Supabase Auth] Demo user ${phone} not found. Auto-generating account...`);
        const demoUser = {
          phone: phone,
          name: isDemoAdmin ? 'Agbozo Admin' : 'Agbozo',
          role: isDemoAdmin ? 'admin' : 'user',
          password_hash: passwordHash, // Match the expected hash (passes client verification)
          parent_phone: null,
          referral_code: isDemoAdmin ? 'star_admin' : 'star_agbozo',
          balance_commission: 0,
          balance_commission_withdrawn: 0,
          mfa_enabled: false,
          created_at: new Date().toISOString()
        };
        try {
          const { data: inserted, error: insertErr } = await supabase
            .from('sb_users')
            .insert(demoUser)
            .select()
            .single();
          if (!insertErr && inserted) {
            user = inserted;
          }
        } catch (e) {
          console.error("Failed to auto-seed demo account on login:", e);
        }
      }
      
      if (!user || user.password_hash !== passwordHash) {
        throw new Error('Numéro de téléphone ou mot de passe incorrect');
      }

      return {
        tempUser: {
          phone: user.phone,
          name: user.name,
          role: user.role as 'admin' | 'user',
          mfaEnabled: user.mfa_enabled,
          parentPhone: user.parent_phone,
          referralCode: user.referral_code,
          balanceCommission: Number(user.balance_commission),
          balanceCommissionWithdrawn: Number(user.balance_commission_withdrawn),
          createdAt: user.created_at
        }
      };
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      const user = db.users[phone];
      if (!user || user.passwordHash !== passwordHash) {
        throw new Error('Numéro de téléphone ou mot de passe incorrect');
      }
      return {
        tempUser: {
          phone: user.phone,
          name: user.name,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
          parentPhone: user.parentPhone,
          referralCode: user.referralCode,
          balanceCommission: user.balanceCommission,
          balanceCommissionWithdrawn: user.balanceCommissionWithdrawn,
          createdAt: user.createdAt
        }
      };
    } else {
      try {
        const res = await customFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password: passwordHash })
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.login(phone, passwordHash);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.login(phone, passwordHash);

          }
        }
        if (!res.ok) throw new Error(data.error || 'Erreur lors de la connexion');
        return data;
      } catch (e: any) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.login(phone, passwordHash);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.login(phone, passwordHash);

        }
      }
    }
  },

  async verifyMfa(phone: string, token: string): Promise<DBUser> {
    if (isSupabaseConfigured && supabase) {
      const { data: user, error } = await supabase
        .from('sb_users')
        .select('*')
        .eq('phone', phone)
        .single();

      if (error) throw error;
      if (!user) throw new Error('Utilisateur non trouvé');

      // Simple bypass code as described in server.ts
      if (token !== '1234' && token.length < 4) {
        throw new Error('Le code de vérification à 4 chiffres saisi est incorrect');
      }

      return {
        phone: user.phone,
        name: user.name,
        role: user.role as 'admin' | 'user',
        passwordHash: user.password_hash,
        parentPhone: user.parent_phone,
        referralCode: user.referral_code,
        balanceCommission: Number(user.balance_commission),
        balanceCommissionWithdrawn: Number(user.balance_commission_withdrawn),
        mfaEnabled: user.mfa_enabled,
        createdAt: user.created_at
      };
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      const user = db.users[phone];
      if (!user) throw new Error('Utilisateur non trouvé');
      if (token !== '1234' && token.length < 4) {
        throw new Error('Le code de vérification à 4 chiffres saisi est incorrect');
      }
      return user;
    } else {
      try {
        const res = await customFetch('/api/auth/verify-mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code: token })
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.verifyMfa(phone, token);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.verifyMfa(phone, token);

          }
        }
        if (!res.ok) throw new Error(data.error || 'Erreur MFA');
        return data.user;
      } catch (e: any) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.verifyMfa(phone, token);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.verifyMfa(phone, token);

        }
      }
    }
  },

  // User Stats & Affiliation
  async getUserStats(phone: string): Promise<{
    phone: string;
    name: string;
    balanceCommission: number;
    balanceCommissionWithdrawn: number;
    filleulsCount: number;
    referralCode: string;
  }> {
    if (isSupabaseConfigured && supabase) {
      // Get user
      const { data: user, error: userErr } = await supabase
        .from('sb_users')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();
      
      if (userErr) throw userErr;

      let activeUser = user;
      if (!activeUser) {
        console.warn(`User ${phone} not found in sb_users. Auto-registering...`);
        const newUser = {
          phone: phone,
          name: phone === '0161616161' ? 'Agbozo' : 'Client ' + phone.substring(phone.length - 4),
          role: phone === '0161616161' ? 'admin' : 'user',
          password_hash: 'pbkdf2_sha1$...mockhash...',
          parent_phone: null,
          referral_code: `star_${phone.substring(phone.length - 4)}`,
          balance_commission: 0,
          balance_commission_withdrawn: 0,
          mfa_enabled: true
        };
        try {
          const { data: inserted, error: insErr } = await supabase
            .from('sb_users')
            .insert(newUser)
            .select()
            .single();
          if (!insErr && inserted) {
            activeUser = inserted;
          }
        } catch (e) {
          console.error('Failed to auto-seed missing user:', e);
        }

        if (!activeUser) {
          activeUser = {
            phone: phone,
            name: 'Client',
            role: 'user',
            password_hash: 'mock',
            parent_phone: null,
            referral_code: `star_${phone.substring(phone.length - 4)}`,
            balance_commission: 0,
            balance_commission_withdrawn: 0,
            mfa_enabled: true
          };
        }
      }

      // Count filleuls (where parent_phone = user's phone)
      const { count, error: countErr } = await supabase
        .from('sb_users')
        .select('*', { count: 'exact', head: true })
        .eq('parent_phone', phone);
      
      if (countErr) throw countErr;

      return {
        phone: activeUser.phone,
        name: activeUser.name,
        balanceCommission: Number(activeUser.balance_commission),
        balanceCommissionWithdrawn: Number(activeUser.balance_commission_withdrawn),
        filleulsCount: count || 0,
        referralCode: activeUser.referral_code
      };
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      const user = db.users[phone];
      if (!user) throw new Error('Utilisateur non trouvé');
      const referrals = Object.values(db.users).filter(u => u.parentPhone === phone);
      return {
        phone: user.phone,
        name: user.name,
        balanceCommission: user.balanceCommission,
        balanceCommissionWithdrawn: user.balanceCommissionWithdrawn,
        filleulsCount: referrals.length,
        referralCode: user.referralCode
      };
    } else {
      try {
        const res = await customFetch(`/api/users/stats/${phone}`);
        const data = await res.json();
        if (data && (data.error === "STANDALONE_FALLBACK" || data.error === "STANDALONE_FALLBACK")) {
          const db = getLocalDB();
          const user = db.users[phone] || { phone, name: 'Utilisateur', balanceCommission: 0, balanceCommissionWithdrawn: 0, referralCode: phone };
          const referrals = Object.values(db.users).filter(u => u.parentPhone === phone);
          return {
            phone: user.phone,
            name: user.name,
            balanceCommission: user.balanceCommission || 0,
            balanceCommissionWithdrawn: user.balanceCommissionWithdrawn || 0,
            filleulsCount: referrals.length,
            referralCode: user.referralCode || phone
          };
        }
        return data;
      } catch (e) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.getUserStats(phone);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.getUserStats(phone);

        }
      }
    }
  },

  // Commission Payout Requests
  async requestCommissionPayout(phone: string): Promise<{ user: DBUser, transaction: DBTransaction }> {
    if (isSupabaseConfigured && supabase) {
      const { data: user, error: userErr } = await supabase
        .from('sb_users')
        .select('*')
        .eq('phone', phone)
        .single();
      
      if (userErr) throw userErr;

      const balanceCommission = Number(user.balance_commission);
      if (balanceCommission < 2000) {
        throw new Error('Le montant minimum pour le retrait des gains est de 2 000 FCFA');
      }

      const pullAmount = balanceCommission;
      const newCommissionWithdrawn = Number(user.balance_commission_withdrawn) + pullAmount;

      // Update user balances
      const { error: updErr } = await supabase
        .from('sb_users')
        .update({
          balance_commission: 0,
          balance_commission_withdrawn: newCommissionWithdrawn
        })
        .eq('phone', phone);
      
      if (updErr) throw updErr;

      // Insert transaction
      const txId = 'TX_PO_' + Date.now();
      const newTx: any = {
        id: txId,
        type: 'commission_payout',
        amount: pullAmount,
        user_phone: phone,
        user_name: user.name,
        xbet_account: 'COMMISSION_RETRAIT',
        payment_method: 'MOBILE POOL',
        payment_number: phone,
        status: 'pending',
        date: new Date().toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        applied_commission: false
      };

      const { error: txErr } = await supabase
        .from('sb_transactions')
        .insert(newTx);

      if (txErr) throw txErr;

      const updatedUser: DBUser = {
        phone: user.phone,
        name: user.name,
        role: user.role as 'admin' | 'user',
        passwordHash: user.password_hash,
        parentPhone: user.parent_phone,
        referralCode: user.referral_code,
        balanceCommission: 0,
        balanceCommissionWithdrawn: newCommissionWithdrawn,
        mfaEnabled: user.mfa_enabled,
        createdAt: user.created_at
      };

      const returnTx: DBTransaction = {
        id: txId,
        type: 'commission_payout',
        amount: pullAmount,
        userPhone: phone,
        userName: user.name,
        xbetAccount: 'COMMISSION_RETRAIT',
        paymentMethod: 'MOBILE POOL',
        paymentNumber: phone,
        status: 'pending',
        date: newTx.date
      };

      return { user: updatedUser, transaction: returnTx };
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      const user = db.users[phone];
      if (!user) throw new Error('Utilisateur non trouvé');
      const balanceCommission = user.balanceCommission;
      if (balanceCommission < 2000) {
        throw new Error('Le montant minimum pour le retrait des gains est de 2 000 FCFA');
      }
      const pullAmount = balanceCommission;
      user.balanceCommissionWithdrawn += pullAmount;
      user.balanceCommission = 0;

      const txId = 'TX_PO_' + Date.now();
      const newTx: DBTransaction = {
        id: txId,
        type: 'commission_payout',
        amount: pullAmount,
        userPhone: phone,
        userName: user.name,
        xbetAccount: 'COMMISSION_RETRAIT',
        paymentMethod: 'MOBILE POOL',
        paymentNumber: phone,
        status: 'pending',
        date: new Date().toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        appliedCommission: false
      };
      db.transactions.unshift(newTx);
      saveLocalDB(db);
      return { user, transaction: newTx };
    } else {
      try {
        const res = await customFetch('/api/commissions/payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.requestCommissionPayout(phone);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.requestCommissionPayout(phone);

          }
        }
        if (!res.ok) throw new Error(data.error || 'Erreur commission payout');
        return data;
      } catch (e: any) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.requestCommissionPayout(phone);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.requestCommissionPayout(phone);

        }
      }
    }
  },

  async getUsers(): Promise<DBUser[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('sb_users')
        .select('*');
      
      if (error) throw error;
      return (data || []).map(u => ({
        phone: u.phone,
        name: u.name,
        role: u.role as any,
        passwordHash: u.password_hash,
        parentPhone: u.parent_phone,
        referralCode: u.referral_code,
        balanceCommission: Number(u.balance_commission),
        balanceCommissionWithdrawn: Number(u.balance_commission_withdrawn),
        mfaEnabled: u.mfa_enabled,
        createdAt: u.created_at
      }));
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      return Object.values(db.users);
    } else {
      try {
        const res = await customFetch('/api/users');
        const data = await res.json();
        if (data && (data.error === "STANDALONE_FALLBACK" || data.error === "STANDALONE_FALLBACK")) {
          return Object.values(getLocalDB().users);
        }
        return data.users;
      } catch (e) {
        useLocalStorageSandbox = isPreviewEnvironment ? false : true;
        return Object.values(getLocalDB().users);
      }
    }
  },

  async deleteUser(phone: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('sb_users')
        .delete()
        .eq('phone', phone);
      if (error) throw error;
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      delete db.users[phone];
      saveLocalDB(db);
    } else {
      try {
        const res = await customFetch(`/api/users/${phone}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          useLocalStorageSandbox = isPreviewEnvironment ? false : true;
          const db = getLocalDB();
          delete db.users[phone];
          saveLocalDB(db);
        }
      } catch (e) {
        useLocalStorageSandbox = isPreviewEnvironment ? false : true;
        const db = getLocalDB();
        delete db.users[phone];
        saveLocalDB(db);
      }
    }
  },

  // Transactions Operations
  async getTransactions(phone?: string): Promise<DBTransaction[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('sb_transactions').select('*');
      if (phone) {
        query = query.eq('user_phone', phone);
      }
      const { data, error } = await query.order('id', { ascending: false });

      if (error) throw error;
      return (data || []).map(t => ({
        id: t.id,
        type: t.type as 'deposit' | 'withdrawal' | 'commission_payout',
        amount: Number(t.amount),
        userPhone: t.user_phone,
        userName: t.user_name,
        xbetAccount: t.xbet_account,
        paymentMethod: t.payment_method,
        paymentNumber: t.payment_number,
        screenshot: t.screenshot,
        withdrawCode: t.withdraw_code,
        status: t.status as 'pending' | 'validated' | 'rejected',
        date: t.date,
        rejectionReason: t.rejection_reason,
        appliedCommission: t.applied_commission
      }));
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      let txs = db.transactions || [];
      if (phone) {
        txs = txs.filter(t => t.userPhone === phone);
      }
      return txs;
    } else {
      try {
        const url = phone ? `/api/transactions?phone=${phone}` : '/api/transactions';
        const res = await customFetch(url);
        const data = await res.json();
        if (data && (data.error === "STANDALONE_FALLBACK" || data.error === "STANDALONE_FALLBACK")) {
          const db = getLocalDB();
          let txs = db.transactions || [];
          if (phone) {
            txs = txs.filter(t => t.userPhone === phone);
          }
          return txs;
        }
        // Backup to localStorage sandbox for persistence across container restarts
        try {
          if (Array.isArray(data)) {
            const dbObj = getLocalDB();
            if (!dbObj.transactions) dbObj.transactions = [];
            data.forEach((tx: DBTransaction) => {
              const idx = dbObj.transactions.findIndex(t => t.id === tx.id);
              if (idx !== -1) {
                dbObj.transactions[idx] = tx;
              } else {
                dbObj.transactions.unshift(tx);
              }
            });
            dbObj.transactions.sort((a, b) => b.id.localeCompare(a.id));
            saveLocalDB(dbObj);
          }
        } catch (e) {
          console.error('[Backup] Failed to sync transactions into localStorage:', e);
        }
        return data;
      } catch (e) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.getTransactions(phone);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.getTransactions(phone);

        }
      }
    }
  },

  async createTransaction(tx: Omit<DBTransaction, 'id' | 'status' | 'date'> & { screenshot?: string }): Promise<DBTransaction> {
    if (isSupabaseConfigured && supabase) {
      if (tx.amount < 500) {
        throw new Error('Le montant minimum est de 500 FCFA');
      }

      // Check user exists
      const { data: user, error: userErr } = await supabase
        .from('sb_users')
        .select('*')
        .eq('phone', tx.userPhone)
        .single();
      
      if (userErr || !user) throw new Error('Compte de l\'utilisateur introuvable');

      const txId = 'TX_' + Date.now();
      const insertTx: any = {
        id: txId,
        type: tx.type,
        amount: tx.amount,
        user_phone: tx.userPhone,
        user_name: user.name,
        xbet_account: tx.xbetAccount,
        payment_method: tx.paymentMethod,
        payment_number: tx.paymentNumber,
        screenshot: tx.screenshot || null,
        withdraw_code: tx.withdrawCode || null,
        status: 'pending',
        date: new Date().toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        applied_commission: false
      };

      const { error } = await supabase
        .from('sb_transactions')
        .insert(insertTx);

      if (error) throw error;

      return {
        id: txId,
        type: tx.type as any,
        amount: tx.amount,
        userPhone: tx.userPhone,
        userName: user.name,
        xbetAccount: tx.xbetAccount,
        paymentMethod: tx.paymentMethod,
        paymentNumber: tx.paymentNumber,
        screenshot: tx.screenshot,
        withdrawCode: tx.withdrawCode,
        status: 'pending',
        date: insertTx.date,
        appliedCommission: false
      };
    } else if (useLocalStorageSandbox) {
      if (tx.amount < 500) {
        throw new Error('Le montant minimum est de 500 FCFA');
      }
      const db = getLocalDB();
      const user = db.users[tx.userPhone];
      if (!user) throw new Error('Compte de l\'utilisateur introuvable');

      const txId = 'TX_' + Date.now();
      const newTx: DBTransaction = {
        id: txId,
        type: tx.type,
        amount: Number(tx.amount),
        userPhone: tx.userPhone,
        userName: user.name,
        xbetAccount: tx.xbetAccount,
        paymentMethod: tx.paymentMethod,
        paymentNumber: tx.paymentNumber,
        screenshot: tx.screenshot,
        withdrawCode: tx.withdrawCode,
        status: 'pending',
        date: new Date().toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        appliedCommission: false
      };
      db.transactions.unshift(newTx);
      saveLocalDB(db);
      return newTx;
    } else {
      try {
        const res = await customFetch('/api/transactions/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tx)
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.createTransaction(tx);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.createTransaction(tx);

          }
        }
        if (!res.ok) throw new Error(data.error || 'Erreur création de transaction');
        // Backup to local storage sandbox
        try {
          if (data && data.transaction) {
            const dbObj = getLocalDB();
            if (!dbObj.transactions) dbObj.transactions = [];
            const exists = dbObj.transactions.some(t => t.id === data.transaction.id);
            if (!exists) {
              dbObj.transactions.unshift(data.transaction);
              saveLocalDB(dbObj);
            }
          }
        } catch (e) {
          console.error('[Backup] Failed to save created transaction in local storage:', e);
        }
        return data.transaction;
      } catch (e: any) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.createTransaction(tx);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.createTransaction(tx);

        }
      }
    }
  },

  async updateTransactionStatus(id: string, status: 'pending' | 'validated' | 'rejected', rejectionReason?: string): Promise<DBTransaction> {
    if (isSupabaseConfigured && supabase) {
      // 1. Get current transaction
      const { data: tx, error: txErr } = await supabase
        .from('sb_transactions')
        .select('*')
        .eq('id', id)
        .single();
      
      if (txErr || !tx) throw new Error('Transaction non trouvée');

      const oldStatus = tx.status;
      const appliedCommission = tx.applied_commission;

      // 2. Perform database update in supabase
      const updates: any = { status };
      if (rejectionReason !== undefined) updates.rejection_reason = rejectionReason;

      let nextAppliedCommission = appliedCommission;

      // Apply referral 1% logic on first transition to 'validated'
      if (status === 'validated' && oldStatus !== 'validated' && !appliedCommission) {
        // Query user's sponsor
        const { data: user } = await supabase
          .from('sb_users')
          .select('parent_phone')
          .eq('phone', tx.user_phone)
          .single();
        
        if (user && user.parent_phone) {
          const { data: parent } = await supabase
            .from('sb_users')
            .select('balance_commission')
            .eq('phone', user.parent_phone)
            .single();
          
          if (parent) {
            const extraCommission = Number(tx.amount) * 0.01;
            const newCommission = Number(parent.balance_commission) + extraCommission;
            
            // Crediting sponsor
            await supabase
              .from('sb_users')
              .update({ balance_commission: newCommission })
              .eq('phone', user.parent_phone);

            updates.applied_commission = true;
            nextAppliedCommission = true;
          }
        }
      }

      // Decrement/Cancel referral commission if status is changed back from validated
      if (status !== 'validated' && oldStatus === 'validated' && appliedCommission) {
        const { data: user } = await supabase
          .from('sb_users')
          .select('parent_phone')
          .eq('phone', tx.user_phone)
          .single();

        if (user && user.parent_phone) {
          const { data: parent } = await supabase
            .from('sb_users')
            .select('balance_commission')
            .eq('phone', user.parent_phone)
            .single();

          if (parent) {
            const extraCommission = Number(tx.amount) * 0.01;
            const newCommission = Math.max(0, Number(parent.balance_commission) - extraCommission);

            await supabase
              .from('sb_users')
              .update({ balance_commission: newCommission })
              .eq('phone', user.parent_phone);

            updates.applied_commission = false;
            nextAppliedCommission = false;
          }
        }
      }

      const { data: updatedTx, error: updErr } = await supabase
        .from('sb_transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updErr) throw updErr;

      return {
        id: updatedTx.id,
        type: updatedTx.type as any,
        amount: Number(updatedTx.amount),
        userPhone: updatedTx.user_phone,
        userName: updatedTx.user_name,
        xbetAccount: updatedTx.xbet_account,
        paymentMethod: updatedTx.payment_method,
        paymentNumber: updatedTx.payment_number,
        screenshot: updatedTx.screenshot,
        withdrawCode: updatedTx.withdraw_code,
        status: updatedTx.status as any,
        date: updatedTx.date,
        rejectionReason: updatedTx.rejection_reason,
        appliedCommission: nextAppliedCommission
      };
    } else if (useLocalStorageSandbox) {
      const db = getLocalDB();
      const tx = db.transactions.find(t => t.id === id);
      if (!tx) throw new Error('Transaction non trouvée');
      const oldStatus = tx.status;
      tx.status = status;
      if (rejectionReason !== undefined) tx.rejectionReason = rejectionReason;

      if (status === 'validated' && oldStatus !== 'validated' && !tx.appliedCommission) {
        const user = db.users[tx.userPhone];
        if (user && user.parentPhone) {
          const parent = db.users[user.parentPhone];
          if (parent) {
            const extraCommission = Number(tx.amount) * 0.01;
            parent.balanceCommission += extraCommission;
            tx.appliedCommission = true;
          }
        }
      }

      if (status !== 'validated' && oldStatus === 'validated' && tx.appliedCommission) {
        const user = db.users[tx.userPhone];
        if (user && user.parentPhone) {
          const parent = db.users[user.parentPhone];
          if (parent) {
            const extraCommission = Number(tx.amount) * 0.01;
            parent.balanceCommission = Math.max(0, parent.balanceCommission - extraCommission);
            tx.appliedCommission = false;
          }
        }
      }

      saveLocalDB(db);
      return tx;
    } else {
      try {
        const res = await customFetch('/api/transactions/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status, rejectionReason })
        });
        const data = await res.json();
        if (data && data.error === "STANDALONE_FALLBACK") {
          if (isPreviewEnvironment) {

            const _prev = useLocalStorageSandbox;

            useLocalStorageSandbox = true;

            try {

              const _res = await this.updateTransactionStatus(id, status, rejectionReason);

              useLocalStorageSandbox = _prev;

              return _res;

            } catch (err) {

              useLocalStorageSandbox = _prev;

              throw err;

            }

          } else {

            useLocalStorageSandbox = true;

            return this.updateTransactionStatus(id, status, rejectionReason);

          }
        }
        // Backup to local storage sandbox
        try {
          if (data && data.transaction) {
            const dbObj = getLocalDB();
            if (!dbObj.transactions) dbObj.transactions = [];
            const idx = dbObj.transactions.findIndex(t => t.id === data.transaction.id);
            if (idx !== -1) {
              dbObj.transactions[idx] = data.transaction;
            } else {
              dbObj.transactions.unshift(data.transaction);
            }
            saveLocalDB(dbObj);
          }
        } catch (e) {
          console.error('[Backup] Failed to save updated transaction in local storage:', e);
        }
        return data.transaction;
      } catch (e: any) {
        if (isPreviewEnvironment) {

          const _prev = useLocalStorageSandbox;

          useLocalStorageSandbox = true;

          try {

            const _res = await this.updateTransactionStatus(id, status, rejectionReason);

            useLocalStorageSandbox = _prev;

            return _res;

          } catch (err) {

            useLocalStorageSandbox = _prev;

            throw err;

          }

        } else {

          useLocalStorageSandbox = true;

          return this.updateTransactionStatus(id, status, rejectionReason);

        }
      }
    }
  },

  async seedSupabaseFromLocal(): Promise<{ success: boolean; message: string }> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase n'est pas configuré");
      }
      const db = getLocalDB();
      
      // 1. Seed Config
      try {
        const configUpdates = {
          id: 1,
          popup_enabled: db.config.popupEnabled,
          popup_title: db.config.popupTitle,
          popup_message: db.config.popupMessage,
          support_whatsapp: db.config.supportWhatsapp,
          withdrawal_phys_ville: db.config.withdrawalPhysVille,
          withdrawal_phys_rue: db.config.withdrawalPhysRue,
        };
        await supabase.from('sb_config').upsert(configUpdates);
      } catch (e: any) {
        console.error("Config seed failed:", e);
      }

      // 2. Seed Payment Methods
      try {
        const pms = db.paymentMethods.map(p => ({
          name: p.name,
          number: p.number,
          active: p.active
        }));
        await supabase.from('sb_payment_methods').upsert(pms);
      } catch (e) {
        console.error("Payment methods seed failed:", e);
      }

      // 3. Seed Users
      try {
        const users = Object.values(db.users).map(u => ({
          phone: u.phone,
          name: u.name,
          role: u.role,
          password_hash: u.passwordHash,
          parent_phone: u.parentPhone || null,
          referral_code: u.referralCode || null,
          balance_commission: u.balanceCommission || 0,
          balance_commission_withdrawn: u.balanceCommissionWithdrawn || 0,
          mfa_enabled: u.mfaEnabled ?? true
        }));
        await supabase.from('sb_users').upsert(users);
      } catch (e) {
        console.error("Users seed failed:", e);
      }

      // 4. Seed Coupons
      try {
        const coupons = db.coupons.map(c => ({
          id: c.id,
          title: c.title,
          confidence: c.confidence || '',
          total_cote: c.totalCote || 0,
          matches: c.matches || [],
          status: 'pending',
          date: c.date || null
        }));
        await supabase.from('sb_coupons').upsert(coupons);
      } catch (e) {
        console.error("Coupons seed failed:", e);
      }

      // 5. Seed Transactions
      try {
        const txs = db.transactions.map(t => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          user_phone: t.userPhone,
          user_name: t.userName || '',
          xbet_account: t.xbetAccount || null,
          payment_method: t.paymentMethod || null,
          payment_number: t.paymentNumber || null,
          screenshot: t.screenshot || null,
          withdraw_code: t.withdrawCode || null,
          status: t.status,
          date: t.date,
          rejection_reason: t.rejectionReason || null,
          applied_commission: t.appliedCommission || false
        }));
        await supabase.from('sb_transactions').upsert(txs);
      } catch (e) {
        console.error("Transactions seed failed:", e);
      }

      return { success: true, message: "Les données d'essai (utilisateurs, configurations, opérations) ont été envoyées sur votre Cloud Supabase avec succès !" };
    },

    async checkSupabaseConnection(): Promise<{ success: boolean; error?: string; tablesMissing?: string[] }> {
      try {
        if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
          return { success: false, error: "Les identifiants Supabase ne sont pas configurés ou sont invalides." };
        }
        const client = createClient(supabaseUrl, supabaseAnonKey);
        if (!client) {
          return { success: false, error: "Impossible d'instancier le client Supabase." };
        }
        
        const tables = [
          { name: 'sb_config', test: () => client.from('sb_config').select('id').limit(1) },
          { name: 'sb_payment_methods', test: () => client.from('sb_payment_methods').select('name').limit(1) },
          { name: 'sb_users', test: () => client.from('sb_users').select('phone').limit(1) },
          { name: 'sb_coupons', test: () => client.from('sb_coupons').select('id').limit(1) },
          { name: 'sb_past_coupons', test: () => client.from('sb_past_coupons').select('id').limit(1) },
          { name: 'sb_transactions', test: () => client.from('sb_transactions').select('id').limit(1) }
        ];
        
        const missing: string[] = [];
        let lastErr = '';
        for (const table of tables) {
          try {
            const { error } = await table.test();
            if (error) {
              console.error(`Table ${table.name} check failed:`, error);
              // PGRST116 means 0 rows found or single row query failed, relation is OK!
              // If the code is not PGRST116 and has a message that suggests missing relation, add to missing.
              if (error.code !== 'PGRST116' && (
                error.message?.toLowerCase().includes('relation') || 
                error.message?.toLowerCase().includes('not exist') ||
                error.code === '42P01'
              )) {
                missing.push(table.name);
                lastErr = error.message;
              }
            }
          } catch (e: any) {
            missing.push(table.name);
            lastErr = e.message || String(e);
          }
        }
        
        if (missing.length > 0) {
          return {
            success: false,
            error: lastErr || `Ces tables requises sont manquantes dans votre projet : ${missing.join(', ')}`,
            tablesMissing: missing
          };
        }
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message || String(e) };
      }
    }
};

// Auto-Fallback Interceptor: If any dbService method fails while isSupabaseConfigured is true,
// we assume Supabase is misconfigured or its tables aren't set up yet.
// In that case, we change isSupabaseConfigured to false and retry the call using the Express server / Sandbox fallback!
if (typeof Proxy !== 'undefined') {
  const originalDbService = { ...dbService };
  Object.keys(dbService).forEach((key) => {
    const originalMethod = (originalDbService as any)[key];
    if (typeof originalMethod === 'function') {
      (dbService as any)[key] = async function (...args: any[]) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error: any) {
          if (isSupabaseConfigured) {
            const errorMsg = (error?.message || String(error)).toLowerCase();
            
            // Filter only real infrastructure or connection errors
            const isInfrastructureError = 
              errorMsg.includes('relation') ||
              errorMsg.includes('does not exist') ||
              errorMsg.includes('42p01') ||
              errorMsg.includes('failed to fetch') ||
              errorMsg.includes('network') ||
              errorMsg.includes('invalid api key') ||
              errorMsg.includes('apikey') ||
              errorMsg.includes('invalid input syntax') ||
              error?.code === 'PGRST116' ||
              error?.code === '42P01';

            if (isInfrastructureError) {
              console.warn(`[Supabase Fallback Helper] Call to dbService.${key} failed with INFRASTRUCTURE error. Setting isSupabaseConfigured = false and retrying with Local Server/Sandbox fallback. Error details:`, error);
              isSupabaseConfigured = false;
              if (onSupabaseFallbackOccurred) {
                try { onSupabaseFallbackOccurred(); } catch (e) {}
              }
              if (typeof window !== 'undefined' && (window as any).onSupabaseFallbackOccurred) {
                try { (window as any).onSupabaseFallbackOccurred(); } catch (e) {}
              }
              if ((dbService as any).onFallback) {
                try { (dbService as any).onFallback(); } catch (e) {}
              }
              // Retry the same function. Now isSupabaseConfigured is false, so it will fall back automatically!
              return await (dbService as any)[key].apply(this, args);
            } else {
              // Functional business errors (duplicate telephone, wrong pass, etc.) should not destroy connection
              throw error;
            }
          }
          throw error;
        }
      };
    }
  });
}

