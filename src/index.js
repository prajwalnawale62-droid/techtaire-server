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

app.set('io', io);

app.use('/api/session', sessionRoutes);
app.use('/api/messages', authenticateToken, messageRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'TechAtire Server Running', version: '1.0.0' });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('register', (userId) => {
    socket.join(`user_${userId}`);
  });
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`TechAtire Server running on port ${PORT}`);
});
