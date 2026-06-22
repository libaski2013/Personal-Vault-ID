const { Conversation, Message, User } = require('../db/models');

module.exports = async function chatRoutes(fastify) {

  /* GET /api/trustid/chat/conversations — list my conversations */
  fastify.get('/conversations', { onRequest:[fastify.authenticate] }, async (req) => {
    const uid = req.user.userId;
    const convs = await Conversation.find({ participants: uid })
      .sort({ lastActivity: -1 })
      .limit(50);

    /* Populate other participant info */
    const enriched = await Promise.all(convs.map(async (c) => {
      const otherId = c.participants.find(p => p.toString() !== uid.toString());
      const other   = await User.findById(otherId).select('firstName lastName email');
      const unread  = c.unreadCounts ? (c.unreadCounts.get(uid.toString()) || 0) : 0;
      return { ...c.toObject(), other, unread };
    }));

    return { success: true, data: enriched };
  });

  /* POST /api/trustid/chat/start/:userId — start or get conversation */
  fastify.post('/start/:userId', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const me    = req.user.userId;
    const other = req.params.userId;
    if (me.toString() === other.toString())
      return reply.code(400).send({ success:false, message:'Cannot chat with yourself' });

    const otherUser = await User.findById(other).select('firstName lastName email');
    if (!otherUser) return reply.code(404).send({ success:false, message:'User not found' });

    let conv = await Conversation.findOne({
      participants: { $all: [me, other], $size: 2 },
    });

    if (!conv) {
      conv = await Conversation.create({ participants: [me, other] });
    }

    return { success:true, data:{ conversation:conv, other:otherUser } };
  });

  /* GET /api/trustid/chat/messages/:convId — message history */
  fastify.get('/messages/:convId', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const uid  = req.user.userId;
    const conv = await Conversation.findById(req.params.convId);
    if (!conv || !conv.participants.some(p => p.toString() === uid.toString()))
      return reply.code(403).send({ success:false, message:'Not part of this conversation' });

    const page  = parseInt(req.query.page || '1');
    const limit = 50;
    const msgs  = await Message.find({ conversationId: req.params.convId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { success:true, data: msgs.reverse() };
  });

  /* PUT /api/trustid/chat/read/:convId — mark messages as read */
  fastify.put('/read/:convId', { onRequest:[fastify.authenticate] }, async (req) => {
    const uid = req.user.userId;
    await Message.updateMany(
      { conversationId: req.params.convId, to: uid, read: false },
      { $set: { read: true } }
    );
    const update = {};
    update[`unreadCounts.${uid}`] = 0;
    await Conversation.findByIdAndUpdate(req.params.convId, { $set: update });
    return { success: true };
  });

  /* GET /api/trustid/chat/users — search users to start a chat */
  fastify.get('/users', { onRequest:[fastify.authenticate] }, async (req) => {
    const q = (req.query.q || '').trim();
    if (!q) return { success:true, data:[] };
    const users = await User.find({
      _id: { $ne: req.user.userId },
      $or: [
        { firstName: { $regex: q, $options:'i' } },
        { lastName:  { $regex: q, $options:'i' } },
        { email:     { $regex: q, $options:'i' } },
      ],
    }).select('firstName lastName email').limit(10);
    return { success:true, data:users };
  });
};
