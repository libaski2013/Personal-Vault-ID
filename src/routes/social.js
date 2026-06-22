const { SocialSession, AnonChat } = require('../db/models');

const DISCOVERY_TTL_MS = 60 * 60 * 1000;
const CHAT_TTL_MS = 24 * 60 * 60 * 1000;
const ALIASES = ['Nova','Echo','Pulse','Vega','Orbit','Comet','Rune','Pixel','Signal','Drift','Halo','Quest'];

function token(prefix) {
  return prefix + Math.random().toString(36).slice(2, 7).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function alias() {
  return ALIASES[Math.floor(Math.random() * ALIASES.length)] + '-' + Math.floor(100 + Math.random() * 900);
}

module.exports = async function socialRoutes(fastify) {
  fastify.addHook('preHandler', async () => {
    const now = new Date();
    SocialSession.updateMany({ expiresAt:{ $lt:now }, isActive:true }, { isActive:false }).catch(()=>{});
    AnonChat.deleteMany({ expiresAt:{ $lt:now } }).catch(()=>{});
  });

  fastify.post('/discovery/on', { onRequest:[fastify.authenticate] }, async (req) => {
    const zone = String((req.body || {}).zone || 'nearby').trim().toLowerCase().slice(0, 40) || 'nearby';
    const expiresAt = new Date(Date.now() + DISCOVERY_TTL_MS);
    await SocialSession.updateMany({ userId:req.user.userId }, { isActive:false });
    const session = await SocialSession.create({
      userId:req.user.userId,
      token:token('ANON-'),
      alias:alias(),
      zone,
      expiresAt,
    });
    return { success:true, data:{ token:session.token, alias:session.alias, zone:session.zone, expiresAt:session.expiresAt } };
  });

  fastify.post('/discovery/off', { onRequest:[fastify.authenticate] }, async (req) => {
    await SocialSession.updateMany({ userId:req.user.userId }, { isActive:false });
    return { success:true };
  });

  fastify.get('/nearby', { onRequest:[fastify.authenticate] }, async (req) => {
    const zone = String((req.query || {}).zone || 'nearby').trim().toLowerCase().slice(0, 40) || 'nearby';
    const mine = await SocialSession.findOne({ userId:req.user.userId, isActive:true, expiresAt:{ $gt:new Date() } });
    if (!mine) return { success:true, discoverable:false, data:[] };
    const rows = await SocialSession.find({
      userId:{ $ne:req.user.userId, $nin:mine.blocked || [] },
      zone,
      isActive:true,
      expiresAt:{ $gt:new Date() },
    }).sort({ updatedAt:-1 }).limit(30);
    return { success:true, discoverable:true, data:rows.map(r => ({ token:r.token, alias:r.alias, zone:r.zone, expiresAt:r.expiresAt })) };
  });

  fastify.post('/chats', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const otherToken = String((req.body || {}).token || '').trim();
    const other = await SocialSession.findOne({ token:otherToken, isActive:true, expiresAt:{ $gt:new Date() } });
    const mine = await SocialSession.findOne({ userId:req.user.userId, isActive:true, expiresAt:{ $gt:new Date() } });
    if (!other || !mine) return reply.code(404).send({ success:false, message:'Anonymous profile is no longer available' });
    if (String(other.userId) === String(req.user.userId))
      return reply.code(400).send({ success:false, message:'Cannot chat with your own anonymous profile' });

    let chat = await AnonChat.findOne({
      participants:{ $all:[req.user.userId, other.userId] },
      expiresAt:{ $gt:new Date() },
      isDisconnected:false,
    });
    if (!chat) {
      chat = await AnonChat.create({
        participants:[req.user.userId, other.userId],
        participantTokens:[mine.token, other.token],
        expiresAt:new Date(Date.now() + CHAT_TTL_MS),
      });
    }
    return { success:true, data:chat };
  });

  fastify.get('/chats', { onRequest:[fastify.authenticate] }, async (req) => {
    const chats = await AnonChat.find({
      participants:req.user.userId,
      expiresAt:{ $gt:new Date() },
      isDisconnected:false,
    }).sort({ updatedAt:-1 }).limit(20);
    return { success:true, data:chats };
  });

  fastify.post('/chats/:id/messages', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const text = String((req.body || {}).text || '').trim().slice(0, 1200);
    if (!text) return reply.code(400).send({ success:false, message:'Message required' });
    const chat = await AnonChat.findOne({ _id:req.params.id, participants:req.user.userId, expiresAt:{ $gt:new Date() }, isDisconnected:false });
    if (!chat) return reply.code(404).send({ success:false, message:'Chat not found or expired' });
    chat.messages.push({ senderId:req.user.userId, text });
    await chat.save();
    return { success:true, data:chat };
  });

  fastify.post('/chats/:id/disconnect', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const chat = await AnonChat.findOne({ _id:req.params.id, participants:req.user.userId });
    if (!chat) return reply.code(404).send({ success:false, message:'Chat not found' });
    chat.isDisconnected = true;
    await chat.save();
    return { success:true };
  });

  fastify.post('/chats/:id/report', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const chat = await AnonChat.findOne({ _id:req.params.id, participants:req.user.userId });
    if (!chat) return reply.code(404).send({ success:false, message:'Chat not found' });
    chat.reports.push({ reporterId:req.user.userId, reason:String((req.body || {}).reason || 'Reported by user').slice(0, 400) });
    chat.isDisconnected = true;
    await chat.save();
    return { success:true, message:'Reported and disconnected' };
  });

  fastify.post('/block/:token', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const other = await SocialSession.findOne({ token:req.params.token });
    if (!other) return reply.code(404).send({ success:false, message:'Anonymous profile not found' });
    await SocialSession.updateMany({ userId:req.user.userId }, { $addToSet:{ blocked:other.userId } });
    await AnonChat.updateMany({ participants:{ $all:[req.user.userId, other.userId] } }, { isDisconnected:true });
    return { success:true };
  });
};
