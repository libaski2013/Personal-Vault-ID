const { Todo } = require('../db/models');

module.exports = async function todoRoutes(fastify) {
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (req) => {
    const data = await Todo.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    return { success: true, data };
  });

  fastify.post('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { title, priority, category } = req.body || {};
    if (!title) return reply.code(400).send({ success: false, message: 'title required' });
    const data = await Todo.create({ userId: req.user.userId, title, priority: priority || 'medium', category: category || 'General' });
    return reply.code(201).send({ success: true, data });
  });

  fastify.put('/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const data = await Todo.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      req.body,
      { new: true }
    );
    if (!data) return reply.code(404).send({ success: false, message: 'Todo not found' });
    return { success: true, data };
  });

  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const doc = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!doc) return reply.code(404).send({ success: false, message: 'Todo not found' });
    return { success: true };
  });
};
