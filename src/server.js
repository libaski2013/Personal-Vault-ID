const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const connectDB = require('./db/mongoose');
const { PORT, FRONTEND_URL, NODE_ENV } = require('./config/env');
const trustidRoutes = require('./routes/trustidRoutes');

const app = express();
const server = http.createServer(app);
const corsOrigins = FRONTEND_URL === '*' ? '*' : FRONTEND_URL.split(',').map(u => u.trim());
const io = new Server(server, {
  cors: { origin: corsOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], credentials: true },
  transports: ['websocket', 'polling'],
});

app.set('io', io);
io.on('connection', socket => console.log('[socket] connected', socket.id));

connectDB().catch(err => {
  console.error('MongoDB connection error:', err.message);
});

app.use(cors({ origin: corsOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (_req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({ status: 'ok', app: 'trustid', uptime: process.uptime(), db: dbState[mongoose.connection.readyState] || 'unknown' });
});

app.get('/', (_req, res) => res.redirect('/trustid/'));
app.use('/api/trustid', trustidRoutes);

app.use('/api', (req, res) => res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` }));
app.use((req, res) => res.sendFile(path.join(__dirname, '../public/trustid/index.html')));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error.' });
});

server.listen(PORT, () => console.log(`TrustID app running on port ${PORT} [${NODE_ENV}]`));

module.exports = app;
