const express = require('express');
const router = express.Router();
const { addToQueue, getQueueStatus, clearQueue } = require('../queue');

router.post('/send', (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone and message required' });
  const result = addToQueue(req.userId, [{ phone, message }]);
  if (result.error) return res.status(429).json(result);
  res.json({ success: true, ...result });
});

router.post('/send-bulk', (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }
  for (const msg of messages) {
    if (!msg.phone || !msg.message) {
      return res.status(400).json({ error: 'Each message needs phone and message fields' });
    }
  }
  const result = addToQueue(req.userId, messages);
  if (result.error) return res.status(429).json(result);
  res.json({ success: true, ...result });
});

router.get('/queue-status', (req, res) => {
  res.json(getQueueStatus(req.userId));
});

router.delete('/clear-queue', (req, res) => {
  res.json(clearQueue(req.userId));
});

module.exports = router;
