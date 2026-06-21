const { Expense } = require('../db/models');

const CAT_ICONS = { Food:'🍔', Entertainment:'🎬', Utilities:'⚡', Health:'💊', Transport:'🚗', Shopping:'🛍️', Other:'💸' };

module.exports = async function expenseRoutes(fastify) {
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (req) => {
    const data = await Expense.find({ userId: req.user.userId }).sort({ date: -1 });
    return { success: true, data };
  });

  fastify.post('/', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { title, amount, category } = req.body || {};
    if (!title || amount == null) return reply.code(400).send({ success: false, message: 'title and amount required' });
    const data = await Expense.create({
      userId: req.user.userId, title, amount: parseFloat(amount),
      category: category || 'Other', icon: CAT_ICONS[category] || '💸',
      date: new Date(),
    });
    return reply.code(201).send({ success: true, data });
  });

  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const doc = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!doc) return reply.code(404).send({ success: false, message: 'Expense not found' });
    return { success: true };
  });
};
