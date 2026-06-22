require('dotenv').config();
const path    = require('path');
const Fastify = require('fastify');
const attachSocket = require('./socket');
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
/* Public feature flags (used by client for feature gating) */
fastify.get('/api/trustid/features', async () => {
  try {
    const { Feature } = require('./db/models');
    const features = await Feature.find().select('name enabled tiers icon label href');
    return { success:true, data:features };
  } catch { return { success:true, data:[] }; }
});
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

  /* ── Socket.io — ephemeral real-time chat ── */
  attachSocket(fastify.server, (token) => fastify.jwt.decode(token));

  /* Connect DB */
  connectDB().catch(err => {
    console.error('MongoDB connection failed:', err.message);
  });
};

start();
