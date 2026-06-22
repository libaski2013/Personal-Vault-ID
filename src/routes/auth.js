const bcrypt  = require('bcryptjs');
const { User } = require('../db/models');
const otp     = require('../services/otp');
const email   = require('../services/email');
const resetOtp = require('../services/resetOtp');
const sms     = require('../services/sms');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/* ── Helpers ── */
function cleanEmail(e) { return (e||'').toLowerCase().trim(); }
function cleanPhone(p) { return (p||'').replace(/[\s\-().]/g,'').trim(); }

function isValidPhone(p) {
  const c = cleanPhone(p);
  /* International format: starts with + then 7–15 digits */
  return /^\+[1-9]\d{6,14}$/.test(c);
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail(e));
}

/* Check for any existing field that would cause a duplicate */
async function checkDuplicates(email, phone) {
  const normEmail = cleanEmail(email);
  if (!normEmail) return { field:'email', message:'Email address is required' };

  const byEmail = await User.findOne({ email: normEmail });
  if (byEmail) return { field:'email', message:'An account with this email address already exists. Please sign in instead.' };

  if (phone && cleanPhone(phone).length >= 7) {
    const byPhone = await User.findOne({ phone: cleanPhone(phone) });
    if (byPhone) return { field:'phone', message:'This phone number is already linked to another account.' };
  }
  return null;
}

/* Generate a unique TrustID with retry */
async function genTrustId() {
  let id, tries = 0;
  do {
    id = 'TID-'+new Date().getFullYear()+'-'+Math.random().toString(36).slice(2,6).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
    tries++;
  } while (tries < 5 && await User.findOne({ 'trustId.id': id }));
  return id;
}

