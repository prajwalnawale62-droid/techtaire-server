const { sendMessage } = require('./whatsapp');

const userQueues = new Map();

const CONFIG = {
  BATCH_SIZE: 20,
  DELAY_MIN: 10000,
  DELAY_MAX: 15000,
  MSG_INTERVAL: 1000,
  DAILY_LIMIT: 3000
};

function getRandomDelay() {
  return Math.floor(Math.random() * (CONFIG.DELAY_MAX - CONFIG.DELAY_MIN + 1)) + CONFIG.DELAY_MIN;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function initUserQueue(userId) {
  if (!userQueues.has(userId)) {
    userQueues.set(userId, {
      queue: [], processing: false, sentToday: 0,
      lastReset: new Date().toDateString(),
      stats: { total: 0, success: 0, failed: 0 }
    });
  }
  return userQueues.get(userId);
}

function checkAndResetDaily(userQueue) {
  const today = new Date().toDateString();
  if (userQueue.lastReset !== today) {
    userQueue.sentToday = 0;
    userQueue.lastReset = today;
  }
}

function addToQueue(userId, messages) {
  const userQueue = initUserQueue(userId);
  checkAndResetDaily(userQueue);
  const remainingLimit = CONFIG.DAILY_LIMIT - userQueue.sentToday;
  if (remainingLimit <= 0) {
    return { error: 'Daily limit reached (3000 messages)', sentToday: userQueue.sentToday };
  }
  const messagesToAdd = messages.slice(0, remainingLimit);
  userQueue.queue.push(...messagesToAdd);
  if (!userQueue.processing) processQueue(userId);
  return {
    queued: messagesToAdd.length,
    skipped: messages.length - messagesToAdd.length,
    totalInQueue: userQueue.queue.length,
    sentToday: userQueue.sentToday,
    remainingToday: remainingLimit - messagesToAdd.length
  };
}

async function processQueue(userId) {
  const userQueue = userQueues.get(userId);
  if (!userQueue || userQueue.processing) return;
  userQueue.processing = true;
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
        if (batchCount >= CONFIG.BATCH_SIZE && userQueue.queue.length > 0) {
          const delay = getRandomDelay();
          batchCount = 0;
          await sleep(delay);
        } else if (userQueue.queue.length > 0) {
          await sleep(CONFIG.MSG_INTERVAL);
        }
      } catch (err) {
        userQueue.stats.total++;
        userQueue.stats.failed++;
      }
      if (userQueue.sentToday >= CONFIG.DAILY_LIMIT) {
        userQueue.queue = [];
        break;
      }
    }
  } finally {
    userQueue.processing = false;
  }
}

function getQueueStatus(userId) {
  const userQueue = userQueues.get(userId);
  if (!userQueue) return { queueLength: 0, processing: false, sentToday: 0, remainingToday: CONFIG.DAILY_LIMIT };
  checkAndResetDaily(userQueue);
  return {
    queueLength: userQueue.queue.length,
    processing: userQueue.processing,
    sentToday: userQueue.sentToday,
    remainingToday: CONFIG.DAILY_LIMIT - userQueue.sentToday,
    dailyLimit: CONFIG.DAILY_LIMIT,
    stats: userQueue.stats
  };
}

function clearQueue(userId) {
  const userQueue = userQueues.get(userId);
  if (!userQueue) return { error: 'Queue not found' };
  const cleared = userQueue.queue.length;
  userQueue.queue = [];
  return { cleared };
}

module.exports = { addToQueue, getQueueStatus, clearQueue };
