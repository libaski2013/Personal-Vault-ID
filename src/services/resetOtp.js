const store = new Map();

const TTL_MS = 10 * 60 * 1000;

function key(channel, target) {
  return `${channel}:${String(target || '').trim().toLowerCase()}`;
}

function generate(channel, target, data) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  store.set(key(channel, target), {
    code,
    data,
    expires: Date.now() + TTL_MS,
  });
  return code;
}

function verify(channel, target, code) {
  const k = key(channel, target);
  const entry = store.get(k);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(k);
    return null;
  }
  if (String(code || '').trim() !== entry.code) return null;
  store.delete(k);
  return entry.data;
}

module.exports = { generate, verify };
