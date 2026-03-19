const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const sessionRoutes = require('./routes/session');
const messageRoutes = require('./routes/messages');
const { authenticateToken } = require('./auth');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Make io available in routes
app.set('io', io);

// Routes
app.use('/api/session', sessionRoutes);
app.use('/api/messages', authenticateToken, messageRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'TechAtire Server Running', version: '1.0.0' });
});

// Socket.io - QR delivery per user
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // User apna userId register karta hai
  socket.on('register', (userId) => {
    socket.join(`user_${userId}`); // Private room per user
    console.log(`User ${userId} joined room`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`TechAtire Server running on port ${PORT}`);
});
