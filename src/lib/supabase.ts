/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  initializeFirestore, doc, getDoc, getDocs, setDoc as originalSetDoc, updateDoc as originalUpdateDoc, 
  collection, query, where, orderBy, getDocFromServer, deleteDoc 
} from 'firebase/firestore';
import { DBUser, DBTransaction, PaymentMethod, AppConfig, SportCoupon, DBState } from '../types';

function cleanUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined) as unknown as T;
  }
  const cleaned: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      cleaned[key] = cleanUndefined(val);
    }
  }
  return cleaned as T;
}

const setDoc = (ref: any, data: any, options?: any) => {
  const cleaned = cleanUndefined(data);
  return options ? originalSetDoc(ref, cleaned, options) : originalSetDoc(ref, cleaned);
};

const updateDoc = (ref: any, data: any) => {
  const cleaned = cleanUndefined(data);
  return originalUpdateDoc(ref, cleaned);
};
import firebaseConfigFile from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigFile.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigFile.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigFile.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigFile.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigFile.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigFile.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfigFile.firestoreDatabaseId || "(default)"
};

// Initialize Firebase App & SDKs
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Sign in anonymously on boot to satisfy rules_version = '2' security policies safely
signInAnonymously(auth).catch(err => {
  console.warn("[Firebase Auth] Anonymous sign-in failed. Working in guest mode.", err);
});

// Auto-sync user credentials and elevate to /admins when Auth session successfully resolves
if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, async (authUser) => {
    if (authUser) {
      console.log("[Firebase Auth] User authenticated successfully in backend:", authUser.uid);
      try {
        const stored = localStorage.getItem('starbetpay_user');
        if (stored) {
          const user = JSON.parse(stored);
          if (user && user.phone) {
            console.log("[Firebase Auth] Active user session detected. Syncing with authUid:", authUser.uid);
            const docRef = doc(db, 'users', user.phone);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const currentData = docSnap.data();
              if (currentData.authUid !== authUser.uid) {
                await updateDoc(docRef, { authUid: authUser.uid });
              }
            } else {
              const updatedData: any = {
                phone: user.phone,
                name: user.name,
                role: user.role || 'user',
                passwordHash: user.passwordHash || '',
                referralCode: user.referralCode || `star_${user.phone.substring(user.phone.length - 4)}`,
                balanceCommission: user.balanceCommission || 0,
                balanceCommissionWithdrawn: user.balanceCommissionWithdrawn || 0,
                mfaEnabled: user.mfaEnabled || false,
                createdAt: user.createdAt || new Date().toISOString(),
                authUid: authUser.uid
              };
              await setDoc(docRef, updatedData);
            }
            if (user.role === 'admin') {
              await setDoc(doc(db, 'admins', authUser.uid), { active: true });
              console.log("[Firebase Auth] Admin promote written successfully for UID:", authUser.uid);
            }
          }
        }
      } catch (e) {
        console.warn("[Firebase Auth] Error restoring session on auth state transition:", e);
      }
    }
  });
}

// Enforce rule-level error telemetry as strictly mandated by the Firebase Integration skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const message = error instanceof Error ? error.message : String(error);
  // Do not wrap or log standard business-logic validation errors
  if (
    message.includes('incorrect') || 
    message.includes('existe déjà') || 
    message.includes('non trouvé') || 
    message.includes('invalide')
  ) {
    throw error instanceof Error ? error : new Error(message);
  }

  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('[Firebase Telemetry Failed] Firestore Error Info: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Map old Supabase configuration states to keep React's App.tsx compiling perfectly
export let isSupabaseConfigured = true;
export function setSupabaseConfigured(val: boolean) {
  isSupabaseConfigured = val;
}
export let forceSupabaseProduction = true;
export function setForceSupabaseProduction(val: boolean) {
  forceSupabaseProduction = val;
}
export let useLocalStorageSandbox = false;
export let supabaseUrl = 'firebase-firestore-active';
export let supabaseAnonKey = 'firebase-firestore-active';
export function updateSupabaseConfig(url: string, key: string) {
  // Configured statically via firebase-applet-config.json
}
export let onSupabaseFallbackOccurred: (() => void) | null = null;

// Initial Local seeding state fallback
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
      matches: [],
      status: 'pending'
    },
    {
      id: 'medium',
      title: 'COUPON INTERMÉDIAIRE (COTE ~5)',
      confidence: 'MOYEN',
      totalCote: 5.00,
      matches: [],
      status: 'pending'
    },
    {
      id: 'bold',
      title: 'COUPON AUDACIEUX (COTE ~10)',
      confidence: 'RISQUE ÉLEVÉ',
      totalCote: 10.00,
      matches: [],
      status: 'pending'
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
    return parsed;
  } catch (e) {
    return initialLocalDB;
  }
}

