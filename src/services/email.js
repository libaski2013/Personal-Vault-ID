const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_PORT !== '587',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

async function sendOTP(to, firstName, code) {
  if (!process.env.SMTP_USER) {
    /* No email configured — log code for dev */
    console.log(`[OTP] ${to} → ${code}`);
    return;
  }
  await transporter.sendMail({
    from: `"TrustID" <${process.env.SMTP_USER}>`,
    to,
    subject: `${code} — Your TrustID verification code`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px">
          <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#1E1B4B,#7C3AED);display:inline-flex;align-items:center;justify-content:center;font-size:20px">🛡️</div>
          <span style="font-size:20px;font-weight:900;color:#0F172A">TrustID</span>
        </div>
        <h1 style="font-size:24px;font-weight:900;color:#0F172A;margin-bottom:8px">Verify your email</h1>
        <p style="color:#64748B;font-size:15px;line-height:1.7;margin-bottom:28px">Hi ${firstName}, enter this code to complete your TrustID account registration. The code expires in 10 minutes.</p>
        <div style="background:#F8FAFC;border-radius:14px;padding:28px;text-align:center;margin-bottom:28px;border:2px dashed #E2E8F0">
          <div style="font-size:42px;font-weight:900;letter-spacing:10px;color:#7C3AED;font-family:monospace">${code}</div>
        </div>
        <p style="color:#94A3B8;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      </div>`,
  });
}

async function sendPasswordResetOTP(to, firstName, code) {
  if (!process.env.SMTP_USER) {
    console.log(`[PASSWORD RESET] ${to} -> ${code}`);
    return;
  }
  await transporter.sendMail({
    from: `"TrustID" <${process.env.SMTP_USER}>`,
    to,
    subject: `${code} - Reset your TrustID password`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px">
          <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#1E1B4B,#7C3AED);display:inline-flex;align-items:center;justify-content:center;font-size:20px">🛡️</div>
          <span style="font-size:20px;font-weight:900;color:#0F172A">TrustID</span>
        </div>
        <h1 style="font-size:24px;font-weight:900;color:#0F172A;margin-bottom:8px">Reset your password</h1>
        <p style="color:#64748B;font-size:15px;line-height:1.7;margin-bottom:28px">Hi ${firstName || 'there'}, enter this code to reset your TrustID password. The code expires in 10 minutes.</p>
        <div style="background:#F8FAFC;border-radius:14px;padding:28px;text-align:center;margin-bottom:28px;border:2px dashed #E2E8F0">
          <div style="font-size:42px;font-weight:900;letter-spacing:10px;color:#7C3AED;font-family:monospace">${code}</div>
        </div>
        <p style="color:#94A3B8;font-size:13px">If you did not request this, you can ignore this email.</p>
      </div>`,
  });
}

async function sendInactivityPrompt(user, daysLeft) {
  const urgency = daysLeft <= 2 ? '🚨 URGENT' : daysLeft <= 7 ? '⚠️ Important' : '👋 Reminder';
  await transporter.sendMail({
    from: `"Personal Vault" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: `${urgency}: Are you still with us? ${daysLeft} day${daysLeft===1?'':'s'} remaining`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px">
          <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#7C3AED,#5B21B6);display:inline-flex;align-items:center;justify-content:center;font-size:20px">🔐</div>
          <span style="font-size:20px;font-weight:900;color:#0F172A">Personal Vault</span>
        </div>
        <h1 style="font-size:22px;font-weight:900;color:#0F172A;margin-bottom:12px">We haven't heard from you in a while, ${user.firstName}</h1>
        <p style="color:#64748B;font-size:15px;line-height:1.7;margin-bottom:20px">Your Personal Vault has a <strong>Digital Legacy</strong> feature active. You have been inactive for a while.</p>
        <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:12px;padding:20px;margin-bottom:24px">
          <div style="font-weight:800;color:#92400E;font-size:15px;margin-bottom:6px">⏰ ${daysLeft} day${daysLeft===1?'':'s'} remaining</div>
          <div style="color:#78350F;font-size:14px">If you don't check in within ${daysLeft} day${daysLeft===1?'':'s'}, your designated emergency contacts will be notified.</div>
        </div>
        <a href="${process.env.APP_URL||'https://personal-vault-id.onrender.com'}/trustid/legacy.html" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#7C3AED,#5B21B6);color:#fff;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none">✅ I'm Alive — Check In Now</a>
        <p style="color:#94A3B8;font-size:12px;margin-top:20px">If you are reading this, simply click the button above to reset your 90-day timer. If this is a mistake, please sign in to your Personal Vault.</p>
      </div>`,
  });
}

module.exports = { sendOTP, sendPasswordResetOTP, sendInactivityPrompt };
