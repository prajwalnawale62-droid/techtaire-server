const { sendMessage } = require('./whatsapp');

// In-memory queue per user (production me Redis/Bull use karo)
const userQueues = new Map(); // userId -> { queue: [], processing: false, sentToday: 0, lastReset: Date }

const CONFIG = {
  BATCH_SIZE: 20,          // 20 messages bhejo fir delay
  DELAY_MIN: 10000,        // 10 seconds minimum delay
  DELAY_MAX: 15000,        // 15 seconds maximum delay
  MSG_INTERVAL: 1000,      // 1 second between each message
  DAILY_LIMIT: 3000        // 3000 messages per day
};

function getRandomDelay() {
  return Math.floor(Math.random() * (CONFIG.DELAY_MAX - CONFIG.DELAY_MIN + 1)) + CONFIG.DELAY_MIN;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// User queue initialize karo
function initUserQueue(userId) {
  if (!userQueues.has(userId)) {
    userQueues.set(userId, {
      queue: [],
      processing: false,
      sentToday: 0,
      lastReset: new Date().toDateString(),
      stats: { total: 0, success: 0, failed: 0 }
    });
  }
  return userQueues.get(userId);
}

// Daily limit reset check
function checkAndResetDaily(userQueue) {
  const today = new Date().toDateString();
  if (userQueue.lastReset !== today) {
    userQueue.sentToday = 0;
    userQueue.lastReset = today;
  }
}

// Messages queue me add karo
function addToQueue(userId, messages) {
  const userQueue = initUserQueue(userId);
  checkAndResetDaily(userQueue);

  const remainingLimit = CONFIG.DAILY_LIMIT - userQueue.sentToday;
  if (remainingLimit <= 0) {
    return {
      error: 'Daily limit reached (3000 messages)',
      sentToday: userQueue.sentToday,
      limit: CONFIG.DAILY_LIMIT
    };
  }

  // Limit ke andar hi messages lo
  const messagesToAdd = messages.slice(0, remainingLimit);
  userQueue.queue.push(...messagesToAdd);

  // Agar processing nahi chal rahi to start karo
  if (!userQueue.processing) {
    processQueue(userId);
  }

  return {
    queued: messagesToAdd.length,
    skipped: messages.length - messagesToAdd.length,
    totalInQueue: userQueue.queue.length,
    sentToday: userQueue.sentToday,
    remainingToday: remainingLimit - messagesToAdd.length
  };
}

// Queue process karo with delay system
async function processQueue(userId) {
  const userQueue = userQueues.get(userId);
  if (!userQueue || userQueue.processing) return;

  userQueue.processing = true;
  console.log(`Starting queue processing for user: ${userId}`);

  try {
    let batchCount = 0;

    while (userQueue.queue.length > 0) {
      const item = userQueue.queue.shift();

      try {
        await sendMessage(userId, item.phone, item.message);
        userQueue.sentToday++;
        userQueue.stats.total++;
        userQueue.stats.success++;
        batchCount++;

        console.log(`[${userId}] Sent ${userQueue.stats.total} | Queue: ${userQueue.queue.length} | Today: ${userQueue.sentToday}`);

        // Har 20 messages ke baad delay
        if (batchCount >= CONFIG.BATCH_SIZE && userQueue.queue.length > 0) {
          const delay = getRandomDelay();
          console.log(`[${userId}] Batch of 20 done. Waiting ${delay/1000}s before next batch...`);
          batchCount = 0;
          await sleep(delay);
        } else if (userQueue.queue.length > 0) {
          // Messages ke beech 1 second interval
          await sleep(CONFIG.MSG_INTERVAL);
        }

      } catch (err) {
        console.error(`[${userId}] Failed to send to ${item.phone}:`, err.message);
        userQueue.stats.total++;
        userQueue.stats.failed++;
      }

      // Daily limit check
      if (userQueue.sentToday >= CONFIG.DAILY_LIMIT) {
        console.log(`[${userId}] Daily limit reached!`);
        userQueue.queue = []; // Remaining queue clear
        break;
      }
    }
  } finally {
    userQueue.processing = false;
    console.log(`[${userId}] Queue processing complete`);
  }
}

// Queue status
function getQueueStatus(userId) {
  const userQueue = userQueues.get(userId);
  if (!userQueue) {
    return {
      queueLength: 0,
      processing: false,
      sentToday: 0,
      remainingToday: CONFIG.DAILY_LIMIT,
      stats: { total: 0, success: 0, failed: 0 }
    };
  }

  checkAndResetDaily(userQueue);

  return {
    queueLength: userQueue.queue.length,
    processing: userQueue.processing,
    sentToday: userQueue.sentToday,
    remainingToday: CONFIG.DAILY_LIMIT - userQueue.sentToday,
    dailyLimit: CONFIG.DAILY_LIMIT,
    stats: userQueue.stats,
    config: {
      batchSize: CONFIG.BATCH_SIZE,
      delayMin: CONFIG.DELAY_MIN / 1000 + 's',
      delayMax: CONFIG.DELAY_MAX / 1000 + 's'
    }
  };
}

// Queue clear karo
function clearQueue(userId) {
  const userQueue = userQueues.get(userId);
  if (!userQueue) return { error: 'Queue not found' };

  const cleared = userQueue.queue.length;
  userQueue.queue = [];
  return { cleared };
}

module.exports = { addToQueue, getQueueStatus, clearQueue };
