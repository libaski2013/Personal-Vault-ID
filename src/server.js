require('dotenv').config();
const path    = require('path');
const Fastify = require('fastify');
const { Server } = require('socket.io');
const connectDB = require('./db/mongoose');

const PORT         = parseInt(process.env.PORT || '5000', 10);
const NODE_ENV     = process.env.NODE_ENV || 'development';
const JWT_SECRET   = process.env.JWT_SECRET || 'trustid-dev-secret-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

const fastify = Fastify({ logger: NODE_ENV === 'development' });

/* ── CORS ── */
fastify.register(require('@fastify/cors'), {
  origin: FRONTEND_URL === '*' ? true : FRONTEND_URL.split(',').map(u => u.trim()),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

/* ── JWT ── */
fastify.register(require('@fastify/jwt'), { secret: JWT_SECRET });

fastify.decorate('authenticate', async function (request, reply) {
  try { await request.jwtVerify(); }
  catch { reply.code(401).send({ success:false, message:'Unauthorized' }); }
});

fastify.decorate('requireAdmin', async function (request, reply) {
  try {
    await request.jwtVerify();
    if (request.user.role !== 'admin')
      reply.code(403).send({ success:false, message:'Admin access required' });
  } catch { reply.code(401).send({ success:false, message:'Unauthorized' }); }
});

/* ── Static files ── */
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, '../public'),
  prefix: '/',
  index: false,
});

/* ── Health ── */
fastify.get('/health', async () => ({
  status:'ok', app:'personal-vault', uptime:process.uptime(), env:NODE_ENV,
}));

/* ── Root redirect ── */
fastify.get('/', async (req, reply) => reply.redirect('/trustid/'));

/* ── API routes ── */
fastify.register(require('./routes/auth'),       { prefix:'/api/trustid/auth' });
fastify.register(require('./routes/documents'),  { prefix:'/api/trustid/documents' });
fastify.register(require('./routes/expenses'),   { prefix:'/api/trustid/expenses' });
fastify.register(require('./routes/reminders'),  { prefix:'/api/trustid/reminders' });
fastify.register(require('./routes/todos'),      { prefix:'/api/trustid/todos' });
fastify.register(require('./routes/admin'),      { prefix:'/api/trustid/admin' });
fastify.register(require('./routes/academics'),  { prefix:'/api/trustid/academics' });
fastify.register(require('./routes/vault'),      { prefix:'/api/trustid/vault' });
fastify.register(require('./routes/lifestory'),  { prefix:'/api/trustid/life' });
fastify.register(require('./routes/legacy'),     { prefix:'/api/trustid/legacy' });
fastify.register(require('./routes/share'),      { prefix:'/api/trustid/share' });
fastify.register(require('./routes/chat'),       { prefix:'/api/trustid/chat' });
try { fastify.register(require('./routes/social'), { prefix:'/api/trustid/social' }); } catch {}

/* ── Track user activity ── */
fastify.addHook('onRequest', async (request) => {
  try {
    if (request.url.startsWith('/api/') && request.headers.authorization) {
      const payload = fastify.jwt.decode(request.headers.authorization.replace('Bearer ',''));
      if (payload && payload.userId) {
        const { User } = require('./db/models');
        User.findByIdAndUpdate(payload.userId, { lastActivity:new Date() }).catch(()=>{});
      }
    }
  } catch {}
});

/* ── Fallback: serve HTML pages ── */
fastify.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith('/trustid')) return reply.sendFile('trustid/index.html');
  reply.code(404).send({ success:false, message:`Route ${request.url} not found` });
});

/* ── Start ── */
const start = async () => {
  await fastify.listen({ port:PORT, host:'0.0.0.0' });
  console.log(`Personal Vault running on port ${PORT} [${NODE_ENV}]`);

  /* ── Socket.io — attach after HTTP server is ready ── */
  const io = new Server(fastify.server, {
    cors: { origin:'*', methods:['GET','POST'] },
    transports: ['websocket', 'polling'],
    pingTimeout:  20000,
    pingInterval: 10000,
  });

  /* Online users map: userId → socketId */
  const online = new Map();

  io.on('connection', (socket) => {

    /* User identifies themselves with their JWT token */
    socket.on('chat:join', async (token) => {
      try {
        const payload = fastify.jwt.decode(token);
        if (!payload || !payload.userId) return;
        const userId = String(payload.userId);
        socket.data.userId = userId;
        socket.join('user:' + userId);
        online.set(userId, socket.id);
        /* Tell everyone this user is online */
        io.emit('chat:online', { userId, online: true });
        console.log('[socket] user joined:', userId);
      } catch (e) { console.error('[socket] join error:', e.message); }
    });

    /* Send a message */
    socket.on('chat:send', async ({ conversationId, to, text }) => {
      try {
        const fromId = socket.data.userId;
        if (!fromId || !text || !text.trim()) return;

        const { Conversation, Message } = require('./db/models');

        /* Save message to DB */
        const msg = await Message.create({
          conversationId, from: fromId, to, text: text.trim(),
        });

        /* Update conversation metadata */
        const incKey = `unreadCounts.${to}`;
        const upd = { lastMessage: text.trim(), lastSenderId: fromId, lastActivity: new Date() };
        upd[incKey] = 1;   /* will use $inc below */
        await Conversation.findByIdAndUpdate(conversationId, {
          $set: { lastMessage: text.trim(), lastSenderId: fromId, lastActivity: new Date() },
          $inc: { [incKey]: 1 },
        });

        const outMsg = { ...msg.toObject(), _id: msg._id.toString() };

        /* Deliver to recipient instantly */
        io.to('user:' + to).emit('chat:message', outMsg);
        /* Echo back to sender (confirmation) */
        socket.emit('chat:message:sent', outMsg);

      } catch (e) { console.error('[socket] send error:', e.message); }
    });

    /* Typing indicator */
    socket.on('chat:typing', ({ to, conversationId }) => {
      io.to('user:' + to).emit('chat:typing', {
        from: socket.data.userId, conversationId, ts: Date.now(),
      });
    });

    /* Mark read */
    socket.on('chat:read', async ({ conversationId, from }) => {
      try {
        const uid = socket.data.userId;
        const { Message, Conversation } = require('./db/models');
        await Message.updateMany({ conversationId, to: uid, read:false }, { $set:{ read:true } });
        const key = `unreadCounts.${uid}`;
        await Conversation.findByIdAndUpdate(conversationId, { $set:{ [key]: 0 } });
        /* Notify sender that messages were read */
        io.to('user:' + from).emit('chat:read', { conversationId, by: uid });
      } catch {}
    });

    socket.on('disconnect', () => {
      const uid = socket.data.userId;
      if (uid) {
        online.delete(uid);
        io.emit('chat:online', { userId: uid, online: false });
      }
    });
  });

  /* Expose io globally for routes if needed */
  global._pvIo = io;

  /* Connect DB */
  connectDB().catch(err => {
    console.error('MongoDB connection failed:', err.message);
  });
};

start();
