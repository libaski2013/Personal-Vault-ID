const { User, Document, Academic, LifeEntry, VaultItem, Legacy, Expense, Reminder, Todo, ShareCard, Feature } = require('../db/models');

/* ── Default feature catalogue ── */
const DEFAULT_FEATURES = [
  { name:'dashboard',  label:'Dashboard',       icon:'🏠', href:'/trustid/dashboard.html',   tiers:['free','paid','premium'], enabled:true },
  { name:'identity',   label:'My Identity',     icon:'🛡️', href:'/trustid/certificate.html', tiers:['free','paid','premium'], enabled:true },
  { name:'documents',  label:'Documents',       icon:'📁', href:'/trustid/documents.html',   tiers:['free','paid','premium'], enabled:true },
  { name:'academics',  label:'Academics',       icon:'🎓', href:'/trustid/academics.html',   tiers:['free','paid','premium'], enabled:true },
  { name:'lifestory',  label:'Life Story',      icon:'📖', href:'/trustid/lifestory.html',   tiers:['free','paid','premium'], enabled:true },
  { name:'expenses',   label:'Expenses',        icon:'💰', href:'/trustid/expenses.html',    tiers:['free','paid','premium'], enabled:true },
  { name:'reminders',  label:'Reminders',       icon:'🔔', href:'/trustid/reminders.html',   tiers:['free','paid','premium'], enabled:true },
  { name:'todo',       label:'To-Do',           icon:'✅', href:'/trustid/todo.html',        tiers:['free','paid','premium'], enabled:true },
  { name:'calendar',   label:'Calendar',        icon:'📅', href:'/trustid/calendar.html',    tiers:['free','paid','premium'], enabled:true },
  { name:'address',    label:'My Address',      icon:'📍', href:'/trustid/address.html',     tiers:['free','paid','premium'], enabled:true },
  { name:'chat',       label:'Messages',        icon:'💬', href:'/trustid/chat.html',        tiers:['free','paid','premium'], enabled:true },
  { name:'share',      label:'Share My Vault',  icon:'📤', href:'/trustid/share.html',       tiers:['free','paid','premium'], enabled:true },
  { name:'vault',      label:'Secret Vault',    icon:'🔐', href:'/trustid/vault.html',       tiers:['paid','premium'],        enabled:true },
  { name:'album',      label:'Secret Album',    icon:'🖼️', href:'/trustid/album.html',       tiers:['paid','premium'],        enabled:true },
  { name:'legacy',     label:'Digital Legacy',  icon:'⏳', href:'/trustid/legacy.html',      tiers:['paid','premium'],        enabled:true },
];

