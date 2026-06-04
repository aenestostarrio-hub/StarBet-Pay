import { createClient } from '@supabase/supabase-js';
import { DBUser, DBTransaction, PaymentMethod, AppConfig, SportCoupon } from '../types';

// Read Vercel/Vite environment variables
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Service Layer to abstract data fetching between direct Supabase queries
 * (ideal for Vercel deployment) and local server API endpoints (fallback/dev mode).
 */
export const dbService = {
  // Config
  async getConfig(): Promise<AppConfig> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('sb_config')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) {
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
    } else {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('API Error');
      return res.json();
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
    } else {
      const res = await fetch('/api/config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      return data.config;
    }
  },

  // Payment Methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('sb_payment_methods')
        .select('*');
      
      if (error) throw error;
      return (data || []).map(p => ({
        name: p.name,
        number: p.number,
        active: p.active
      }));
    } else {
      const res = await fetch('/api/payment-methods');
      if (!res.ok) throw new Error('API Error');
      return res.json();
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
    } else {
      const res = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, number })
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      return data.paymentMethods;
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
    } else {
      const res = await fetch('/api/payment-methods/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      return data.paymentMethods;
    }
  },

  // Coupons
  async getCoupons(): Promise<SportCoupon[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('sb_coupons')
        .select('*');
      
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
    } else {
      const res = await fetch('/api/coupons');
      if (!res.ok) throw new Error('API Error');
      return res.json();
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
          status: 'pending',
          date: new Date().toLocaleDateString('fr-FR')
        })
        .eq('id', coupon.id);

      if (error) throw error;
      return this.getCoupons();
    } else {
      const res = await fetch('/api/coupons/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coupon)
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      return data.coupons;
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
    } else {
      const res = await fetch('/api/coupons/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      if (!res.ok) throw new Error('API Error');
      return res.json();
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
    } else {
      const res = await fetch('/api/coupons/history');
      if (!res.ok) throw new Error('API Error');
      return res.json();
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
    } else {
      const res = await fetch(`/api/coupons/history/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      return data.pastCoupons;
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
    } else {
      const res = await fetch('/api/coupons/history/clear', {
        method: 'POST'
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      return data.pastCoupons;
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
        mfa_enabled: true,
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
        mfaEnabled: true,
        createdAt: newUser.created_at
      };
    } else {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, password: passwordHash, parentPhone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'inscription');
      return data.user;
    }
  },

  async login(phone: string, passwordHash: string): Promise<{ tempUser: Partial<DBUser> }> {
    if (isSupabaseConfigured && supabase) {
      const { data: user, error } = await supabase
        .from('sb_users')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      if (error) throw error;
      
      if (!user || user.password_hash !== passwordHash) {
        throw new Error('Numéro de téléphone ou mot de passe incorrect');
      }

      return {
        tempUser: {
          phone: user.phone,
          name: user.name,
          role: user.role as 'admin' | 'user',
          mfaEnabled: user.mfa_enabled
        }
      };
    } else {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password: passwordHash })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la connexion');
      return data;
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
    } else {
      const res = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: token })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur MFA');
      return data.user;
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
        .single();
      
      if (userErr) throw userErr;

      // Count filleuls (where parent_phone = user's phone)
      const { count, error: countErr } = await supabase
        .from('sb_users')
        .select('*', { count: 'exact', head: true })
        .eq('parent_phone', phone);
      
      if (countErr) throw countErr;

      return {
        phone: user.phone,
        name: user.name,
        balanceCommission: Number(user.balance_commission),
        balanceCommissionWithdrawn: Number(user.balance_commission_withdrawn),
        filleulsCount: count || 0,
        referralCode: user.referral_code
      };
    } else {
      const res = await fetch(`/api/users/stats/${phone}`);
      if (!res.ok) throw new Error('API Error');
      return res.json();
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
    } else {
      const res = await fetch('/api/commissions/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur commission payout');
      return data;
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
    } else {
      const url = phone ? `/api/transactions?phone=${phone}` : '/api/transactions';
      const res = await fetch(url);
      if (!res.ok) throw new Error('API Error');
      return res.json();
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
    } else {
      const res = await fetch('/api/transactions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur création de transaction');
      return data.transaction;
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
    } else {
      const res = await fetch('/api/transactions/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, rejectionReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur mise à jour transaction');
      return data.transaction;
    }
  }
};
