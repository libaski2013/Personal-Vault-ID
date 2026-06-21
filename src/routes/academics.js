const { Academic } = require('../db/models');

module.exports = async function (fastify) {
  fastify.get('/', { onRequest:[fastify.authenticate] }, async (req) => {
    const data = await Academic.find({ userId:req.user.userId }).sort({ year:-1, createdAt:-1 });
    return { success:true, data };
  });

  fastify.post('/', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const { title, type, institution, year, grade, description, isPublic } = req.body||{};
    if (!title) return reply.code(400).send({ success:false, message:'Title required' });
    const data = await Academic.create({ userId:req.user.userId, title, type:type||'certificate', institution, year, grade, description, isPublic:!!isPublic });
    return reply.code(201).send({ success:true, data });
  });

  fastify.put('/:id', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const data = await Academic.findOneAndUpdate({ _id:req.params.id, userId:req.user.userId }, req.body, { new:true });
    if (!data) return reply.code(404).send({ success:false, message:'Not found' });
    return { success:true, data };
  });

  fastify.delete('/:id', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const r = await Academic.findOneAndDelete({ _id:req.params.id, userId:req.user.userId });
    if (!r) return reply.code(404).send({ success:false, message:'Not found' });
    return { success:true };
  });
};