module.exports = async function adminRoutes(fastify) {

  /* ══════════════════════════════════
     USERS
  ══════════════════════════════════ */

  /* GET /api/trustid/admin/users — list all users */
  fastify.get('/users', { onRequest:[fastify.requireAdmin] }, async () => {
    const users    = await User.find().select('-passwordHash -vaultPinHash').sort({ joinedAt:-1 });
    const docCounts = await Document.aggregate([{ $group:{ _id:'$userId', count:{ $sum:1 } } }]);
    const countMap  = Object.fromEntries(docCounts.map(d => [d._id.toString(), d.count]));
    return { success:true, data:users.map(u => ({ ...u.toObject(), docsCount:countMap[u._id.toString()]||0 })) };
  });

  /* GET /api/trustid/admin/users/:id — full profile */
  fastify.get('/users/:id', { onRequest:[fastify.requireAdmin] }, async (req, reply) => {
    const user = await User.findById(req.params.id).select('-passwordHash -vaultPinHash');
    if (!user) return reply.code(404).send({ success:false, message:'User not found' });

    const [docs, expenses, reminders, todos, academics, lifeEntries, vaultItems, shareCards] = await Promise.all([
      Document.countDocuments({ userId:user._id }),
      Expense.countDocuments({ userId:user._id }),
      Reminder.countDocuments({ userId:user._id }),
      Todo.countDocuments({ userId:user._id }),
      Academic.countDocuments({ userId:user._id }),
      LifeEntry.countDocuments({ userId:user._id }),
      VaultItem.countDocuments({ userId:user._id }),
      ShareCard.countDocuments({ userId:user._id }),
    ]);

    return { success:true, data:{ ...user.toObject(), counts:{ docs, expenses, reminders, todos, academics, lifeEntries, vaultItems, shareCards } } };
  });

  /* PUT /api/trustid/admin/users/:id/status — suspend or activate */
  fastify.put('/users/:id/status', { onRequest:[fastify.requireAdmin] }, async (req, reply) => {
    const { status, reason } = req.body || {};
    if (!['active','suspended'].includes(status))
      return reply.code(400).send({ success:false, message:'status must be active or suspended' });
    const user = await User.findById(req.params.id);
    if (!user) return reply.code(404).send({ success:false, message:'User not found' });
    if (user.role === 'admin') return reply.code(403).send({ success:false, message:'Cannot change status of another admin' });
    user.status = status;
    if (reason) user.notes = `[${new Date().toISOString().slice(0,10)}] ${status}: ${reason}\n` + (user.notes||'');
    await user.save();
    return { success:true, data:user.safeUser(), message:`User ${status}` };
  });

  /* PUT /api/trustid/admin/users/:id/tier — set free/paid/premium */
  fastify.put('/users/:id/tier', { onRequest:[fastify.requireAdmin] }, async (req, reply) => {
    const { tier } = req.body || {};
    if (!['free','paid','premium'].includes(tier))
      return reply.code(400).send({ success:false, message:'tier must be free, paid, or premium' });
    const user = await User.findByIdAndUpdate(req.params.id, { tier }, { new:true }).select('-passwordHash -vaultPinHash');
    if (!user) return reply.code(404).send({ success:false, message:'User not found' });
    return { success:true, data:user.safeUser(), message:`Tier changed to ${tier}` };
  });

  /* PUT /api/trustid/admin/users/:id/notes — add admin note */
  fastify.put('/users/:id/notes', { onRequest:[fastify.requireAdmin] }, async (req, reply) => {
    const { notes } = req.body || {};
    const user = await User.findByIdAndUpdate(req.params.id, { notes }, { new:true }).select('-passwordHash -vaultPinHash');
    if (!user) return reply.code(404).send({ success:false, message:'User not found' });
    return { success:true, message:'Notes saved' };
  });

  /* DELETE /api/trustid/admin/users/:id — delete user + all their data */
  fastify.delete('/users/:id', { onRequest:[fastify.requireAdmin] }, async (req, reply) => {
    const user = await User.findById(req.params.id);
    if (!user) return reply.code(404).send({ success:false, message:'User not found' });
    if (user.role === 'admin') return reply.code(403).send({ success:false, message:'Cannot delete an admin account' });
    const uid = user._id;
    await Promise.all([
      User.findByIdAndDelete(uid),
      Document.deleteMany({ userId:uid }),
      Expense.deleteMany({ userId:uid }),
      Reminder.deleteMany({ userId:uid }),
      Todo.deleteMany({ userId:uid }),
      Academic.deleteMany({ userId:uid }),
      LifeEntry.deleteMany({ userId:uid }),
      VaultItem.deleteMany({ userId:uid }),
      Legacy.deleteMany({ userId:uid }),
      ShareCard.deleteMany({ userId:uid }),
    ]);
    return { success:true, message:`User ${user.email} and all their data deleted` };
  });

  /* ══════════════════════════════════
     STATS
  ══════════════════════════════════ */
  fastify.get('/stats', { onRequest:[fastify.requireAdmin] }, async () => {
    const [totalUsers, activeTrustIds, verifiedDocs, pendingReviews, freeUsers, paidUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ 'trustId.status':'active' }),
      Document.countDocuments({ status:'verified' }),
      Document.countDocuments({ status:'pending' }),
      User.countDocuments({ tier:'free' }),
      User.countDocuments({ tier:{ $in:['paid','premium'] } }),
    ]);
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const growth = await Promise.all(Array.from({ length:6 }, (_,i) => {
      const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
      const next = new Date(d.getFullYear(), d.getMonth()+1, 1);
      return Promise.all([
        User.countDocuments({ joinedAt:{ $gte:d, $lt:next } }),
        Document.countDocuments({ createdAt:{ $gte:d, $lt:next } }),
      ]).then(([users, docs]) => ({ m:months[d.getMonth()], users, docs }));
    }));
    const byLevel = await Promise.all(
      [['L1 Basic',1],['L2 Standard',2],['L3 Enhanced',3],['L4 High',4],['L5 Sovereign',5]].map(
        ([l, level]) => User.countDocuments({ 'trustId.level':level }).then(v => ({ l, v }))
      )
    );
    const docStatusCounts = await Document.aggregate([{ $group:{ _id:'$status', value:{ $sum:1 } } }]);
    const statusColors = { verified:'#22C55E', pending:'#F97316', rejected:'#EF4444' };
    const docStatus = docStatusCounts.map(d => ({ name:d._id, value:d.value, color:statusColors[d._id]||'#94A3B8' }));
    return { success:true, data:{ totalUsers, activeTrustIds, verifiedDocs, pendingReviews, freeUsers, paidUsers, growth, byLevel, docStatus } };
  });

  /* ══════════════════════════════════
     DATA / CLEAR
  ══════════════════════════════════ */
  fastify.get('/data-counts', { onRequest:[fastify.requireAdmin] }, async () => {
    const adminIds = (await User.find({ role:'admin' }).select('_id')).map(u => u._id);
    const [testUsers, docs, expenses, reminders, todos, academics, lifeEntries, vaultItems, legacyRecords, shareCards] = await Promise.all([
      User.countDocuments({ role:{ $ne:'admin' } }),
      Document.countDocuments({ userId:{ $nin:adminIds } }),
      Expense.countDocuments({ userId:{ $nin:adminIds } }),
      Reminder.countDocuments({ userId:{ $nin:adminIds } }),
      Todo.countDocuments({ userId:{ $nin:adminIds } }),
      Academic.countDocuments({ userId:{ $nin:adminIds } }),
      LifeEntry.countDocuments({ userId:{ $nin:adminIds } }),
      VaultItem.countDocuments({ userId:{ $nin:adminIds } }),
      Legacy.countDocuments({ userId:{ $nin:adminIds } }),
      ShareCard.countDocuments({ userId:{ $nin:adminIds } }),
    ]);
    return { success:true, data:{ testUsers, docs, expenses, reminders, todos, academics, lifeEntries, vaultItems, legacyRecords, shareCards, total:testUsers+docs+expenses+reminders+todos+academics+lifeEntries+vaultItems+legacyRecords+shareCards } };
  });

  fastify.delete('/clear-test-data', { onRequest:[fastify.requireAdmin] }, async (req, reply) => {
    const { confirm } = req.body || {};
    if (confirm !== 'CLEAR ALL TEST DATA') return reply.code(400).send({ success:false, message:'Send confirm: "CLEAR ALL TEST DATA"' });
    const adminIds = (await User.find({ role:'admin' }).select('_id')).map(u => u._id);
    const results = await Promise.all([
      User.deleteMany({ role:{ $ne:'admin' } }),
      Document.deleteMany({ userId:{ $nin:adminIds } }),
      Expense.deleteMany({ userId:{ $nin:adminIds } }),
      Reminder.deleteMany({ userId:{ $nin:adminIds } }),
      Todo.deleteMany({ userId:{ $nin:adminIds } }),
      Academic.deleteMany({ userId:{ $nin:adminIds } }),
      LifeEntry.deleteMany({ userId:{ $nin:adminIds } }),
      VaultItem.deleteMany({ userId:{ $nin:adminIds } }),
      Legacy.deleteMany({ userId:{ $nin:adminIds } }),
      ShareCard.deleteMany({ userId:{ $nin:adminIds } }),
    ]);
    return { success:true, message:'All test data cleared. Admin accounts preserved.', deleted:{ users:results[0].deletedCount, docs:results[1].deletedCount } };
  });

  /* ══════════════════════════════════
     FEATURE FLAGS
  ══════════════════════════════════ */

  /* POST /api/trustid/admin/features/init — seed defaults */
  fastify.post('/features/init', { onRequest:[fastify.requireAdmin] }, async () => {
    for (const f of DEFAULT_FEATURES) {
      await Feature.findOneAndUpdate({ name:f.name }, { $setOnInsert:f }, { upsert:true, new:true });
    }
    return { success:true, message:`${DEFAULT_FEATURES.length} features initialised` };
  });

  /* GET /api/trustid/admin/features */
  fastify.get('/features', { onRequest:[fastify.requireAdmin] }, async () => {
    let features = await Feature.find().sort({ name:1 });
    if (!features.length) {
      /* Auto-seed on first access */
      for (const f of DEFAULT_FEATURES) {
        await Feature.findOneAndUpdate({ name:f.name }, { $setOnInsert:f }, { upsert:true, new:true });
      }
      features = await Feature.find().sort({ name:1 });
    }
    return { success:true, data:features };
  });

  /* GET /api/trustid/features — PUBLIC endpoint for client-side gating */
  fastify.get('/features-public', async () => {
    const features = await Feature.find().select('name enabled tiers icon label href');
    return { success:true, data:features };
  });

  /* PUT /api/trustid/admin/features/:name — update a feature flag */
  fastify.put('/features/:name', { onRequest:[fastify.requireAdmin] }, async (req, reply) => {
    const { enabled, tiers } = req.body || {};
    const feature = await Feature.findOneAndUpdate(
      { name:req.params.name },
      { $set:{ ...(enabled !== undefined ? { enabled } : {}), ...(tiers ? { tiers } : {}) } },
      { new:true }
    );
    if (!feature) return reply.code(404).send({ success:false, message:'Feature not found' });
    return { success:true, data:feature };
  });
};
