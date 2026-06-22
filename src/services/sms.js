/**
 * SMS service — Twilio (configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_PHONE)
 * If Twilio not configured, logs code to console for dev/testing.
 */
async function _twilio(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_FROM_PHONE;
  if (!sid || !token || !from) return false;   /* not configured */

  const params = new URLSearchParams({ From: from, To: to, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method:  'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio error ${res.status}: ${text}`);
  }
  return true;
}

async function sendOTP(phone, firstName, code) {
  const msg = `Personal Vault: Hi ${firstName}, your verification code is ${code}. It expires in 10 minutes. Do not share this code.`;
  const sent = await _twilio(phone, msg);
  if (!sent) console.log(`[SMS-OTP] ${phone} → ${code}`);
  return sent;
}

async function sendResetCode(phone, code) {
  const msg = `Personal Vault: Your password reset code is ${code}. It expires in 10 minutes.`;
  const sent = await _twilio(phone, msg);
  if (!sent) console.log(`[SMS-RESET] ${phone} → ${code}`);
  return sent;
}

module.exports = { sendOTP, sendResetCode };
