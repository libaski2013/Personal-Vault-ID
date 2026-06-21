require('dotenv').config();
const path = require('path');
const Fastify = require('fastify');
const connectDB = require('./db/mongoose');

const PORT = parseInt(process.env.PORT || '5000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'trustid-dev-secret-change-in-production';
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
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ success: false, message: 'Unauthorized' });
  }
});

fastify.decorate('requireAdmin', async function (request, reply) {
  try {
    await request.jwtVerify();
    if (request.user.role !== 'admin') {
      reply.code(403).send({ success: false, message: 'Admin access required' });
    }
  } catch {
    reply.code(401).send({ success: false, message: 'Unauthorized' });
  }
});

/* ── Static files ── */
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, '../public'),
  prefix: '/',
  index: false,
});

/* ── Health ── */
fastify.get('/health', async () => ({
  status: 'ok', app: 'personal-vault', uptime: process.uptime(), env: NODE_ENV,
}));

/* ── Root redirect ── */
fastify.get('/', async (req, reply) => reply.redirect('/trustid/'));

/* ── API routes ── */
fastify.register(require('./routes/auth'),       { prefix: '/api/trustid/auth' });
fastify.register(require('./routes/documents'),  { prefix: '/api/trustid/documents' });
fastify.register(require('./routes/expenses'),   { prefix: '/api/trustid/expenses' });
fastify.register(require('./routes/reminders'),  { prefix: '/api/trustid/reminders' });
fastify.register(require('./routes/todos'),      { prefix: '/api/trustid/todos' });
fastify.register(require('./routes/admin'),      { prefix: '/api/trustid/admin' });
fastify.register(require('./routes/academics'),  { prefix: '/api/trustid/academics' });
fastify.register(require('./routes/vault'),      { prefix: '/api/trustid/vault' });
fastify.register(require('./routes/lifestory'),  { prefix: '/api/trustid/life' });
fastify.register(require('./routes/legacy'),     { prefix: '/api/trustid/legacy' });
fastify.register(require('./routes/share'),      { prefix: '/api/trustid/share' });

/* ── Track user activity on every authenticated API call ── */
fastify.addHook('onRequest', async (request) => {
  try {
    if (request.url.startsWith('/api/') && request.headers.authorization) {
      const payload = fastify.jwt.decode(request.headers.authorization.replace('Bearer ',''));
      if (payload && payload.userId) {
        const { User } = require('./db/models');
        User.findByIdAndUpdate(payload.userId, { lastActivity: new Date() }).catch(()=>{});
      }
    }
  } catch {}
});

/* ── Fallback: serve trustid HTML pages ── */
fastify.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith('/trustid')) {
    return reply.sendFile('trustid/index.html');
  }
  reply.code(404).send({ success: false, message: `Route ${request.url} not found` });
});

/* ── Start ── */
const start = async () => {
  /* Start HTTP server first — static files work even without DB */
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`TrustID running on port ${PORT} [${NODE_ENV}]`);

  /* Connect DB separately — API routes fail gracefully if DB is down */
  connectDB().catch(err => {
    console.error('MongoDB connection failed:', err.message);
    console.error('Static pages still work. Fix MONGODB_URI to enable API.');
  });
};

start();
