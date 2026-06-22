async function sendResetCode(to, code) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_PHONE;

  if (!sid || !token || !from) {
    console.log(`[SMS RESET] ${to} -> ${code}`);
    return;
  }

  const body = new URLSearchParams({
    From: from,
    To: to,
    Body: `Your TrustID password reset code is ${code}. It expires in 10 minutes.`,
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SMS provider failed: ${res.status} ${text}`);
  }
}

module.exports = { sendResetCode };
