const express = require('express');
const router = express.Router();
const { createSession, getSessionStatus, destroySession, getAllSessions } = require('../whatsapp');
const { authenticateToken, registerUser, loginUser } = require('../auth');

router.post('/register', (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'userId and password required' });
  const result = registerUser(userId, password);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

router.post('/login', (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'userId and password required' });
  const result = loginUser(userId, password);
  if (result.error) return res.status(401).json(result);
  res.json(result);
});

router.post('/connect', authenticateToken, async (req, res) => {
  const io = req.app.get('io');
  try {
    const result = await createSession(req.userId, io);
    res.json({ message: 'Session starting', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', authenticateToken, (req, res) => {
  res.json(getSessionStatus(req.userId));
});

router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    res.json(await destroySession(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  res.json(getAllSessions());
});

module.exports = router;
