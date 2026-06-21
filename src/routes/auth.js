const bcrypt = require('bcryptjs');
const { User } = require('../db/models');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

module.exports = async function authRoutes(fastify) {
  /* POST /api/trustid/auth/login */
  fastify.post('/login', async (req, reply) => {
    const { email, password } = req.body || {};
    if (!email || !password)
      return reply.code(400).send({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.checkPassword(password)))
      return reply.code(401).send({ success: false, message: 'Invalid email or password' });

    if (user.status === 'suspended')
      return reply.code(403).send({ success: false, message: 'Account suspended' });

    const token = fastify.jwt.sign({ userId: user._id, role: user.role }, { expiresIn: JWT_EXPIRES_IN });
    return { success: true, token, user: user.safeUser() };
  });

  /* POST /api/trustid/auth/register */
  fastify.post('/register', async (req, reply) => {
    const { firstName, lastName, email, password } = req.body || {};
    if (!firstName || !email || !password)
      return reply.code(400).send({ success: false, message: 'firstName, email, and password required' });

    if (await User.findOne({ email }))
      return reply.code(409).send({ success: false, message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const tid = `TID-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,6).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const user = await User.create({
      firstName, lastName: lastName || '', email, passwordHash,
      trustId: { id: tid, level: 1, score: 100, status: 'active', issuedAt: new Date() },
    });

    const token = fastify.jwt.sign({ userId: user._id, role: user.role }, { expiresIn: JWT_EXPIRES_IN });
    return reply.code(201).send({ success: true, token, user: user.safeUser() });
  });

  /* POST /api/trustid/auth/seed-admin */
  fastify.post('/seed-admin', async (req, reply) => {
    if (await User.findOne({ email: 'admin@trustid.com' }))
      return reply.code(409).send({ success: false, message: 'Admin already exists' });

    const passwordHash = await bcrypt.hash('admin123', 12);
    await User.create({
      firstName: 'Admin', lastName: 'User', email: 'admin@trustid.com',
      passwordHash, role: 'admin', status: 'active',
      trustId: { id: 'TID-ADMIN-0001', level: 5, score: 950, status: 'active' },
    });
    return { success: true, message: 'Admin created. Email: admin@trustid.com | Password: admin123 — change immediately.' };
  });

  /* PUT /api/trustid/auth/change-password */
  fastify.put('/change-password', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword)
      return reply.code(400).send({ success: false, message: 'Current and new password required' });

    const user = await User.findById(req.user.userId);
    if (!user || !(await user.checkPassword(currentPassword)))
      return reply.code(401).send({ success: false, message: 'Current password incorrect' });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    return { success: true, message: 'Password updated successfully' };
  });
};
