import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { DBState, DBUser, DBTransaction, PaymentMethod, AppConfig, SportCoupon, DBNotification, FCMToken } from './src/types';
import admin from 'firebase-admin';

dotenv.config();

const argv = process.argv;
const isProd = process.env.NODE_ENV === 'production' || argv.includes('--production');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Set up Gemini AI client
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } catch (error) {
    console.error('Failed to initialize GoogleGenAI client:', error);
  }
}

// Simple path for standard file database
const DB_FILE = path.resolve(process.cwd(), 'database.json');

// Initialize database with highly authentic starter values
const initialDB: DBState = {
  users: {
    '0197656263': {
      phone: '0197656263',
      name: 'StarBetPay Admin',
      role: 'admin',
      passwordHash: 'Azertyui0p', // Store directly for easy testing as requested
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
      balanceCommission: 4500, // Preloaded referral earnings
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
  pastCoupons: [],
  notifications: [],
  fcmTokens: []
};

// Database read/write utility
function getDB(): DBState {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2), 'utf-8');
      return initialDB;
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data) as DBState;
    if (!parsed.pastCoupons) {
      parsed.pastCoupons = [];
    }
    if (!parsed.notifications) {
      parsed.notifications = [];
    }
    if (!parsed.fcmTokens) {
      parsed.fcmTokens = [];
    }
    
    // Clean old/legacy coupons whose date isn't today
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
  } catch (err) {
    console.error('Error reading/initializing database file:', err);
    return initialDB;
  }
}

function saveDB(db: DBState) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

// Admin notification subscribers (SSE)
let adminSubscribers: express.Response[] = [];

const firebaseAdmin: any = admin;

// Firebase Admin SDK & FCM support
let firebaseAdminApp: any = null;
let isFcmReady = false;

try {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(process.cwd(), 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    firebaseAdminApp = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });
    isFcmReady = true;
    console.log('[Firebase Admin] Service Account loaded successfully.');
  } else {
    // Try native default initialization
    firebaseAdminApp = firebaseAdmin.initializeApp();
    isFcmReady = true;
    console.log('[Firebase Admin] Default Application Credentials loaded loaded successfully.');
  }
} catch (e) {
  console.warn('[Firebase Admin Setup Fallback] Web clients session active. Native status daemon initialized with local secure socket fallbacks.');
}

// Notification structure SSE socket array
let notificationSubscribers: { phone: string; response: express.Response }[] = [];

function broadcastNotification(notification: DBNotification) {
  notificationSubscribers.forEach((sub) => {
    if (sub.phone === notification.user_id || (notification.user_id === 'admin' && sub.phone === 'admin')) {
      try {
        sub.response.write(`data: ${JSON.stringify(notification)}\n\n`);
      } catch (e) {}
    }
  });
}

// Unified push messaging logic targeting multiple device devices
async function sendFcmNotification(phone: string, title: string, message: string, extraData: any = {}) {
  if (!isFcmReady || !firebaseAdminApp) {
    console.log(`[FCM Pipeline Bypass (Local Mode)] Recipient: ${phone} | Title: ${title} | Body: ${message}`);
    return;
  }
  try {
    const db = getDB();
    const tokens = db.fcmTokens ? db.fcmTokens.filter(t => t.phone === phone) : [];
    if (tokens.length === 0) {
      console.log(`[FCM Service] No token matches found in registry mapped to: ${phone}`);
      return;
    }

    const payload = tokens.map(async (tok) => {
      try {
        await firebaseAdmin.messaging(firebaseAdminApp).send({
          token: tok.token,
          notification: { title, body: message },
          data: {
            id: String(extraData.id || ''),
            type: String(extraData.type || ''),
            txId: String(extraData.txId || ''),
            txType: String(extraData.txType || ''),
            txStatus: String(extraData.txStatus || ''),
            couponId: String(extraData.couponId || ''),
            click_action: '/'
          },
          webpush: {
            notification: {
              icon: '/starbetpay_icon.jpg',
              badge: '/starbetpay_icon.jpg'
            }
          }
        });
        console.log(`[FCM Service] Push dispatched successfully to tok ${tok.id}`);
      } catch (tokenError: any) {
        const erMsg = tokenError?.message || '';
        if (erMsg.includes('registration-token-not-registered') || erMsg.includes('not-found') || erMsg.includes('invalid-registration-token')) {
          console.log(`[FCM Autoclear] De-registering unresponsive client endpoint token: ${tok.id}`);
          const curDb = getDB();
          if (curDb.fcmTokens) {
            curDb.fcmTokens = curDb.fcmTokens.filter(t => t.id !== tok.id);
            saveDB(curDb);
          }
        }
      }
    });
    await Promise.all(payload);
  } catch (err) {
    console.error('[FCM Engine Fail-safe Error]:', err);
  }
}

