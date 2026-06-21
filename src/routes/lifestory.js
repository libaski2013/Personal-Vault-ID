const { LifeEntry } = require('../db/models');

module.exports = async function (fastify) {
  fastify.get('/', { onRequest:[fastify.authenticate] }, async (req) => {
    const data = await LifeEntry.find({ userId:req.user.userId }).sort({ date:-1 });
    return { success:true, data };
  });

  fastify.post('/', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const { title, category, content, date, isPublic, tags } = req.body||{};
    if (!title) return reply.code(400).send({ success:false, message:'Title required' });
    const data = await LifeEntry.create({ userId:req.user.userId, title, category:category||'milestone', content, date:date||new Date(), isPublic:!!isPublic, tags:tags||[] });
    return reply.code(201).send({ success:true, data });
  });

  fastify.put('/:id', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const data = await LifeEntry.findOneAndUpdate({ _id:req.params.id, userId:req.user.userId }, req.body, { new:true });
    if (!data) return reply.code(404).send({ success:false, message:'Not found' });
    return { success:true, data };
  });

  fastify.delete('/:id', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const r = await LifeEntry.findOneAndDelete({ _id:req.params.id, userId:req.user.userId });
    if (!r) return reply.code(404).send({ success:false, message:'Not found' });
    return { success:true };
  });

  /* Public profile — entries marked isPublic:true */
  fastify.get('/public/:userId', async (req, reply) => {
    const data = await LifeEntry.find({ userId:req.params.userId, isPublic:true }).sort({ date:-1 });
    return { success:true, data };
  });
};
