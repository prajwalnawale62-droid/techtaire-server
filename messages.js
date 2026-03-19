const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

// Har user ka alag session store
const sessions = new Map(); // userId -> { client, status, qr }

async function createSession(userId, io) {
  // Agar session pehle se hai to return karo
  if (sessions.has(userId)) {
    const existing = sessions.get(userId);
    if (existing.status === 'connected') {
      return { status: 'already_connected' };
    }
  }

  console.log(`Creating session for user: ${userId}`);

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `user_${userId}`, // Har user ka alag folder
      dataPath: './sessions'       // Sessions store path
    }),
    puppeteer: {
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

  // QR Code generate hone par - sirf us user ko bhejo
  client.on('qr', async (qr) => {
    console.log(`QR generated for user: ${userId}`);
    try {
      const qrDataURL = await qrcode.toDataURL(qr);
      sessions.get(userId).qr = qrDataURL;
      sessions.get(userId).status = 'qr_ready';

      // Sirf us user ke room me bhejo (private!)
      io.to(`user_${userId}`).emit('qr', {
        userId,
        qr: qrDataURL
      });
    } catch (err) {
      console.error('QR generation error:', err);
    }
  });

  // Connected
  client.on('ready', () => {
    console.log(`WhatsApp connected for user: ${userId}`);
    sessions.get(userId).status = 'connected';
    sessions.get(userId).qr = null;

    io.to(`user_${userId}`).emit('session_status', {
      userId,
      status: 'connected'
    });
  });

  // Disconnected
  client.on('disconnected', (reason) => {
    console.log(`User ${userId} disconnected:`, reason);
    sessions.get(userId).status = 'disconnected';

    io.to(`user_${userId}`).emit('session_status', {
      userId,
      status: 'disconnected',
      reason
    });
  });

  // Auth failure
  client.on('auth_failure', () => {
    console.log(`Auth failed for user: ${userId}`);
    sessions.get(userId).status = 'auth_failed';
    sessions.delete(userId);

    io.to(`user_${userId}`).emit('session_status', {
      userId,
      status: 'auth_failed'
    });
  });

  await client.initialize();
  return { status: 'initializing' };
}

// Session status check
function getSessionStatus(userId) {
  if (!sessions.has(userId)) {
    return { status: 'not_found' };
  }
  const session = sessions.get(userId);
  return {
    status: session.status,
    hasQR: !!session.qr
  };
}

// Session destroy
async function destroySession(userId) {
  if (!sessions.has(userId)) {
    return { error: 'Session not found' };
  }
  const session = sessions.get(userId);
  try {
    await session.client.destroy();
    sessions.delete(userId);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

// Message send karo (queue se call hoga)
async function sendMessage(userId, phone, message) {
  if (!sessions.has(userId)) {
    throw new Error('Session not found');
  }

  const session = sessions.get(userId);
  if (session.status !== 'connected') {
    throw new Error('WhatsApp not connected');
  }

  // Phone number format: 919876543210@c.us
  const chatId = phone.includes('@') ? phone : `${phone}@c.us`;

  await session.client.sendMessage(chatId, message);
  return { success: true };
}

// All active sessions (admin only)
function getAllSessions() {
  const result = [];
  sessions.forEach((session, userId) => {
    result.push({
      userId,
      status: session.status
    });
  });
  return result;
}

module.exports = {
  createSession,
  getSessionStatus,
  destroySession,
  sendMessage,
  getAllSessions
};
