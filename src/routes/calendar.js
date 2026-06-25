const { CalendarEvent } = require('../db/models');

module.exports = async function calendarRoutes(fastify) {
  fastify.get('/events', { onRequest:[fastify.authenticate] }, async (req) => {
    const data = await CalendarEvent.find({ userId:req.user.userId }).sort({ date:1 });
    return { success:true, data };
  });

  fastify.post('/events', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const { title, date, tag, color, notes } = req.body || {};
    if (!title || !date) return reply.code(400).send({ success:false, message:'Title and date required' });
    const data = await CalendarEvent.create({
      userId:req.user.userId,
      title,
      date,
      tag:tag || 'event',
      color:color || '#7C3AED',
      notes:notes || '',
    });
    return reply.code(201).send({ success:true, data });
  });

  fastify.delete('/events/:id', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const doc = await CalendarEvent.findOneAndDelete({ _id:req.params.id, userId:req.user.userId });
    if (!doc) return reply.code(404).send({ success:false, message:'Event not found' });
    return { success:true };
  });
};
