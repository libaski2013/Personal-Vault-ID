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

module.exports = { sendOTP };