/* Friendly message for MongoDB duplicate-key errors (race condition safety net) */
function friendlyDupError(err) {
  if (err.code === 11000 || err.code === 11001) {
    const key = Object.keys(err.keyPattern || {})[0] || '';
    if (key.includes('email')) return 'This email is already registered. Please sign in.';
    if (key.includes('phone')) return 'This phone number is already in use.';
    return 'This account already exists. Please sign in.';
  }
  return null;
}

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
    const { firstName, middleName, lastName, email: rawEmail, phone: rawPhone, password } = req.body || {};
    const addr  = cleanEmail(rawEmail);
    const phone = cleanPhone(rawPhone || '');

    /* ── Input validation ── */
    if (!firstName || !firstName.trim())
      return reply.code(400).send({ success:false, field:'firstName', message:'First name is required' });
    if (!addr || !isValidEmail(addr))
      return reply.code(400).send({ success:false, field:'email', message:'Enter a valid email address (e.g. ali.baba@gmail.com)' });
    if (!password || password.length < 8)
      return reply.code(400).send({ success:false, field:'password', message:'Password must be at least 8 characters' });

    /* Phone is optional but if provided must be valid international format */
    if (phone && !isValidPhone(phone))
      return reply.code(400).send({ success:false, field:'phone', message:'Enter phone in international format: +233241234567' });

    /* Duplicate check */
    const dup = await checkDuplicates(addr, phone);
    if (dup) return reply.code(409).send({ success:false, ...dup });

    /* Generate OTP — ONE code sent to both channels */
    const code = otp.generate(addr, { firstName:firstName.trim(), middleName:middleName||'', lastName:lastName||'', email:addr, phone, password });

    /* ── Try all channels in parallel ── */
    const emailConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS) || !!(process.env.RESEND_API_KEY);
    const smsConfigured   = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_PHONE);

    let emailSent = false, smsSent = false, emailError = null, smsError = null;

    const tasks = [];

    if (emailConfigured) {
      tasks.push(
        email.sendOTP(addr, firstName, code)
          .then(()  => { emailSent = true; })
          .catch(e  => { emailError = e.message.slice(0, 100); console.error('[OTP-email]', e.message); })
      );
    }

    if (phone && smsConfigured) {
      tasks.push(
        sms.sendOTP(phone, firstName, code)
          .then(()  => { smsSent = true; })
          .catch(e  => { smsError = e.message.slice(0, 100); console.error('[OTP-sms]', e.message); })
      );
    }

    if (tasks.length) await Promise.allSettled(tasks);

    /* If nothing was delivered, return code on screen */
    const anyDelivered = emailSent || smsSent;
    if (!anyDelivered) {
      console.log(`[OTP-fallback] ${addr}/${phone} → ${code}`);
    }

    /* Build human-readable delivery summary */
    const channels = [];
    if (emailSent) channels.push('📧 '+addr);
    if (smsSent)   channels.push('📱 '+phone);

    return {
      success:       true,
      emailSent,
      smsSent,
      anyDelivered,
      devCode:       anyDelivered ? undefined : code,   /* only show on screen if both failed */
      channels,
      message: anyDelivered
        ? 'Verification code sent to: ' + channels.join(' & ')
        : (emailError || smsError)
          ? 'Delivery failed — use the code shown on screen.'
          : 'OTP not configured — use the code shown on screen.',
      _emailError: emailError,
      _smsError:   smsError,
    };
  });

  /* POST /api/trustid/auth/verify-otp — step 2: verify and create account */
  fastify.post('/verify-otp', async (req, reply) => {
    const { email: rawEmail, code } = req.body || {};
    const addr = cleanEmail(rawEmail);
    if (!addr || !code)
      return reply.code(400).send({ success:false, message:'Email and verification code required' });

    const data = otp.verify(addr, code);
    if (!data)
      return reply.code(400).send({ success:false, message:'Incorrect or expired verification code. Request a new one.' });

    /* Final duplicate check (race condition guard) */
    const dup = await checkDuplicates(addr, data.phone);
    if (dup) return reply.code(409).send({ success:false, ...dup });

    try {
      const passwordHash = await bcrypt.hash(data.password, 12);
      const tid  = await genTrustId();
      const user = await User.create({
        firstName: data.firstName.trim(),
        middleName:(data.middleName||'').trim(),
        lastName:  (data.lastName||'').trim(),
        email:     addr,
        phone:     cleanPhone(data.phone||''),
        passwordHash,
        trustId:{ id:tid, level:1, score:100, status:'active', issuedAt:new Date() },
      });
      const token = fastify.jwt.sign({ userId:user._id, role:user.role }, { expiresIn:JWT_EXPIRES_IN });
      return reply.code(201).send({ success:true, token, user:user.safeUser() });
    } catch (err) {
      const friendly = friendlyDupError(err);
      if (friendly) return reply.code(409).send({ success:false, message:friendly });
      throw err;
    }
  });

  /* POST /api/trustid/auth/register — direct registration (no OTP, fallback) */
  fastify.post('/register', async (req, reply) => {
    const { firstName, middleName, lastName, email: rawEmail, phone, password } = req.body || {};
    const addr = cleanEmail(rawEmail);

    if (!firstName || !firstName.trim())
      return reply.code(400).send({ success:false, field:'firstName', message:'First name is required' });
    if (!addr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr))
      return reply.code(400).send({ success:false, field:'email', message:'A valid email address is required' });
    if (!password || password.length < 8)
      return reply.code(400).send({ success:false, field:'password', message:'Password must be at least 8 characters' });

    const dup = await checkDuplicates(addr, phone);
    if (dup) return reply.code(409).send({ success:false, ...dup });

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const tid  = await genTrustId();
      const user = await User.create({
        firstName: firstName.trim(),
        middleName:(middleName||'').trim(),
        lastName:  (lastName||'').trim(),
        email:     addr,
        phone:     cleanPhone(phone||''),
        passwordHash,
        trustId:{ id:tid, level:1, score:100, status:'active', issuedAt:new Date() },
      });
      const token = fastify.jwt.sign({ userId:user._id, role:user.role }, { expiresIn:JWT_EXPIRES_IN });
      return reply.code(201).send({ success:true, token, user:user.safeUser() });
    } catch (err) {
      const friendly = friendlyDupError(err);
      if (friendly) return reply.code(409).send({ success:false, message:friendly });
      throw err;
    }
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

  /* PUT /api/trustid/auth/profile */
  fastify.put('/profile', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const body = req.body || {};
    const user = await User.findById(req.user.userId);
    if (!user) return reply.code(404).send({ success:false, message:'User not found' });

    ['firstName','middleName','lastName','bio','phone','profilePhoto'].forEach(k => {
      if (body[k] !== undefined) user[k] = String(body[k] || '').trim();
    });

    if (body.socialHandles && typeof body.socialHandles === 'object') {
      user.socialHandles = {
        whatsapp: body.socialHandles.whatsapp || '',
        facebook: body.socialHandles.facebook || '',
        instagram: body.socialHandles.instagram || '',
        x: body.socialHandles.x || '',
        linkedin: body.socialHandles.linkedin || '',
        tiktok: body.socialHandles.tiktok || '',
        snapchat: body.socialHandles.snapchat || '',
        website: body.socialHandles.website || '',
      };
    }

    await user.save();
    return { success:true, message:'Profile updated', user:user.safeUser() };
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
