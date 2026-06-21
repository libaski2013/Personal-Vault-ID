const bcrypt  = require('bcryptjs');
const { User } = require('../db/models');
const otp     = require('../services/otp');
const email   = require('../services/email');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

module.exports = async function authRoutes(fastify) {

  /* POST /api/trustid/auth/login */
  fastify.post('/login', async (req, reply) => {
    const { email: addr, password } = req.body || {};
    if (!addr || !password)
      return reply.code(400).send({ success:false, message:'Email and password required' });

    const user = await User.findOne({ email: addr });
    if (!user || !(await user.checkPassword(password)))
      return reply.code(401).send({ success:false, message:'Invalid email or password' });

    if (user.status === 'suspended')
      return reply.code(403).send({ success:false, message:'Account suspended. Contact support.' });

    const token = fastify.jwt.sign({ userId:user._id, role:user.role }, { expiresIn:JWT_EXPIRES_IN });
    return { success:true, token, user:user.safeUser() };
  });

  /* POST /api/trustid/auth/request-otp — step 1 of registration */
  fastify.post('/request-otp', async (req, reply) => {
    const { firstName, middleName, lastName, email: addr, password } = req.body || {};

    if (!firstName || !addr || !password)
      return reply.code(400).send({ success:false, message:'First name, email and password are required' });
    if (password.length < 8)
      return reply.code(400).send({ success:false, message:'Password must be at least 8 characters' });
    if (await User.findOne({ email: addr }))
      return reply.code(409).send({ success:false, message:'An account with this email already exists' });

    const code = otp.generate(addr, { firstName, middleName:middleName||'', lastName:lastName||'', email:addr, password });
    await email.sendOTP(addr, firstName, code);

    return { success:true, message:'Verification code sent to '+addr };
  });

  /* POST /api/trustid/auth/verify-otp — step 2: verify and create account */
  fastify.post('/verify-otp', async (req, reply) => {
    const { email: addr, code } = req.body || {};
    if (!addr || !code)
      return reply.code(400).send({ success:false, message:'Email and code required' });

    const data = otp.verify(addr, code);
    if (!data)
      return reply.code(400).send({ success:false, message:'Invalid or expired verification code' });

    if (await User.findOne({ email: addr }))
      return reply.code(409).send({ success:false, message:'Account already exists' });

    const passwordHash = await bcrypt.hash(data.password, 12);
    const tid = 'TID-'+new Date().getFullYear()+'-'+Math.random().toString(36).slice(2,6).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
    const user = await User.create({
      firstName:data.firstName, middleName:data.middleName||'', lastName:data.lastName||'',
      email:addr, passwordHash,
      trustId:{ id:tid, level:1, score:100, status:'active', issuedAt:new Date() },
    });

    const token = fastify.jwt.sign({ userId:user._id, role:user.role }, { expiresIn:JWT_EXPIRES_IN });
    return reply.code(201).send({ success:true, token, user:user.safeUser() });
  });

  /* POST /api/trustid/auth/seed-admin */
  fastify.post('/seed-admin', async (req, reply) => {
    if (await User.findOne({ email:'admin@trustid.com' }))
      return reply.code(409).send({ success:false, message:'Admin already exists' });
    const passwordHash = await bcrypt.hash('admin123', 12);
    await User.create({
      firstName:'Admin', lastName:'User', email:'admin@trustid.com',
      passwordHash, role:'admin', status:'active',
      trustId:{ id:'TID-ADMIN-0001', level:5, score:950, status:'active' },
    });
    return { success:true, message:'Admin created — admin@trustid.com / admin123 — change password immediately.' };
  });

  /* PUT /api/trustid/auth/change-password */
  fastify.put('/change-password', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword)
      return reply.code(400).send({ success:false, message:'Both passwords required' });
    const user = await User.findById(req.user.userId);
    if (!user || !(await user.checkPassword(currentPassword)))
      return reply.code(401).send({ success:false, message:'Current password is incorrect' });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    return { success:true, message:'Password updated successfully' };
  });
};
