const bcrypt  = require('bcryptjs');
const { User } = require('../db/models');
const otp     = require('../services/otp');
const email   = require('../services/email');
const resetOtp = require('../services/resetOtp');
const sms     = require('../services/sms');

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
    const { firstName, middleName, lastName, email: addr, phone, password } = req.body || {};

    if (!firstName || !addr || !password)
      return reply.code(400).send({ success:false, message:'First name, email and password are required' });
    if (password.length < 8)
      return reply.code(400).send({ success:false, message:'Password must be at least 8 characters' });
    if (await User.findOne({ email: addr }))
      return reply.code(409).send({ success:false, message:'An account with this email already exists' });

    const code = otp.generate(addr, { firstName, middleName:middleName||'', lastName:lastName||'', email:addr, phone:phone||'', password });
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
      email:addr, phone:data.phone||'', passwordHash,
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

  /* PUT /api/trustid/auth/phone */
  fastify.put('/phone', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const phone = String((req.body || {}).phone || '').trim();
    if (!phone)
      return reply.code(400).send({ success:false, message:'Phone number required' });
    const user = await User.findById(req.user.userId);
    if (!user)
      return reply.code(404).send({ success:false, message:'User not found' });
    user.phone = phone;
    await user.save();
    return { success:true, message:'Phone number saved', user:user.safeUser() };
  });

  /* POST /api/trustid/auth/request-password-reset */
  fastify.post('/request-password-reset', async (req, reply) => {
    const { channel, email: addr, phone } = req.body || {};
    const mode = channel === 'phone' ? 'phone' : 'email';
    const target = mode === 'phone' ? String(phone || '').trim() : String(addr || '').trim().toLowerCase();

    if (!target)
      return reply.code(400).send({ success:false, message: mode === 'phone' ? 'Phone number required' : 'Email required' });

    const user = mode === 'phone'
      ? await User.findOne({ phone: target })
      : await User.findOne({ email: target });

    if (user && user.status !== 'suspended') {
      const code = resetOtp.generate(mode, target, { userId:user._id });
      if (mode === 'phone') {
        await sms.sendResetCode(target, code);
      } else {
        await email.sendPasswordResetOTP(user.email, user.firstName, code);
      }
    }

    return {
      success:true,
      message: mode === 'phone'
        ? 'If that phone number is linked to an account, a reset code has been sent.'
        : 'If that email is linked to an account, a reset code has been sent.',
    };
  });

  /* POST /api/trustid/auth/reset-password */
  fastify.post('/reset-password', async (req, reply) => {
    const { channel, email: addr, phone, code, newPassword } = req.body || {};
    const mode = channel === 'phone' ? 'phone' : 'email';
    const target = mode === 'phone' ? String(phone || '').trim() : String(addr || '').trim().toLowerCase();

    if (!target || !code || !newPassword)
      return reply.code(400).send({ success:false, message:'Reset target, code and new password are required' });
    if (newPassword.length < 8)
      return reply.code(400).send({ success:false, message:'Password must be at least 8 characters' });

    const data = resetOtp.verify(mode, target, code);
    if (!data)
      return reply.code(400).send({ success:false, message:'Invalid or expired reset code' });

    const user = await User.findById(data.userId);
    if (!user || user.status === 'suspended')
      return reply.code(400).send({ success:false, message:'Unable to reset this account' });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    return { success:true, message:'Password reset successfully. You can now sign in.' };
  });
};
