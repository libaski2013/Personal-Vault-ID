const { Document, User } = require('../db/models');

module.exports = async function documentRoutes(fastify) {
  /* GET /api/trustid/documents — user's own docs */
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (req) => {
    const docs = await Document.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    return { success: true, data: docs };
  });

  /* POST /api/trustid/documents — upload a doc */
  fastify.post('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { name, type, category } = req.body || {};
    if (!type) return reply.code(400).send({ success: false, message: 'type is required' });

    const doc = await Document.create({ userId: req.user.userId, name: name || type, type, category: category || 'other' });

    /* Update trust score */
    await User.findByIdAndUpdate(req.user.userId, { $inc: { 'trustId.score': 10 } });

    return reply.code(201).send({ success: true, data: doc });
  });

  /* GET /api/trustid/documents/all — admin view all docs with user info */
  fastify.get('/all', { onRequest: [fastify.requireAdmin] }, async () => {
    const docs = await Document.find().sort({ createdAt: -1 }).populate('userId', 'firstName lastName email');
    return {
      success: true,
      data: docs.map(d => ({ ...d.toObject(), user: d.userId })),
    };
  });

  /* PUT /api/trustid/documents/:id/verify */
  fastify.put('/:id/verify', { onRequest: [fastify.requireAdmin] }, async (req, reply) => {
    const doc = await Document.findByIdAndUpdate(req.params.id, { status: 'verified' }, { new: true });
    if (!doc) return reply.code(404).send({ success: false, message: 'Document not found' });

    await User.findByIdAndUpdate(doc.userId, { $inc: { 'trustId.score': 25 } });
    return { success: true, data: doc };
  });

  /* PUT /api/trustid/documents/:id/reject */
  fastify.put('/:id/reject', { onRequest: [fastify.requireAdmin] }, async (req, reply) => {
    const { reason } = req.body || {};
    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', rejectionReason: reason || '' },
      { new: true }
    );
    if (!doc) return reply.code(404).send({ success: false, message: 'Document not found' });
    return { success: true, data: doc };
  });
};