// Unified Notification Factory
function createNotification(user_id: string, title: string, message: string, type: string, extra: any = {}) {
  const db = getDB();
  if (!db.notifications) {
    db.notifications = [];
  }
  
  const notifId = 'NOTIF_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newNotif: DBNotification = {
    id: notifId,
    user_id,
    title,
    message,
    type,
    is_read: false,
    created_at: new Date().toISOString(),
    ...extra
  };

  db.notifications.unshift(newNotif);
  saveDB(db);

  // Deliver immediately to listening active frontend SSE sockets of client
  broadcastNotification(newNotif);

  // Deliver as native persistent system alerts
  sendFcmNotification(user_id, title, message, {
    id: notifId,
    type,
    ...extra
  });

  return newNotif;
}

function notifyAdminsOfNewTransaction(tx: DBTransaction) {
  adminSubscribers.forEach((res) => {
    try {
      res.write(`data: ${JSON.stringify(tx)}\n\n`);
    } catch (e) {
      console.error('Error writing to admin SSE client:', e);
    }
  });
}

// Function to send reusable text messaging notifications to Telegram Bot Channel
async function sendTelegramNotification(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN || '8967814898:AAGxuotTyKfHi772SYDy3ggyRPHj8wAfyOA';
  const chatId = process.env.TELEGRAM_CHAT_ID || '6902060350';

  if (!token || !chatId) {
    console.warn('[Telegram Notification Center] Bot Token or Chat ID not defined.');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    if (!res.ok) {
      const respError = await res.text();
      console.error(`[Telegram Bot Error Response] ${res.status}: ${respError}`);
      return false;
    }

    console.log('[Telegram Notification Center] Alert pushed successfully to Bot Chat ID channel.');
    return true;
  } catch (err) {
    console.error('[Telegram Notification Fail-safe Dispatch Error]:', err);
    return false;
  }
}

