const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const sessions = new Map();

async function createSession(userId, io) {
  if (sessions.has(userId)) {
    const existing = sessions.get(userId);
    if (existing.status === 'connected') {
      return { status: 'already_connected' };
    }
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `user_${userId}`,
      dataPath: './sessions'
    }),
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    }
  });

  sessions.set(userId, { client, status: 'initializing', qr: null });

  client.on('qr', async (qr) => {
    try {
      const qrDataURL = await qrcode.toDataURL(qr);
      sessions.get(userId).qr = qrDataURL;
      sessions.get(userId).status = 'qr_ready';
      io.to(`user_${userId}`).emit('qr', { userId, qr: qrDataURL });
      console.log(`QR generated for user: ${userId}`);
    } catch (err) {
      console.error('QR error:', err);
    }
  });

  client.on('authenticated', () => {
    console.log(`Authenticated: ${userId}`);
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`Loading ${userId}: ${percent}% - ${message}`);
  });

  client.on('ready', () => {
    sessions.get(userId).status = 'connected';
    sessions.get(userId).qr = null;
    io.to(`user_${userId}`).emit('session_status', { userId, status: 'connected' });
    console.log(`WhatsApp Connected: ${userId}`);
  });

  client.on('disconnected', (reason) => {
    sessions.get(userId).status = 'disconnected';
    io.to(`user_${userId}`).emit('session_status', { userId, status: 'disconnected', reason });
    console.log(`Disconnected: ${userId} - ${reason}`);
  });

  client.on('auth_failure', () => {
    sessions.delete(userId);
    io.to(`user_${userId}`).emit('session_status', { userId, status: 'auth_failed' });
    console.log(`Auth failed: ${userId}`);
  });

  await client.initialize();
  return { status: 'initializing' };
}

function getSessionStatus(userId) {
  if (!sessions.has(userId)) return { status: 'not_found' };
  const session = sessions.get(userId);
  return { status: session.status, hasQR: !!session.qr };
}

async function destroySession(userId) {
  if (!sessions.has(userId)) return { error: 'Session not found' };
  try {
    await sessions.get(userId).client.destroy();
    sessions.delete(userId);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

async function sendMessage(userId, phone, message) {
  if (!sessions.has(userId)) throw new Error('Session not found');
  const session = sessions.get(userId);
  if (session.status !== 'connected') throw new Error('WhatsApp not connected');
  const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
  await session.client.sendMessage(chatId, message);
  return { success: true };
}

function getAllSessions() {
  const result = [];
  sessions.forEach((session, userId) => {
    result.push({ userId, status: session.status });
  });
  return result;
}

module.exports = { createSession, getSessionStatus, destroySession, sendMessage, getAllSessions };
