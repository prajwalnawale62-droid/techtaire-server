const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'techatire_secret_key_change_in_production';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.userId = user.userId;
    next();
  });
}

const users = new Map();

function registerUser(userId, password) {
  if (users.has(userId)) {
    return { error: 'User already exists' };
  }
  const token = generateToken(userId);
  users.set(userId, { password, token });
  return { token, userId };
}

function loginUser(userId, password) {
  const user = users.get(userId);
  if (!user || user.password !== password) {
    return { error: 'Invalid credentials' };
  }
  const token = generateToken(userId);
  return { token, userId };
}

module.exports = { generateToken, authenticateToken, registerUser, loginUser };
