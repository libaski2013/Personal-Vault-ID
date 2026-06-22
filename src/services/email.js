/**
 * Email service — tries providers in order:
 *  1. Resend (RESEND_API_KEY) — recommended, free, zero config
 *  2. SMTP / Gmail (SMTP_USER + SMTP_PASS) — needs App Password
 *  3. Console log fallback — always works, shows code in server logs
 */

const FROM_NAME    = process.env.EMAIL_FROM_NAME  || 'Personal Vault';
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDR  || (process.env.SMTP_USER || 'noreply@personalvault.app');
const FROM         = `"${FROM_NAME}" <${FROM_ADDRESS}>`;

/* ── Resend (recommended) ─────────────────────────────────────── */
async function sendViaResend(to, subject, html) {
  const { Resend } = require('resend');
  const client = new Resend(process.env.RESEND_API_KEY);
  const res = await client.emails.send({ from: FROM, to, subject, html });
  if (res.error) throw new Error(res.error.message || 'Resend error');
  return res;
}

/* ── Nodemailer / SMTP ────────────────────────────────────────── */
async function sendViaSMTP(to, subject, html) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '465', 10),
    secure: (process.env.SMTP_PORT || '465') !== '587',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transporter.sendMail({ from: FROM, to, subject, html });
}

/* ── Pick provider ────────────────────────────────────────────── */
async function send(to, subject, html) {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(to, subject, html);
  }
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return sendViaSMTP(to, subject, html);
  }
  /* No provider — log only */
  console.log(`[EMAIL - no provider] To: ${to} | Subject: ${subject}`);
}

/* ── OTP email ────────────────────────────────────────────────── */
async function sendOTP(to, firstName, code) {
  const subject = `${code} — Your Personal Vault verification code`;
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px">
        <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#7C3AED,#5B21B6);display:inline-flex;align-items:center;justify-content:center;font-size:20px">🔐</div>
        <span style="font-size:20px;font-weight:900;color:#0F172A">Personal Vault</span>
      </div>
      <h1 style="font-size:24px;font-weight:900;color:#0F172A;margin-bottom:8px">Verify your email</h1>
      <p style="color:#64748B;font-size:15px;line-height:1.7;margin-bottom:28px">Hi ${firstName}, use this code to complete your Personal Vault registration. It expires in <strong>10 minutes</strong>.</p>
      <div style="background:#F8FAFC;border-radius:14px;padding:28px;text-align:center;margin-bottom:28px;border:2px dashed #E2E8F0">
        <div style="font-size:48px;font-weight:900;letter-spacing:10px;color:#7C3AED;font-family:monospace">${code}</div>
        <div style="font-size:13px;color:#94A3B8;margin-top:8px">6-digit verification code</div>
      </div>
      <p style="color:#94A3B8;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
    </div>`;
  await send(to, subject, html);
}

/* ── Inactivity prompt (Digital Legacy) ──────────────────────── */
async function sendInactivityPrompt(user, daysLeft) {
  const subject = `${daysLeft <= 2 ? '🚨' : daysLeft <= 7 ? '⚠️' : '👋'} Are you still there? ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`;
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h1 style="font-size:22px;font-weight:900;color:#0F172A;margin-bottom:12px">We haven't heard from you, ${user.firstName}</h1>
      <p style="color:#64748B;font-size:15px;line-height:1.7;margin-bottom:20px">Your Personal Vault has a <strong>Digital Legacy</strong> feature active. You have been inactive.</p>
      <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:12px;padding:20px;margin-bottom:24px">
        <div style="font-weight:800;color:#92400E;font-size:15px;margin-bottom:6px">⏰ ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining</div>
        <div style="color:#78350F;font-size:14px">If you don't check in, your emergency contacts will be notified.</div>
      </div>
      <a href="${process.env.APP_URL || 'https://personal-vault-id.onrender.com'}/trustid/legacy.html"
         style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#7C3AED,#5B21B6);color:#fff;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none">
        ✅ I'm Alive — Check In Now
      </a>
    </div>`;
  await send(user.email, subject, html);
}

/* ── Password reset ───────────────────────────────────────────── */
async function sendPasswordReset(to, firstName, code) {
  const subject = `${code} — Reset your Personal Vault password`;
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h1 style="font-size:24px;font-weight:900;color:#0F172A;margin-bottom:8px">Password reset</h1>
      <p style="color:#64748B;margin-bottom:24px">Hi ${firstName}, use this code to reset your password:</p>
      <div style="background:#F8FAFC;border-radius:14px;padding:28px;text-align:center;margin-bottom:24px;border:2px dashed #E2E8F0">
        <div style="font-size:48px;font-weight:900;letter-spacing:10px;color:#7C3AED;font-family:monospace">${code}</div>
      </div>
      <p style="color:#94A3B8;font-size:13px">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
    </div>`;
  await send(to, subject, html);
}

module.exports = { sendOTP, sendInactivityPrompt, sendPasswordReset };
