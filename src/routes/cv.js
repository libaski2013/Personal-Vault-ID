const { User, Academic, LifeEntry, Document } = require('../db/models');

module.exports = async function cvRoutes(fastify) {

  /* GET /api/trustid/cv — fetch all data needed for CV builder */
  fastify.get('/', { onRequest:[fastify.authenticate] }, async (req) => {
    const uid = req.user.userId;
    const [user, academics, lifeEntries, docs] = await Promise.all([
      User.findById(uid).select('-passwordHash -vaultPinHash'),
      Academic.find({ userId:uid }).sort({ year:-1 }),
      LifeEntry.find({ userId:uid }).sort({ date:-1 }),
      Document.find({ userId:uid, status:'verified' }).select('name type category'),
    ]);
    return { success:true, data:{ user:user.safeUser(), academics, lifeEntries, docs } };
  });

  /* PUT /api/trustid/cv — save CV extra data (skills, objective, etc.) to user bio field */
  fastify.put('/', { onRequest:[fastify.authenticate] }, async (req) => {
    const { bio } = req.body||{};
    await User.findByIdAndUpdate(req.user.userId, { bio:bio||'' });
    return { success:true };
  });
};