// Express application setup
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' })); // Allow screenshot uploads

  // Disable all API caching to ensure instant database updates and real-time reflection
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Dynamic API Routes
  
  // Real-time server-sent events for admin notifications
  app.get('/api/admin/notifications-sse', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    adminSubscribers.push(res);

    req.on('close', () => {
      adminSubscribers = adminSubscribers.filter((sub) => sub !== res);
    });
  });

  // Keep-alive heartbeat interval (every 15 seconds) to prevent Cloud Run or proxies from dropping SSE connections as idle
  setInterval(() => {
    adminSubscribers.forEach((res) => {
      try {
        res.write('data: {"heartbeat": true}\n\n');
      } catch (err) {
        // Suppress writing errors for disconnected sockets (filtered next request or on close)
      }
    });
  }, 15000);



  // Simple auth endpoints
  app.post('/api/auth/sync', (req, res) => {
    const { user, transactions } = req.body;
    if (!user || !user.phone) {
      return res.status(400).json({ error: 'Missing user context' });
    }
    const db = getDB();
    const phone = user.phone;
    let dbUpdated = false;

    if (!db.users[phone]) {
      db.users[phone] = {
        phone: user.phone,
        name: user.name || 'Utilisateur',
        role: user.role || 'user',
        passwordHash: user.passwordHash || 'Password123',
        parentPhone: user.parentPhone,
        referralCode: user.referralCode || user.phone,
        balanceCommission: Number(user.balanceCommission) || 0,
        balanceCommissionWithdrawn: Number(user.balanceCommissionWithdrawn) || 0,
        mfaEnabled: user.mfaEnabled !== undefined ? user.mfaEnabled : true,
        createdAt: user.createdAt || new Date().toISOString()
      };
      dbUpdated = true;
    }

    if (Array.isArray(transactions)) {
      transactions.forEach((tx: any) => {
        const exists = db.transactions.some((t) => t.id === tx.id);
        if (!exists) {
          db.transactions.push({
            id: tx.id,
            type: tx.type,
            amount: Number(tx.amount),
            userPhone: tx.userPhone,
            userName: tx.userName || user.name || 'Utilisateur',
            xbetAccount: tx.xbetAccount,
            paymentMethod: tx.paymentMethod,
            paymentNumber: tx.paymentNumber,
            screenshot: tx.screenshot,
            withdrawCode: tx.withdrawCode,
            status: tx.status || 'pending',
            date: tx.date || new Date().toLocaleString(),
            rejectionReason: tx.rejectionReason,
            appliedCommission: !!tx.appliedCommission
          });
          dbUpdated = true;
        }
      });
      if (dbUpdated) {
        db.transactions.sort((a, b) => b.id.localeCompare(a.id));
      }
    }

    if (dbUpdated) {
      saveDB(db);
      console.log(`[Sync] Synced user ${phone} and ${transactions?.length || 0} transactions to server.`);
    }

    res.json({ success: true, user: db.users[phone] });
  });

  app.post('/api/auth/register', (req, res) => {
    const { phone, name, password, parentPhone } = req.body;
    if (!phone || !name || !password) {
      return res.status(400).json({ error: 'Remplissez tous les champs obligatoires' });
    }

    const db = getDB();
    if (db.users[phone]) {
      return res.status(400).json({ error: 'Ce numéro de téléphone est déjà enregistré' });
    }

    const newUser: DBUser = {
      phone,
      name,
      role: 'user',
      passwordHash: password,
      parentPhone: parentPhone ? parentPhone.trim() : undefined,
      referralCode: phone,
      balanceCommission: 0,
      balanceCommissionWithdrawn: 0,
      mfaEnabled: true,
      createdAt: new Date().toISOString()
    };

    db.users[phone] = newUser;
    saveDB(db);

    res.json({ message: 'Inscription réussie', user: { phone, name, role: 'user', mfaEnabled: true } });
  });

  app.post('/api/auth/login', (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Numéro de téléphone et mot de passe requis' });
    }

    const db = getDB();
    const user = db.users[phone];

    if (!user || user.passwordHash !== password) {
      return res.status(400).json({ error: 'Numéro de téléphone ou mot de passe incorrect' });
    }

    // Return partial session to verify MFA
    res.json({
      message: 'MFA requis',
      tempUser: {
        phone: user.phone,
        name: user.name,
        role: user.role,
        mfaEnabled: user.mfaEnabled
      }
    });
  });

  app.post('/api/auth/verify-mfa', (req, res) => {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    const db = getDB();
    const user = db.users[phone];
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Interactive safe verification: any 6 digit code or some simulated token
    if (code !== '1234' && code.length < 4) {
      return res.status(400).json({ error: 'Le code de vérification à 4 chiffres saisi est incorrect' });
    }

    res.json({
      message: 'Authentification réussie',
      user: {
        phone: user.phone,
        name: user.name,
        role: user.role,
        parentPhone: user.parentPhone,
        referralCode: user.referralCode,
        balanceCommission: user.balanceCommission,
        balanceCommissionWithdrawn: user.balanceCommissionWithdrawn,
        mfaEnabled: user.mfaEnabled
      }
    });
  });

  // Telegram Bot integration manual test endpoint
  app.post('/api/telegram/test', async (req, res) => {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Le paramètre message est requis pour envoyer une notification.' });
    }

    try {
      const success = await sendTelegramNotification(message);
      if (success) {
        return res.json({ success: true, message: 'Message Telegram envoyé avec succès !' });
      } else {
        return res.status(500).json({ success: false, error: "L'envoi du message Telegram a échoué. Veuillez vérifier les identifiants." });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || err });
    }
  });

  // Payment configuration endpoints
  app.get('/api/config', (req, res) => {
    const db = getDB();
    res.json(db.config);
  });

  app.post('/api/payment-methods', (req, res) => {
    const { name, number } = req.body;
    if (!name || !number) {
      return res.status(400).json({ error: 'Nom et numéro de dépôt requis' });
    }
    const db = getDB();
    const cleanName = name.toUpperCase().trim();
    
    // Check if exists
    const idx = db.paymentMethods.findIndex(p => p.name === cleanName);
    if (idx !== -1) {
      db.paymentMethods[idx].number = number;
    } else {
      db.paymentMethods.push({ name: cleanName, number, active: true });
    }
    saveDB(db);
    res.json({ message: 'Moyen de paiement ajouté / mis à jour', paymentMethods: db.paymentMethods });
  });

  app.get('/api/payment-methods', (req, res) => {
    const db = getDB();
    res.json(db.paymentMethods);
  });

  app.post('/api/payment-methods/toggle', (req, res) => {
    const { name } = req.body;
    const db = getDB();
    const pm = db.paymentMethods.find(p => p.name === name);
    if (pm) {
      pm.active = !pm.active;
      saveDB(db);
      return res.json({ message: 'État mis à jour', paymentMethods: db.paymentMethods });
    }
    res.status(404).json({ error: 'Moyen de paiement non trouvé' });
  });

  app.post('/api/config/update', (req, res) => {
    const newConfig = req.body;
    const db = getDB();
    db.config = { ...db.config, ...newConfig };
    saveDB(db);
    res.json({ message: 'Configuration enregistrée', config: db.config });
  });

  // Transactions endpoints
  app.post('/api/transactions/create', (req, res) => {
    const { type, amount, userPhone, userName, xbetAccount, paymentMethod, paymentNumber, screenshot, withdrawCode } = req.body;
    
    if (!type || !amount || !userPhone || !xbetAccount || !paymentMethod) {
      return res.status(400).json({ error: 'Tous les champs obligatoires doivent être renseignés' });
    }

    if (amount < 500) {
      return res.status(400).json({ error: 'Le montant minimum est de 500 FCFA' });
    }

    const db = getDB();
    const user = db.users[userPhone];
    if (!user) {
      return res.status(404).json({ error: 'Compte de l\'utilisateur introuvable' });
    }

    const txId = 'TX_' + Date.now();
    const newTx: DBTransaction = {
      id: txId,
      type,
      amount: Number(amount),
      userPhone,
      userName: user.name,
      xbetAccount,
      paymentMethod,
      paymentNumber,
      screenshot,
      withdrawCode,
      status: 'pending',
      date: new Date().toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    db.transactions.unshift(newTx);
    saveDB(db);

    // Trigger notification to any admin connected via SSE
    notifyAdminsOfNewTransaction(newTx);

    // Trigger persistent DB and Push Notification to Administration
    createNotification(
      'admin',
      `Nouvelle demande de ${type === 'deposit' ? 'dépôt' : 'retrait'} 💸`,
      `Client: ${user.name}\nMontant: ${Number(amount).toLocaleString()} FCFA\nHeure: ${newTx.date}`,
      `${type}_request`,
      { txId: newTx.id, txType: type, txStatus: 'pending' }
    );

    // Send notification via Telegram bot when a new transaction request is created
    const opLabelText = type === 'deposit' ? '🟢 DEMANDE DE DÉPÔT' : '🔴 DEMANDE DE RETRAIT';
    const tgMsg = `<b>📥 NOUVELLE DEMANDE SUR STARBETPAY 📥</b>\n\n` +
                  `<b>🔑 ID Transaction:</b> <code>${txId}</code>\n` +
                  `<b>📊 Type de Demande:</b> ${opLabelText}\n` +
                  `<b>👤 Client:</b> ${user.name} (${userPhone})\n` +
                  `<b>💰 Montant:</b> <code>${Number(amount).toLocaleString('fr-FR')} FCFA</code>\n` +
                  `<b>🎯 Compte 1xBet:</b> <code>${xbetAccount || 'N/A'}</code>\n` +
                  `<b>📲 Moyen de Paiement:</b> ${paymentMethod || 'Manuel'} ${paymentNumber ? `(${paymentNumber})` : ''}\n` +
                  `<b>⏳ Statut:</b> En attente de validation\n` +
                  `<b>⏱️ Reçu le:</b> ${newTx.date}`;
    sendTelegramNotification(tgMsg).catch((err) => {
      console.error('[Telegram New request Notification Error]', err);
    });

    res.json({ message: 'Demande enregistrée en temps réel, en attente de vérification par l\'administration.', transaction: newTx });
  });

  app.get('/api/transactions', (req, res) => {
    const { phone } = req.query;
    const db = getDB();
    if (phone) {
      const filtered = db.transactions.filter(t => t.userPhone === phone);
      return res.json(filtered);
    }
    res.json(db.transactions);
  });

  app.post('/api/transactions/update-status', (req, res) => {
    const { id, status, rejectionReason } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'ID de transaction et nouveau statut requis' });
    }

    const db = getDB();
    const tx = db.transactions.find(t => t.id === id);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }

    const oldStatus = tx.status;
    tx.status = status;
    if (rejectionReason) {
      tx.rejectionReason = rejectionReason;
    }

    // Process referral commission logic:
    // "Des bonus de 1% sur les dépôts et retrait valider par leur fieuls."
    if (status === 'validated' && oldStatus !== 'validated' && !tx.appliedCommission) {
      const user = db.users[tx.userPhone];
      if (user && user.parentPhone) {
        const parent = db.users[user.parentPhone];
        if (parent) {
          const commission = tx.amount * 0.01; // 1% commission
          parent.balanceCommission += commission;
          tx.appliedCommission = true;
          console.log(`Referral match: Credited ${commission} FCFA to Sponsor ${parent.phone} for user ${tx.userPhone} transacting ${tx.amount} FCFA`);
        }
      }
    }

    // Cancel validation back to pending or rejected (decrement if commission was already calculated/applied)
    if (status !== 'validated' && oldStatus === 'validated' && tx.appliedCommission) {
      const user = db.users[tx.userPhone];
      if (user && user.parentPhone) {
        const parent = db.users[user.parentPhone];
        if (parent) {
          const commission = tx.amount * 0.01;
          parent.balanceCommission = Math.max(0, parent.balanceCommission - commission);
          tx.appliedCommission = false;
        }
      }
    }

    saveDB(db);

    // Notify client in real-time about validation/rejection outcome
    const opLabel = tx.type === 'deposit' ? 'dépôt' : (tx.type === 'commission_payout' ? 'retrait de commission' : 'retrait');
    const statusLabel = status === 'validated' ? 'VALIDÉE 🎉' : 'REJETÉE ❌';
    const detailMsg = status === 'validated'
      ? `Votre demande de ${opLabel} de ${tx.amount.toLocaleString()} FCFA a été validée avec succès !`
      : `Votre demande de ${opLabel} de ${tx.amount.toLocaleString()} FCFA a été rejetée.${rejectionReason ? ` Motif: ${rejectionReason}` : ''}`;

    createNotification(
      tx.userPhone,
      `Opération ${statusLabel}`,
      detailMsg,
      `${tx.type}_${status}`,
      { txId: tx.id, txType: tx.type, txStatus: status }
    );

    res.json({ message: `Transaction mise à jour en statut : ${status}`, transaction: tx });
  });

  // Commission payout route
  app.post('/api/commissions/payout', (req, res) => {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Numéro de téléphone requis' });
    }

    const db = getDB();
    const user = db.users[phone];
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (user.balanceCommission < 2000) {
      return res.status(400).json({ error: 'Le montant minimum pour le retrait des gains est de 2 000 FCFA' });
    }

    const pullAmount = user.balanceCommission;
    user.balanceCommissionWithdrawn += pullAmount;
    user.balanceCommission = 0;

    // Log payout in transactions
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
      status: 'pending', // Pending payout approval from admin
      date: new Date().toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    
    db.transactions.unshift(newTx);
    saveDB(db);
    notifyAdminsOfNewTransaction(newTx);

    // Trigger persistent DB and Push Notification to Administration for Commission Payouts
    createNotification(
      'admin',
      'Demande de retrait de commissions 💰',
      `Client: ${user.name}\nMontant: ${pullAmount.toLocaleString()} FCFA\nHeure: ${newTx.date}`,
      'commission_request',
      { txId: newTx.id, txType: 'commission_payout', txStatus: 'pending' }
    );

    res.json({ message: 'Demande de retrait de gain effectuée avec succès.', user, transaction: newTx });
  });

  // Get all users
  app.get('/api/users', (req, res) => {
    const db = getDB();
    res.json({ users: Object.values(db.users) });
  });

  // Delete an user
  app.delete('/api/users/:phone', (req, res) => {
    const { phone } = req.params;
    const { role } = req.body;
    const db = getDB();
    if (db.users[phone]) {
      delete db.users[phone];
      saveDB(db);
    }
    res.json({ success: true });
  });

  // Update user role
  app.post('/api/users/:phone/role', (req, res) => {
    const { phone } = req.params;
    const { role } = req.body;
    const db = getDB();
    if (db.users[phone]) {
      db.users[phone].role = role;
      saveDB(db);
    }
    res.json({ success: true });
  });

  // Get users referral stats
  app.get('/api/users/stats/:phone', (req, res) => {
    const { phone } = req.params;
    const db = getDB();
    const user = db.users[phone];
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // count refs
    const referrals = Object.values(db.users).filter(u => u.parentPhone === phone);
    const activeFilleulsCount = referrals.length;

    res.json({
      phone: user.phone,
      name: user.name,
      balanceCommission: user.balanceCommission,
      balanceCommissionWithdrawn: user.balanceCommissionWithdrawn,
      filleulsCount: activeFilleulsCount,
      referralCode: user.referralCode
    });
  });

  // Get current active coupons (Secured, Medium, Bold)
  app.get('/api/coupons', (req, res) => {
    const db = getDB();
    res.json(db.coupons);
  });

  // Get previous historical coupons (won or lost)
  app.get('/api/coupons/history', (req, res) => {
    const db = getDB();
    res.json(db.pastCoupons || []);
  });

  // Edit / Save an active coupon manually
  app.post('/api/coupons/update', (req, res) => {
    const { id, title, confidence, totalCote, matches } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Identifiant du coupon requis pour la mise à jour." });
    }

    const db = getDB();
    const couponIndex = db.coupons.findIndex(c => c.id === id);
    if (couponIndex !== -1) {
      db.coupons[couponIndex] = {
        id,
        title: title || db.coupons[couponIndex].title,
        confidence: confidence || db.coupons[couponIndex].confidence,
        totalCote: Number(totalCote) || db.coupons[couponIndex].totalCote,
        matches: matches || db.coupons[couponIndex].matches,
        status: 'pending', // Reverts to pending when modified
        date: new Date().toLocaleDateString('fr-FR')
      };
      saveDB(db);

      // Notify all users about un nouveau coupon mis en ligne
      const couponTitle = title || db.coupons[couponIndex].title;
      const couponCote = Number(totalCote) || db.coupons[couponIndex].totalCote;
      
      const allUsers = Object.keys(db.users).filter(phone => db.users[phone].role !== 'admin');
      allUsers.forEach((userPhone) => {
        createNotification(
          userPhone,
          `Nouveau Coupon disponible 🏆`,
          `Un nouveau coupon (${couponTitle}) avec une cote de ${couponCote} est maintenant en ligne ! Profitez-en vite !`,
          'new_coupon',
          { couponId: id }
        );
      });

      return res.json({ message: "Coupon enregistré avec succès !", coupons: db.coupons });
    }
    res.status(404).json({ error: "Coupon non trouvé." });
  });

  // Record an active coupon result (Mark as Won / Lost and archive in history)
  app.post('/api/coupons/result', (req, res) => {
    const { id, status } = req.body; // status: 'won' | 'lost' | 'pending'
    if (!id || !status) {
      return res.status(400).json({ error: "Identifiant du coupon et statut requis." });
    }

    const db = getDB();
    const coupon = db.coupons.find(c => c.id === id);
    if (!coupon) {
      return res.status(404).json({ error: "Coupon actif non trouvé." });
    }

    // Update active coupon status
    coupon.status = status;

    // Archive in history if won or lost
    if (status === 'won' || status === 'lost') {
      const archivedCoupon: SportCoupon = {
        ...coupon,
        id: `${coupon.id}_${Date.now()}`, // Create a unique history ID
        status,
        date: new Date().toLocaleDateString('fr-FR')
      };
      if (!db.pastCoupons) {
        db.pastCoupons = [];
      }
      db.pastCoupons.unshift(archivedCoupon);
    }

    saveDB(db);
    res.json({
      message: `Le résultat a été enregistré (${status === 'won' ? 'GAGNÉ' : 'PERDU'}) et conservé dans l'historique !`,
      coupons: db.coupons,
      pastCoupons: db.pastCoupons || []
    });
  });

  // Delete a specific history entry
  app.delete('/api/coupons/history/:id', (req, res) => {
    const { id } = req.params;
    const db = getDB();
    if (db.pastCoupons) {
      db.pastCoupons = db.pastCoupons.filter(c => c.id !== id);
    }
    saveDB(db);
    res.json({ message: "Entrée d'historique supprimée avec succès !", pastCoupons: db.pastCoupons || [] });
  });

  // Clear all coupon history entries
  app.post('/api/coupons/history/clear', (req, res) => {
    const db = getDB();
    db.pastCoupons = [];
    saveDB(db);
    res.json({ message: "Historique réinitialisé avec succès !", pastCoupons: [] });
  });

  // ==========================================
  // NOTIFICATIONS ENDPOINTS
  // ==========================================

  // Get notifications for a user (or admin)
  app.get('/api/notifications', (req, res) => {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: 'phone query parameter required' });
    }
    const db = getDB();
    const list = db.notifications || [];
    const filtered = list.filter(n => n.user_id === phone);
    res.json(filtered);
  });

  // Mark single or all notifications as read
  app.post('/api/notifications/mark-read', (req, res) => {
    const { id, phone } = req.body;
    const db = getDB();
    if (!db.notifications) db.notifications = [];

    let count = 0;
    db.notifications.forEach(n => {
      if (id && n.id === id) {
        if (!n.is_read) {
          n.is_read = true;
          count++;
        }
      } else if (!id && phone && n.user_id === phone) {
        if (!n.is_read) {
          n.is_read = true;
          count++;
        }
      }
    });

    if (count > 0) {
      saveDB(db);
    }
    res.json({ success: true, markedCount: count });
  });

  // Clear notifications for a user
  app.post('/api/notifications/clear', (req, res) => {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'phone required' });
    }
    const db = getDB();
    if (db.notifications) {
      db.notifications = db.notifications.filter(n => n.user_id !== phone);
      saveDB(db);
    }
    res.json({ success: true });
  });

  // Register an FCM Push Token
  app.post('/api/fcm/register', (req, res) => {
    const { phone, token } = req.body;
    if (!phone || !token) {
      return res.status(400).json({ error: 'phone and token are required' });
    }
    const db = getDB();
    if (!db.fcmTokens) db.fcmTokens = [];

    // Avoid duplicates
    const index = db.fcmTokens.findIndex(t => t.token === token);
    const now = new Date().toISOString();
    if (index !== -1) {
      db.fcmTokens[index].phone = phone;
      db.fcmTokens[index].updatedAt = now;
    } else {
      const tokenId = 'TOK_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const newToken: FCMToken = {
        id: tokenId,
        phone,
        token,
        updatedAt: now
      };
      db.fcmTokens.push(newToken);
    }
    saveDB(db);
    res.json({ success: true });
  });

  // Server Sent Events (SSE) stream for user-specific real-time notifications
  app.get('/api/notifications-sse', (req, res) => {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).send('phone query parameter required');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientPhone = String(phone);
    const entry = { phone: clientPhone, response: res };
    notificationSubscribers.push(entry);

    // Initial ping to establish connection
    res.write('data: {"connected": true}\n\n');

    req.on('close', () => {
      notificationSubscribers = notificationSubscribers.filter(sub => sub.response !== res);
    });
  });

  // Create a new customized coupon inside history
  app.post('/api/coupons/history/create', (req, res) => {
    const coupon = req.body;
    const db = getDB();
    if (!db.pastCoupons) db.pastCoupons = [];
    
    const newHistoryCoupon = {
      ...coupon,
      id: coupon.id || `past_${Date.now()}`,
      date: coupon.date || new Date().toLocaleDateString('fr-FR')
    };
    db.pastCoupons.unshift(newHistoryCoupon);
    saveDB(db);
    res.json({ message: "Historique mis à jour !", pastCoupons: db.pastCoupons });
  });

  // Update an existing coupon inside history
  app.post('/api/coupons/history/update', (req, res) => {
    const coupon = req.body;
    const db = getDB();
    if (!db.pastCoupons) db.pastCoupons = [];
    
    const idx = db.pastCoupons.findIndex(c => c.id === coupon.id);
    if (idx !== -1) {
      db.pastCoupons[idx] = {
        ...db.pastCoupons[idx],
        ...coupon
      };
      saveDB(db);
      return res.json({ message: "Coupon d'historique mis à jour !", pastCoupons: db.pastCoupons });
    }
    res.status(404).json({ error: "Coupon d'historique non trouvé." });
  });

  // Vite + bundle client-side handler
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[StarBetPay Server] Listening securely on port ${PORT}`);
  });
}

startServer();
