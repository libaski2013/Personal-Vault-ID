const { User, Document } = require('../db/models');

module.exports = async function adminRoutes(fastify) {
  /* GET /api/trustid/admin/users */
  fastify.get('/users', { onRequest: [fastify.requireAdmin] }, async () => {
    const users = await User.find().select('-passwordHash').sort({ joinedAt: -1 });
    const docCounts = await Document.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(docCounts.map(d => [d._id.toString(), d.count]));
    return {
      success: true,
      data: users.map(u => ({ ...u.toObject(), docsCount: countMap[u._id.toString()] || 0 })),
    };
  });

  /* GET /api/trustid/admin/stats */
  fastify.get('/stats', { onRequest: [fastify.requireAdmin] }, async () => {
    const [totalUsers, activeTrustIds, verifiedDocs, pendingReviews] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ 'trustId.status': 'active' }),
      Document.countDocuments({ status: 'verified' }),
      Document.countDocuments({ status: 'pending' }),
    ]);

    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const growth = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        return Promise.all([
          User.countDocuments({ joinedAt: { $gte: d, $lt: next } }),
          Document.countDocuments({ createdAt: { $gte: d, $lt: next } }),
        ]).then(([users, docs]) => ({ m: months[d.getMonth()], users, docs }));
      })
    );

    const byLevel = await Promise.all(
      [['L1 Basic',1],['L2 Standard',2],['L3 Enhanced',3],['L4 High',4],['L5 Sovereign',5]].map(
        ([l, level]) => User.countDocuments({ 'trustId.level': level }).then(v => ({ l, v }))
      )
    );

    const docStatusCounts = await Document.aggregate([
      { $group: { _id: '$status', value: { $sum: 1 } } },
    ]);
    const statusColors = { verified: '#22C55E', pending: '#F97316', rejected: '#EF4444' };
    const docStatus = docStatusCounts.map(d => ({ name: d._id, value: d.value, color: statusColors[d._id] || '#94A3B8' }));

    return { success: true, data: { totalUsers, activeTrustIds, verifiedDocs, pendingReviews, growth, byLevel, docStatus } };
  });
};
