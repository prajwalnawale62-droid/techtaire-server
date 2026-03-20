const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const sessionRoutes = require('./routes/session');
const messageRoutes = require('./routes/messages');
const { authenticateToken } = require('./auth');
const { createSession } = require('./whatsapp');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.set('io', io);

app.use('/api/session', sessionRoutes);
app.use('/api/messages', authenticateToken, messageRoutes);

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Techtaire Server</title>
    <style>
      body{font-family:Arial;text-align:center;padding:40px;background:#f0f0f0;}
      h1{color:#25D366;}
      img{margin-top:20px;border:3px solid #25D366;border-radius:12px;}
      .status{font-size:18px;margin:20px;padding:10px 20px;border-radius:8px;display:inline-block;}
      .connected{background:#25D366;color:white;}
      .pending{background:#FFA500;color:white;}
      .init{background:#999;color:white;}
    </style>
    </head><body>
    <h1>Techtaire WhatsApp Server</h1>
    <div id="status" class="status init">Initializing...</div>
    <div id="qr"></div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
      const socket = io();
      socket.emit('register', 'default');

      fetch('/api/session/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer default_token'
        }
      });

      socket.on('qr', (data) => {
        document.getElementById('qr').innerHTML = '<img src="' + data.qr + '" width="280"/>';
        document.getElementById('status').className = 'status pending';
        document.getElementById('status').innerText = 'Scan QR Code with WhatsApp';
      });

      socket.on('session_status', (data) => {
        if (data.status === 'connected') {
          document.getElementById('status').className = 'status connected';
          document.getElementById('status').innerText = 'WhatsApp Connected!';
          document.getElementById('qr').innerHTML = '';
        }
      });
    </script>
    </body></html>`);
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('register', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room`);
  });
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Auto start default session
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`TechAtire Server running on port ${PORT}`);
  try {
    await createSession('default', io);
    console.log('Default session started');
  } catch (err) {
    console.log('Session start error:', err.message);
  }
});