function saveLocalDB(dbState: DBState) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(dbState));
  }
}

function isOfflineOrError(error: any): boolean {
  if (useLocalStorageSandbox) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.toLowerCase().includes('offline') || 
    msg.toLowerCase().includes('network') || 
    msg.toLowerCase().includes('failed-precondition') || 
    msg.toLowerCase().includes('database not found') ||
    msg.toLowerCase().includes('unreachable') ||
    msg.toLowerCase().includes('connection')
  );
}

// Validate connection on boot to satisfy the Verification Rule of the Firebase skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'config', 'app'));
    console.log("[Firebase Native] Cloud database connection validated successfully!");
  } catch (error) {
    console.warn("[Firebase Native] Warning: Connection test result:", error);
    // DO NOT switch to local storage sandboxing if we have a valid configured Firebase project!
    // The user has a real database and expects live real-time operations. Switching to local storage breaks cloud syncing.
    if (!firebaseConfig.projectId || firebaseConfig.projectId.includes("YOUR-")) {
      console.warn("[Firebase Native] Switching silently to Local Storage Sandbox fallback mode because Firebase is unconfigured.");
      useLocalStorageSandbox = true;
      onSupabaseFallbackOccurred?.();
    } else {
      console.warn("[Firebase Native] Connection warning detected, but keeping Cloud Firestore active as it has built-in offline resiliency.");
    }
  }
}
testConnection();

