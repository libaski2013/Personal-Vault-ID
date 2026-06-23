/**
 * Personal Vault — Real-time Socket.io
 *
 * Discovery model:
 *  - Users only appear to each other when:
 *    a) They share the same public IP  (same WiFi/network)
 *    b) OR they are within 150 m and both have discovery ON
 *  - Nothing is stored in MongoDB. All presence is in memory.
 *  - No contacts list. No persistent chat history.
 */
const { Server } = require('socket.io');

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function normalIp(ip) { return (ip || '').replace(/^::ffff:/, '').split(',')[0].trim(); }

module.exports = function attachSocket(httpServer, jwtDecode) {
  const io = new Server(httpServer, {
    cors:   { origin: '*', methods: ['GET','POST'] },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000, pingInterval: 8000,
    maxHttpBufferSize: 5e6,
  });

  /* In-memory discovery map: userId → { uid, name, ini, ip, lat, lng, socketId, ts } */
  const discovery = new Map();

  /* Find users near me (same IP or within 150 m) */
  function findNearby(uid, ip, lat, lng) {
    const nearby = [];
    for (const [id, d] of discovery.entries()) {
      if (id === uid) continue;
      const sameNet = ip && d.ip && normalIp(ip) === normalIp(d.ip);
      let dist = null;
      if (lat != null && lng != null && d.lat != null && d.lng != null)
        dist = haversineM(lat, lng, d.lat, d.lng);
      if (sameNet || (dist !== null && dist <= 5000)) {   /* 5 km radius */
        nearby.push({ uid:id, name:d.name, ini:d.ini, sameNetwork:sameNet, distanceM: dist ? Math.round(dist) : null, distanceKm: dist ? (dist/1000).toFixed(1) : null });
      }
    }
    return nearby;
  }

  io.on('connection', (socket) => {
    const ip = normalIp(socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '');

    /* ── AUTHENTICATE ── */
    socket.on('chat:join', (token) => {
      try {
        const p = jwtDecode(token);
        if (!p || !p.userId) return;
        socket.data.userId = String(p.userId);
        socket.data.ip     = ip;
        socket.join('user:' + socket.data.userId);
      } catch {}
    });

    /* ── DISCOVERY ON ── */
    socket.on('discovery:on', ({ name, ini, lat, lng }) => {
      const uid = socket.data.userId;
      if (!uid) return;
      discovery.set(uid, { uid, name:name||'?', ini:ini||'?', ip, lat:lat||null, lng:lng||null, socketId:socket.id, ts:Date.now() });
      const nearby = findNearby(uid, ip, lat, lng);
      socket.emit('discovery:nearby', nearby);
      /* Tell nearby users this person appeared */
      nearby.forEach(function(n) {
        io.to('user:'+n.uid).emit('discovery:appeared', { uid, name:name||'?', ini:ini||'?', sameNetwork:n.sameNetwork, distanceM:n.distanceM });
      });
    });

    /* ── DISCOVERY OFF ── */
    socket.on('discovery:off', () => {
      const uid = socket.data.userId;
      if (uid) {
        discovery.delete(uid);
        socket.broadcast.emit('discovery:gone', { uid });
      }
    });

    /* ── REQUEST CHAT — tap a nearby person ── */
    socket.on('chat:request', ({ to, fromName }) => {
      io.to('user:'+to).emit('chat:incoming', { from: socket.data.userId, fromName });
    });

    socket.on('chat:accept', ({ to }) => {
      io.to('user:'+to).emit('chat:accepted', { by: socket.data.userId });
    });

    socket.on('chat:decline', ({ to }) => {
      io.to('user:'+to).emit('chat:declined', { by: socket.data.userId });
    });

    /* ── LIVE-TYPE MIRROR (every keystroke) ── */
    socket.on('chat:live-type', ({ to, text }) => {
      io.to('user:'+to).emit('chat:live-type', { from:socket.data.userId, text, ts:Date.now() });
    });

    /* ── SEND MESSAGE (text) ── */
    socket.on('chat:send', ({ to, text, tempId }) => {
      const uid = socket.data.userId;
      if (!uid || !String(text||'').trim()) return;
      const msg = { id:tempId||('m'+Date.now()), from:uid, to, text:String(text).trim(), ts:Date.now(), type:'text' };
      io.to('user:'+to).emit('chat:message', msg);
      socket.emit('chat:sent', { tempId, id:msg.id, ts:msg.ts });
      io.to('user:'+to).emit('chat:live-type', { from:uid, text:'' });
    });

    /* ── SEND PHOTO (from gallery or secret album) ── */
    socket.on('chat:photo', ({ to, data, tempId, filename, fromAlbum }) => {
      const uid = socket.data.userId;
      if (!uid || !data) return;
      if (data.length > 5*1024*1024) { socket.emit('chat:error',{message:'Photo too large (max 5 MB)'}); return; }
      const msg = { id:tempId||('img'+Date.now()), from:uid, to, data, filename:filename||'photo.jpg', ts:Date.now(), type:'photo', fromAlbum:!!fromAlbum };
      io.to('user:'+to).emit('chat:message', msg);
      socket.emit('chat:sent', { tempId, id:msg.id, ts:msg.ts });
    });

    /* ── MOOD ── */
    socket.on('chat:mood', ({ to, emoji, reason }) => {
      io.to('user:'+to).emit('chat:mood', { from:socket.data.userId, emoji, reason:reason||'', ts:Date.now() });
    });

    /* ── TYPING (legacy) ── */
    socket.on('chat:typing', ({ to }) => {
      io.to('user:'+to).emit('chat:typing', { from:socket.data.userId, ts:Date.now() });
    });

    /* ── READ ── */
    socket.on('chat:read', ({ to }) => {
      io.to('user:'+to).emit('chat:read', { by:socket.data.userId, ts:Date.now() });
    });

    /* ── EMOJI REACTION on a message ── */
    socket.on('chat:react', ({ to, messageId, emoji }) => {
      io.to('user:' + to).emit('chat:react', {
        from: socket.data.userId, messageId, emoji, ts: Date.now(),
      });
    });

    /* ── EMOTION BURST (large animated emoji share) ── */
    socket.on('chat:emotion', ({ to, emoji, label }) => {
      io.to('user:' + to).emit('chat:emotion', {
        from: socket.data.userId, emoji, label: label||'', ts: Date.now(),
      });
    });

    /* ── SCREENSHOT ALERT ── */
    socket.on('chat:screenshot', ({ to }) => {
      io.to('user:'+to).emit('chat:screenshot-alert', { from:socket.data.userId, ts:Date.now() });
    });

    /* ── END CHAT ── */
    socket.on('chat:end', ({ to }) => {
      io.to('user:'+to).emit('chat:ended', { by:socket.data.userId, ts:Date.now() });
      socket.emit('chat:ended', { by:socket.data.userId, self:true, ts:Date.now() });
    });

    /* ── DISCONNECT ── */
    socket.on('disconnect', () => {
      const uid = socket.data.userId;
      if (uid) {
        discovery.delete(uid);
        socket.broadcast.emit('discovery:gone', { uid });
      }
    });
  });

  /* Clean up stale discovery entries every 2 minutes */
  setInterval(function() {
    const cutoff = Date.now() - 2*60*1000;
    for (const [uid, d] of discovery.entries()) {
      if (d.ts < cutoff) discovery.delete(uid);
    }
  }, 2*60*1000);

  return io;
};
