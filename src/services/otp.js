/* In-memory OTP store. Each entry: { code, expires, data } */
var store = new Map();

function generate(email, formData) {
  var code = String(Math.floor(100000 + Math.random() * 900000));
  var expires = Date.now() + 10 * 60 * 1000; /* 10 minutes */
  store.set(email.toLowerCase(), { code, expires, data: formData });
  return code;
}

function verify(email, code) {
  var entry = store.get(email.toLowerCase());
  if (!entry) return null;
  if (Date.now() > entry.expires) { store.delete(email.toLowerCase()); return null; }
  if (entry.code !== String(code)) return null;
  var data = entry.data;
  store.delete(email.toLowerCase());
  return data;
}

module.exports = { generate, verify };