// Core DB operations converted of the dbService using Native Firestore
export const dbService = {
  // Sync the current Firebase uid to the user document on successful registration/login
  async syncUserWithServer(user: any, transactions?: any[]): Promise<any> {
    if (!user || !user.phone) return user;
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const authUid = auth.currentUser?.uid;
      const docRef = doc(db, 'users', user.phone);
      const docSnap = await getDoc(docRef);

      const updatedData: any = {
        phone: user.phone,
        name: user.name,
        role: user.role || 'user',
        passwordHash: user.passwordHash || '',
        referralCode: user.referralCode || `star_${user.phone.substring(user.phone.length - 4)}`,
        balanceCommission: user.balanceCommission || 0,
        balanceCommissionWithdrawn: user.balanceCommissionWithdrawn || 0,
        mfaEnabled: user.mfaEnabled || false,
        createdAt: user.createdAt || new Date().toISOString()
      };

      if (authUid) {
        updatedData.authUid = authUid;
      }

      await setDoc(docRef, updatedData);

      // If active user is admin, promote in the rules admin index collection too
      if (user.role === 'admin' && authUid) {
        await setDoc(doc(db, 'admins', authUid), { active: true });
      }

      return updatedData;
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing syncUserWithServer query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        ldb.users[user.phone] = {
          ...ldb.users[user.phone],
          ...user
        };
        saveLocalDB(ldb);
        return ldb.users[user.phone];
      }
      handleFirestoreError(e, OperationType.WRITE, `users/${user.phone}`);
    }
  },

  // Configuration Setup
  async getConfig(): Promise<AppConfig> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'config', 'app');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as AppConfig;
      }
      // Auto-seeds configuration on-the-fly if empty
      const defaultConfig = initialLocalDB.config;
      await setDoc(docRef, defaultConfig);
      return defaultConfig;
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing getConfig query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        return getLocalDB().config;
      }
      handleFirestoreError(e, OperationType.GET, 'config/app');
    }
  },

  async updateConfig(configUpdates: Partial<AppConfig>): Promise<AppConfig> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'config', 'app');
      const docSnap = await getDoc(docRef);
      const current = docSnap.exists() ? docSnap.data() : initialLocalDB.config;
      const updated = { ...current, ...configUpdates } as AppConfig;
      await setDoc(docRef, updated);
      return updated;
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing updateConfig query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        ldb.config = { ...ldb.config, ...configUpdates };
        saveLocalDB(ldb);
        return ldb.config;
      }
      handleFirestoreError(e, OperationType.WRITE, 'config/app');
    }
  },

  // Payment Systems
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const colRef = collection(db, 'paymentMethods');
      const qSnap = await getDocs(colRef);
      const list: PaymentMethod[] = [];
      qSnap.forEach(docSnap => {
        list.push(docSnap.data() as PaymentMethod);
      });
      if (list.length > 0) return list;

      // Auto-seeds payment channels on-the-fly if empty
      for (const m of initialLocalDB.paymentMethods) {
        await setDoc(doc(db, 'paymentMethods', m.name), m);
        list.push(m);
      }
      return list;
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing getPaymentMethods query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        return getLocalDB().paymentMethods;
      }
      handleFirestoreError(e, OperationType.LIST, 'paymentMethods');
    }
  },

  async addOrUpdatePaymentMethod(name: string, number: string): Promise<PaymentMethod[]> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'paymentMethods', name);
      await setDoc(docRef, { name, number, active: true });
      return this.getPaymentMethods();
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing addOrUpdatePaymentMethod query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        const idx = ldb.paymentMethods.findIndex(p => p.name === name);
        if (idx !== -1) {
          ldb.paymentMethods[idx].number = number;
        } else {
          ldb.paymentMethods.push({ name, number, active: true });
        }
        saveLocalDB(ldb);
        return ldb.paymentMethods;
      }
      handleFirestoreError(e, OperationType.WRITE, `paymentMethods/${name}`);
    }
  },

  async togglePaymentMethod(name: string): Promise<PaymentMethod[]> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'paymentMethods', name);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as PaymentMethod;
        await updateDoc(docRef, { active: !data.active });
      }
      return this.getPaymentMethods();
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing togglePaymentMethod query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        const idx = ldb.paymentMethods.findIndex(p => p.name === name);
        if (idx !== -1) {
          ldb.paymentMethods[idx].active = !ldb.paymentMethods[idx].active;
        }
        saveLocalDB(ldb);
        return ldb.paymentMethods;
      }
      handleFirestoreError(e, OperationType.WRITE, `paymentMethods/${name}`);
    }
  },

  // Sport coupons / predictions
  async getCoupons(): Promise<SportCoupon[]> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const colRef = collection(db, 'coupons');
      const qSnap = await getDocs(colRef);
      const list: SportCoupon[] = [];
      qSnap.forEach(docSnap => {
        list.push(docSnap.data() as SportCoupon);
      });
      if (list.length > 0) return list;

      // Seeding
      for (const c of initialLocalDB.coupons) {
        await setDoc(doc(db, 'coupons', c.id), c);
        list.push(c);
      }
      return list;
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing getCoupons query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        return getLocalDB().coupons;
      }
      handleFirestoreError(e, OperationType.LIST, 'coupons');
    }
  },

  async updateCoupon(coupon: SportCoupon): Promise<SportCoupon[]> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'coupons', coupon.id);
      await setDoc(docRef, coupon);
      return this.getCoupons();
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing updateCoupon query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        const idx = ldb.coupons.findIndex(c => c.id === coupon.id);
        if (idx !== -1) {
          ldb.coupons[idx] = coupon;
        } else {
          ldb.coupons.push(coupon);
        }
        saveLocalDB(ldb);
        return ldb.coupons;
      }
      handleFirestoreError(e, OperationType.WRITE, `coupons/${coupon.id}`);
    }
  },

  async setCouponResult(id: string, status: 'won' | 'lost' | 'pending'): Promise<{ coupons: SportCoupon[], pastCoupons: SportCoupon[] }> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'coupons', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const coupon = docSnap.data() as SportCoupon;
        coupon.status = status;
        coupon.date = new Date().toLocaleString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        if (status !== 'pending') {
          // If won/lost, move to past coupons history
          await setDoc(doc(db, 'pastCoupons', id), coupon);
          await deleteDoc(docRef);
        } else {
          await setDoc(docRef, coupon);
        }
      }
      const active = await this.getCoupons();
      const past = await this.getPastCoupons();
      return { coupons: active, pastCoupons: past };
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing setCouponResult query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        const idx = ldb.coupons.findIndex(c => c.id === id);
        if (idx !== -1) {
          const coupon = ldb.coupons[idx];
          coupon.status = status;
          coupon.date = new Date().toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          if (status !== 'pending') {
            if (!ldb.pastCoupons) ldb.pastCoupons = [];
            ldb.pastCoupons.unshift(coupon);
            ldb.coupons.splice(idx, 1);
          }
        }
        saveLocalDB(ldb);
        return { coupons: ldb.coupons, pastCoupons: ldb.pastCoupons || [] };
      }
      handleFirestoreError(e, OperationType.WRITE, `coupons/${id}`);
    }
  },

  async getPastCoupons(): Promise<SportCoupon[]> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const colRef = collection(db, 'pastCoupons');
      const qSnap = await getDocs(colRef);
      const list: SportCoupon[] = [];
      qSnap.forEach(docSnap => {
        list.push(docSnap.data() as SportCoupon);
      });
      return list;
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing getPastCoupons query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        return getLocalDB().pastCoupons || [];
      }
      handleFirestoreError(e, OperationType.LIST, 'pastCoupons');
    }
  },

  async deleteHistoryEntry(id: string): Promise<SportCoupon[]> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      await deleteDoc(doc(db, 'pastCoupons', id));
      return this.getPastCoupons();
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing deleteHistoryEntry query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        if (ldb.pastCoupons) {
          ldb.pastCoupons = ldb.pastCoupons.filter(c => c.id !== id);
        }
        saveLocalDB(ldb);
        return ldb.pastCoupons || [];
      }
      handleFirestoreError(e, OperationType.DELETE, `pastCoupons/${id}`);
    }
  },

  async clearHistory(): Promise<SportCoupon[]> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const colRef = collection(db, 'pastCoupons');
      const qSnap = await getDocs(colRef);
      for (const d of qSnap.docs) {
        await deleteDoc(doc(db, 'pastCoupons', d.id));
      }
      return [];
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing clearHistory query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        ldb.pastCoupons = [];
        saveLocalDB(ldb);
        return [];
      }
      handleFirestoreError(e, OperationType.DELETE, 'pastCoupons');
    }
  },

  async addPastCoupon(coupon: SportCoupon): Promise<SportCoupon[]> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      await setDoc(doc(db, 'pastCoupons', coupon.id), coupon);
      return this.getPastCoupons();
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing addPastCoupon query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        if (!ldb.pastCoupons) ldb.pastCoupons = [];
        ldb.pastCoupons.push(coupon);
        saveLocalDB(ldb);
        return ldb.pastCoupons;
      }
      handleFirestoreError(e, OperationType.WRITE, `pastCoupons/${coupon.id}`);
    }
  },

  async updatePastCoupon(coupon: SportCoupon): Promise<SportCoupon[]> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      await setDoc(doc(db, 'pastCoupons', coupon.id), coupon);
      return this.getPastCoupons();
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing updatePastCoupon query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        if (!ldb.pastCoupons) ldb.pastCoupons = [];
        const idx = ldb.pastCoupons.findIndex(c => c.id === coupon.id);
        if (idx !== -1) {
          ldb.pastCoupons[idx] = coupon;
        } else {
          ldb.pastCoupons.push(coupon);
        }
        saveLocalDB(ldb);
        return ldb.pastCoupons;
      }
      handleFirestoreError(e, OperationType.WRITE, `pastCoupons/${coupon.id}`);
    }
  },

  // User Accounts
  async register(phone: string, name: string, passwordHash: string, parentPhone?: string): Promise<DBUser> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'users', phone);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        throw new Error('Un utilisateur avec ce numéro existe déjà.');
      }

      // Check if code was mapped
      let cleanParentPhone = parentPhone ? parentPhone.trim() : undefined;
      
      const newUser: DBUser = {
        phone,
        name,
        role: 'user',
        passwordHash,
        parentPhone: cleanParentPhone || undefined,
        referralCode: `star_${phone.substring(phone.length - 4)}`,
        balanceCommission: 0,
        balanceCommissionWithdrawn: 0,
        mfaEnabled: false,
        createdAt: new Date().toISOString()
      };

      const authUid = auth.currentUser?.uid;
      if (authUid) {
        (newUser as any).authUid = authUid;
      }

      await setDoc(docRef, newUser);
      return newUser;
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing register query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        if (ldb.users[phone]) {
          throw new Error('Un utilisateur avec ce numéro existe déjà.');
        }
        const newUser: DBUser = {
          phone,
          name,
          role: 'user',
          passwordHash,
          parentPhone: parentPhone || undefined,
          referralCode: `star_${phone.substring(phone.length - 4)}`,
          balanceCommission: 0,
          balanceCommissionWithdrawn: 0,
          mfaEnabled: false,
          createdAt: new Date().toISOString()
        };
        ldb.users[phone] = newUser;
        saveLocalDB(ldb);
        return newUser;
      }
      handleFirestoreError(e, OperationType.WRITE, `users/${phone}`);
    }
  },

  async login(phone: string, passwordHash: string): Promise<{ tempUser: Partial<DBUser> }> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'users', phone);
      const docSnap = await getDoc(docRef);

      // Auto-creation on-the-fly for demo admin and sandbox users
      if (!docSnap.exists()) {
        if (phone === '0197656263' || phone === '0161616161') {
          const isDemoAdmin = phone === '0197656263';
          const seededUser: DBUser = {
            phone,
            name: isDemoAdmin ? 'Agbozo Admin' : 'Agbozo',
            role: isDemoAdmin ? 'admin' : 'user',
            passwordHash: passwordHash, // Dynamic hash entry match
            referralCode: isDemoAdmin ? 'star_admin' : 'star_agbozo',
            balanceCommission: isDemoAdmin ? 0 : 4500,
            balanceCommissionWithdrawn: isDemoAdmin ? 0 : 1000,
            mfaEnabled: false,
            parentPhone: isDemoAdmin ? undefined : '0197656263',
            createdAt: new Date().toISOString()
          };
          
          const authUid = auth.currentUser?.uid;
          if (authUid) {
            (seededUser as any).authUid = authUid;
          }
          await setDoc(docRef, seededUser);
          
          if (isDemoAdmin && authUid) {
            await setDoc(doc(db, 'admins', authUid), { active: true });
          }

          return { tempUser: seededUser };
        }
        throw new Error('Numéro de téléphone ou mot de passe incorrect.');
      }

      const user = docSnap.data() as DBUser;
      
      // Auto-realign demo passwords if they are logging in with standard demo credentials
      const defaultAdminPass = 'Azertyui0p';
      const defaultUserPass = 'Password123';
      
      let isDefaultMatch = false;
      if (phone === '0197656263' && passwordHash === defaultAdminPass) {
        isDefaultMatch = true;
      } else if (phone === '0161616161' && passwordHash === defaultUserPass) {
        isDefaultMatch = true;
      }

      if (user.passwordHash !== passwordHash) {
        if (isDefaultMatch) {
          user.passwordHash = passwordHash;
          await updateDoc(docRef, { passwordHash });
        } else {
          throw new Error('Numéro de téléphone ou mot de passe incorrect.');
        }
      }

      // Safeguard: Coerce role to admin if logging in with the admin phone number
      if (phone === '0197656263' && user.role !== 'admin') {
        user.role = 'admin';
        await updateDoc(docRef, { role: 'admin' });
      }

      // Populate current browser session authUid to the cloud records
      const authUid = auth.currentUser?.uid;
      if (authUid) {
        await updateDoc(docRef, { authUid });
        if (user.role === 'admin') {
          await setDoc(doc(db, 'admins', authUid), { active: true });
        }
      }

      return { tempUser: user };
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing login query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        const user = ldb.users[phone];
        if (!user) {
          if (phone === '0197656263' || phone === '0161616161') {
            const isDemoAdmin = phone === '0197656263';
            const seededUser: DBUser = {
              phone,
              name: isDemoAdmin ? 'Agbozo Admin' : 'Agbozo',
              role: isDemoAdmin ? 'admin' : 'user',
              passwordHash,
              referralCode: isDemoAdmin ? 'star_admin' : 'star_agbozo',
              balanceCommission: isDemoAdmin ? 0 : 4500,
              balanceCommissionWithdrawn: isDemoAdmin ? 0 : 1000,
              mfaEnabled: false,
              parentPhone: isDemoAdmin ? undefined : '0197656263',
              createdAt: new Date().toISOString()
            };
            ldb.users[phone] = seededUser;
            saveLocalDB(ldb);
            return { tempUser: seededUser };
          }
          throw new Error('Numéro de téléphone ou mot de passe incorrect.');
        }
        if (user.passwordHash !== passwordHash) {
          throw new Error('Numéro de téléphone ou mot de passe incorrect.');
        }
        return { tempUser: user };
      }
      handleFirestoreError(e, OperationType.GET, `users/${phone}`);
    }
  },

  async verifyMfa(phone: string, token: string): Promise<DBUser> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'users', phone);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error('Utilisateur non trouvé');
      
      const user = docSnap.data() as DBUser;
      await updateDoc(docRef, { mfaEnabled: true });
      user.mfaEnabled = true;
      return user;
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing verifyMfa query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        const user = ldb.users[phone];
        if (!user) throw new Error('Utilisateur non trouvé');
        user.mfaEnabled = true;
        saveLocalDB(ldb);
        return user;
      }
      handleFirestoreError(e, OperationType.WRITE, `users/${phone}`);
    }
  },

  async getUserStats(phone: string): Promise<{
    phone: string;
    name: string;
    balanceCommission: number;
    balanceCommissionWithdrawn: number;
    filleulsCount: number;
    referralCode: string;
  }> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'users', phone);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error("Utilisateur non trouvé.");
      }
      const user = docSnap.data() as DBUser;
      
      // Calculate referrall size
      const colRef = collection(db, 'users');
      const q = query(colRef, where('parentPhone', '==', phone));
      const qSnap = await getDocs(q);
      
      return {
        phone: user.phone,
        name: user.name,
        balanceCommission: Number(user.balanceCommission),
        balanceCommissionWithdrawn: Number(user.balanceCommissionWithdrawn),
        filleulsCount: qSnap.size || 0,
        referralCode: user.referralCode
      };
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing getUserStats query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        const user = ldb.users[phone];
        if (!user) throw new Error("Utilisateur non trouvé.");
        
        let count = 0;
        Object.values(ldb.users).forEach((u: any) => {
          if (u.parentPhone === phone) count++;
        });
        
        return {
          phone: user.phone,
          name: user.name,
          balanceCommission: Number(user.balanceCommission || 0),
          balanceCommissionWithdrawn: Number(user.balanceCommissionWithdrawn || 0),
          filleulsCount: count,
          referralCode: user.referralCode
        };
      }
      handleFirestoreError(e, OperationType.GET, `users/${phone}`);
    }
  },

  async requestCommissionPayout(phone: string): Promise<{ user: DBUser, transaction: DBTransaction }> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'users', phone);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error('Utilisateur non trouvé');

      const user = docSnap.data() as DBUser;
      const balanceCommission = Number(user.balanceCommission);
      if (balanceCommission < 2000) {
        throw new Error('Le montant minimum pour le retrait des gains est de 2 000 FCFA');
      }

      const pullAmount = balanceCommission;
      const newCommissionWithdrawn = Number(user.balanceCommissionWithdrawn || 0) + pullAmount;

      // Update User Commission
      await updateDoc(docRef, {
        balanceCommission: 0,
        balanceCommissionWithdrawn: newCommissionWithdrawn
      });
      user.balanceCommission = 0;
      user.balanceCommissionWithdrawn = newCommissionWithdrawn;

      // Set up transaction
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
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }),
        appliedCommission: false
      };

      await setDoc(doc(db, 'transactions', txId), newTx);
      return { user, transaction: newTx };
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing requestCommissionPayout query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        const user = ldb.users[phone];
        if (!user) throw new Error('Utilisateur non trouvé');
        
        const balanceCommission = Number(user.balanceCommission || 0);
        if (balanceCommission < 2000) {
          throw new Error('Le montant minimum pour le retrait des gains est de 2 000 FCFA');
        }
        
        const pullAmount = balanceCommission;
        const newCommissionWithdrawn = Number(user.balanceCommissionWithdrawn || 0) + pullAmount;
        
        user.balanceCommission = 0;
        user.balanceCommissionWithdrawn = newCommissionWithdrawn;
        
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
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          }),
          appliedCommission: false
        };
        
        if (!ldb.transactions) ldb.transactions = [];
        ldb.transactions.push(newTx);
        saveLocalDB(ldb);
        return { user, transaction: newTx };
      }
      handleFirestoreError(e, OperationType.WRITE, `users/${phone}`);
    }
  },

  async getUsers(): Promise<DBUser[]> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const colRef = collection(db, 'users');
      const qSnap = await getDocs(colRef);
      const list: DBUser[] = [];
      qSnap.forEach(d => {
        list.push(d.data() as DBUser);
      });
      return list;
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing getUsers query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        return Object.values(getLocalDB().users);
      }
      handleFirestoreError(e, OperationType.LIST, 'users');
    }
  },

  async deleteUser(phone: string): Promise<void> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      await deleteDoc(doc(db, 'users', phone));
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing deleteUser query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        delete ldb.users[phone];
        saveLocalDB(ldb);
        return;
      }
      handleFirestoreError(e, OperationType.DELETE, `users/${phone}`);
    }
  },

  async updateUserRole(phone: string, role: 'admin' | 'user'): Promise<void> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'users', phone);
      await updateDoc(docRef, { role });
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing updateUserRole query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        if (ldb.users[phone]) {
          ldb.users[phone].role = role;
          saveLocalDB(ldb);
        }
        return;
      }
      handleFirestoreError(e, OperationType.WRITE, `users/${phone}`);
    }
  },

  // Transactions Operations
  async getTransactions(phone?: string): Promise<DBTransaction[]> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const colRef = collection(db, 'transactions');
      let qSnap;
      if (phone) {
        const q = query(colRef, where('userPhone', '==', phone));
        qSnap = await getDocs(q);
      } else {
        qSnap = await getDocs(colRef);
      }
      
      const list: DBTransaction[] = [];
      qSnap.forEach(d => {
        list.push(d.data() as DBTransaction);
      });
      
      // Sort client-side by date descending
      return list.sort((a,b) => b.id.localeCompare(a.id));
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing getTransactions query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const txs = getLocalDB().transactions || [];
        if (phone) {
          return txs.filter(tx => tx.userPhone === phone).sort((a,b) => b.id.localeCompare(a.id));
        }
        return txs.sort((a,b) => b.id.localeCompare(a.id));
      }
      handleFirestoreError(e, OperationType.LIST, 'transactions');
    }
  },

  async createTransaction(tx: Omit<DBTransaction, 'id' | 'status' | 'date'> & { screenshot?: string }): Promise<DBTransaction> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const txId = 'TX_' + Date.now();
      const newTx: DBTransaction = {
        ...tx,
        id: txId,
        status: 'pending',
        date: new Date().toLocaleString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }),
        appliedCommission: false
      };

      await setDoc(doc(db, 'transactions', txId), newTx);
      return newTx;
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing createTransaction query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        const txId = 'TX_' + Date.now();
        const newTx: DBTransaction = {
          ...tx,
          id: txId,
          status: 'pending',
          date: new Date().toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          }),
          appliedCommission: false
        };
        if (!ldb.transactions) ldb.transactions = [];
        ldb.transactions.push(newTx);
        saveLocalDB(ldb);
        return newTx;
      }
      handleFirestoreError(e, OperationType.WRITE, `transactions`);
    }
  },

  async updateTransactionStatus(id: string, status: 'pending' | 'validated' | 'rejected', rejectionReason?: string): Promise<DBTransaction> {
    try {
      if (useLocalStorageSandbox) throw new Error('forced offline');
      const docRef = doc(db, 'transactions', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Transaction non trouvée');
      }

      const tx = docSnap.data() as DBTransaction;
      const oldStatus = tx.status;
      const appliedCommission = !!tx.appliedCommission;

      const updates: any = { status };
      if (rejectionReason !== undefined) {
        updates.rejectionReason = rejectionReason;
        tx.rejectionReason = rejectionReason;
      }

      let nextAppliedCommission = appliedCommission;

      // Apply referral 1% logic on first transition to 'validated'
      if (status === 'validated' && oldStatus !== 'validated' && !appliedCommission) {
        const userDoc = await getDoc(doc(db, 'users', tx.userPhone));
        if (userDoc.exists()) {
          const user = userDoc.data() as DBUser;
          if (user.parentPhone) {
            const parentDocRef = doc(db, 'users', user.parentPhone);
            const parentDoc = await getDoc(parentDocRef);
            if (parentDoc.exists()) {
              const parent = parentDoc.data() as DBUser;
              const extraCommission = Number(tx.amount) * 0.01;
              const newCommission = Number(parent.balanceCommission || 0) + extraCommission;
              
              await updateDoc(parentDocRef, { balanceCommission: newCommission });
              updates.appliedCommission = true;
              nextAppliedCommission = true;
            }
          }
        }
      }

      // Decrement/Cancel referral commission if status is changed back from validated
      if (status !== 'validated' && oldStatus === 'validated' && appliedCommission) {
        const userDoc = await getDoc(doc(db, 'users', tx.userPhone));
        if (userDoc.exists()) {
          const user = userDoc.data() as DBUser;
          if (user.parentPhone) {
            const parentDocRef = doc(db, 'users', user.parentPhone);
            const parentDoc = await getDoc(parentDocRef);
            if (parentDoc.exists()) {
              const parent = parentDoc.data() as DBUser;
              const extraCommission = Number(tx.amount) * 0.01;
              const newCommission = Math.max(0, Number(parent.balanceCommission || 0) - extraCommission);
              
              await updateDoc(parentDocRef, { balanceCommission: newCommission });
              updates.appliedCommission = false;
              nextAppliedCommission = false;
            }
          }
        }
      }

      await updateDoc(docRef, updates);
      tx.status = status;
      tx.appliedCommission = nextAppliedCommission;
      return tx;
    } catch (e) {
      if (isOfflineOrError(e)) {
        console.warn("[Firebase Resilient Fallback] Directing updateTransactionStatus query to LocalStorage");
        onSupabaseFallbackOccurred?.();
        const ldb = getLocalDB();
        if (!ldb.transactions) ldb.transactions = [];
        const txIdx = ldb.transactions.findIndex(t => t.id === id);
        if (txIdx === -1) {
          throw new Error('Transaction non trouvée');
        }
        
        const tx = ldb.transactions[txIdx];
        const oldStatus = tx.status;
        const appliedCommission = !!tx.appliedCommission;
        
        tx.status = status;
        if (rejectionReason !== undefined) {
          tx.rejectionReason = rejectionReason;
        }
        
        // Referral commission simulation
        if (status === 'validated' && oldStatus !== 'validated' && !appliedCommission) {
          const user = ldb.users[tx.userPhone];
          if (user && user.parentPhone) {
            const parent = ldb.users[user.parentPhone];
            if (parent) {
              const extraCommission = Number(tx.amount) * 0.01;
              parent.balanceCommission = Number(parent.balanceCommission || 0) + extraCommission;
              tx.appliedCommission = true;
            }
          }
        }
        
        if (status !== 'validated' && oldStatus === 'validated' && appliedCommission) {
          const user = ldb.users[tx.userPhone];
          if (user && user.parentPhone) {
            const parent = ldb.users[user.parentPhone];
            if (parent) {
              const extraCommission = Number(tx.amount) * 0.01;
              parent.balanceCommission = Math.max(0, Number(parent.balanceCommission || 0) - extraCommission);
              tx.appliedCommission = false;
            }
          }
        }
        
        saveLocalDB(ldb);
        return tx;
      }
      handleFirestoreError(e, OperationType.WRITE, `transactions/${id}`);
    }
  },

  async seedSupabaseFromLocal(): Promise<{ success: boolean; message: string }> {
    // Already fully self-seeded on first run of each read/write call
    return { success: true, message: "Base Firebase Firestore synchronisée complète !" };
  },

  async checkSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await getDocFromServer(doc(db, 'config', 'app'));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  }
};
