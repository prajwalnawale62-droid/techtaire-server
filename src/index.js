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
  res.send(`<!DOCTYPE html><html><head><title>Techtaire Server</title>
    <style>
      body{font-family:Arial;text-align:center;padding:40px;background:#f0f0f0;}
      h1{color:#25D366;}
      img{margin-top:20px;border:3px solid #25D366;border-radius:12px;}
      .status{font-size:18px;margin:20px;padding:10px 20px;border-radius:8px;display:inline-block;}
      .connected{background:#25D366;color:white;}
      .pending{background:#FFA500;color:white;}
      .init{background:#999;color:white;}
      input{padding:10px;margin:5px;border-radius:8px;border:1px solid #ccc;font-size:16px;}
      button{padding:10px 20px;background:#25D366;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;margin:5px;}
      button:hover{background:#128C7E;}
    </style>
    </head><body>
    <h1>Techtaire WhatsApp Server</h1>
    <div id="status" class="status init">Enter User ID to connect</div>
    <br>
    <input type="text" id="userId" placeholder="Enter your User ID" />
    <br>
    <button onclick="connect()">Connect WhatsApp</button>
    <div id="qr"></div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
      const socket = io();
      let currentUserId = null;

      function connect() {
        const userId = document.getElementById('userId').value.trim();
        if (!userId) { alert('Please enter User ID'); return; }
        currentUserId = userId;
        socket.emit('register', userId);
        document.getElementById('status').className = 'status pending';
        document.getElementById('status').innerText = 'Connecting...';
        fetch('/api/session/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token_' + userId) },
        }).then(r => r.json()).then(data => {
          console.log('Connect response:', data);
        }).catch(err => {
          document.getElementById('status').innerText = 'Error: ' + err.message;
        });
      }

      socket.on('qr', (data) => {
        document.getElementById('qr').innerHTML = '<img src="' + data.qr + '" width="280"/>';
        document.getElementById('status').className = 'status pending';
        document.getElementById('status').innerText = 'Scan QR Code with WhatsApp';
      });

      socket.on('session_status', (data) => {
        if (data.status === 'connected') {
          document.getElementById('status').className = 'status connected';
          document.getElementById('status').innerText = '✅ WhatsApp Connected!';
          document.getElementById('qr').innerHTML = '';
        } else if (data.status === 'disconnected') {
          document.getElementById('status').className = 'status init';
          document.getElementById('status').innerText = 'Disconnected — Try again';
          document.getElementById('qr').innerHTML = '';
        } else if (data.status === 'auth_failed') {
          document.getElementById('status').className = 'status init';
          document.getElementById('status').innerText = 'Auth Failed — Try again';
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`TechAtire Server running on port ${PORT}`);
});
