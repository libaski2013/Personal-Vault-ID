const bcrypt    = require('bcryptjs');
const { User, VaultItem } = require('../db/models');

module.exports = async function (fastify) {
  /* POST /api/pv/vault/setup-pin — first-time PIN setup */
  fastify.post('/setup-pin', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const { pin } = req.body||{};
    if (!pin || String(pin).length < 4) return reply.code(400).send({ success:false, message:'PIN must be at least 4 digits' });
    const user = await User.findById(req.user.userId);
    if (user.vaultPinHash) return reply.code(409).send({ success:false, message:'PIN already set. Use change-pin to update.' });
    user.vaultPinHash = await bcrypt.hash(String(pin), 10);
    await user.save();
    return { success:true, message:'Vault PIN set successfully' };
  });

  /* POST /api/pv/vault/change-pin */
  fastify.post('/change-pin', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const { currentPin, newPin } = req.body||{};
    if (!currentPin || !newPin) return reply.code(400).send({ success:false, message:'Current and new PIN required' });
    const user = await User.findById(req.user.userId);
    if (!user.vaultPinHash || !(await user.checkVaultPin(String(currentPin))))
      return reply.code(401).send({ success:false, message:'Current PIN incorrect' });
    user.vaultPinHash = await bcrypt.hash(String(newPin), 10);
    await user.save();
    return { success:true, message:'Vault PIN changed' };
  });

  /* POST /api/pv/vault/verify-pin */
  fastify.post('/verify-pin', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const { pin } = req.body||{};
    const user = await User.findById(req.user.userId);
    if (!user.vaultPinHash) return { success:true, firstTime:true };
    const ok = await user.checkVaultPin(String(pin));
    if (!ok) return reply.code(401).send({ success:false, message:'Incorrect PIN' });
    return { success:true, firstTime:false };
  });

  /* GET /api/pv/vault/items */
  fastify.get('/items', { onRequest:[fastify.authenticate] }, async (req) => {
    const data = await VaultItem.find({ userId:req.user.userId }).sort({ createdAt:-1 });
    return { success:true, data };
  });

  /* POST /api/pv/vault/items */
  fastify.post('/items', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const { title, type, content, tags } = req.body||{};
    if (!title) return reply.code(400).send({ success:false, message:'Title required' });
    const data = await VaultItem.create({ userId:req.user.userId, title, type:type||'note', content:content||'', tags:tags||[] });
    return reply.code(201).send({ success:true, data });
  });

  /* DELETE /api/pv/vault/items/:id */
  fastify.delete('/items/:id', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const r = await VaultItem.findOneAndDelete({ _id:req.params.id, userId:req.user.userId });
    if (!r) return reply.code(404).send({ success:false, message:'Not found' });
    return { success:true };
  });

  /* GET /api/pv/vault/address */
  fastify.get('/address', { onRequest:[fastify.authenticate] }, async (req) => {
    const user = await User.findById(req.user.userId).select('homeAddress');
    return { success:true, data:user.homeAddress||{} };
  });

  /* PUT /api/pv/vault/address */
  fastify.put('/address', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const { street, city, state, country, postalCode, lat, lng } = req.body||{};
    await User.findByIdAndUpdate(req.user.userId, { homeAddress:{ street, city, state, country, postalCode, lat, lng } });
    return { success:true, message:'Address saved' };
  });
};
