const { User, Document, Academic, LifeEntry, VaultItem, Legacy, Expense, Reminder, Todo, ShareCard } = require('../db/models');

module.exports = async function adminRoutes(fastify) {

  /* GET /api/trustid/admin/users */
  fastify.get('/users', { onRequest:[fastify.requireAdmin] }, async () => {
    const users = await User.find().select('-passwordHash -vaultPinHash').sort({ joinedAt:-1 });
    const docCounts = await Document.aggregate([{ $group:{ _id:'$userId', count:{ $sum:1 } } }]);
    const countMap = Object.fromEntries(docCounts.map(d => [d._id.toString(), d.count]));
    return { success:true, data:users.map(u => ({ ...u.toObject(), docsCount:countMap[u._id.toString()]||0 })) };
  });

  /* GET /api/trustid/admin/stats */
  fastify.get('/stats', { onRequest:[fastify.requireAdmin] }, async () => {
    const [totalUsers, activeTrustIds, verifiedDocs, pendingReviews] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ 'trustId.status':'active' }),
      Document.countDocuments({ status:'verified' }),
      Document.countDocuments({ status:'pending' }),
    ]);

    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const growth = await Promise.all(Array.from({ length:6 }, (_, i) => {
      const d    = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
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

    return { success:true, data:{ totalUsers, activeTrustIds, verifiedDocs, pendingReviews, growth, byLevel, docStatus } };
  });

  /* GET /api/trustid/admin/data-counts — preview before clearing */
  fastify.get('/data-counts', { onRequest:[fastify.requireAdmin] }, async (req) => {
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

    return {
      success: true,
      data: { testUsers, docs, expenses, reminders, todos, academics, lifeEntries, vaultItems, legacyRecords, shareCards,
        total: testUsers + docs + expenses + reminders + todos + academics + lifeEntries + vaultItems + legacyRecords + shareCards }
    };
  });

  /* DELETE /api/trustid/admin/clear-test-data — wipe everything except admin accounts */
  fastify.delete('/clear-test-data', { onRequest:[fastify.requireAdmin] }, async (req, reply) => {
    const { confirm } = req.body || {};
    if (confirm !== 'CLEAR ALL TEST DATA')
      return reply.code(400).send({ success:false, message:'Send confirm: "CLEAR ALL TEST DATA" to proceed' });

    const adminIds = (await User.find({ role:'admin' }).select('_id')).map(u => u._id);
    const testUserIds = (await User.find({ role:{ $ne:'admin' } }).select('_id')).map(u => u._id);

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

    const totals = results.map(r => r.deletedCount || 0);
    console.log(`[ADMIN] Test data cleared by ${req.user.userId}. Deleted:`, totals);

    return {
      success: true,
      message: 'All test data cleared. Admin accounts and their data are preserved.',
      deleted: {
        users: totals[0], documents: totals[1], expenses: totals[2],
        reminders: totals[3], todos: totals[4], academics: totals[5],
        lifeEntries: totals[6], vaultItems: totals[7], legacyRecords: totals[8], shareCards: totals[9],
      }
    };
  });
};
