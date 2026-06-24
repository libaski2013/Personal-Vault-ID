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
const ALIAS_ADJ = ['Nova','Echo','Velvet','Orbit','Cinder','Lumen','Mosaic','Quartz','Halo','Cipher','Ember','Aster'];
const ALIAS_NOUN = ['Signal','Drift','Pulse','Comet','Harbor','Quest','Vibe','Rune','Spark','Atlas','Muse','Beacon'];
function aliasFor(uid) {
  let n = 0;
  String(uid || '').split('').forEach((ch) => { n = (n * 31 + ch.charCodeAt(0)) >>> 0; });
  return ALIAS_ADJ[n % ALIAS_ADJ.length] + ' ' + ALIAS_NOUN[Math.floor(n / ALIAS_ADJ.length) % ALIAS_NOUN.length];
}
function iniFor(alias) {
  return String(alias || '?').split(/\s+/).map((p) => p[0] || '').join('').slice(0, 2).toUpperCase() || '?';
}

module.exports = function attachSocket(httpServer, jwtDecode) {
  const io = new Server(httpServer, {
    cors:   { origin: '*', methods: ['GET','POST'] },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000, pingInterval: 8000,
    maxHttpBufferSize: 5e6,
  });

  /* In-memory discovery map: userId → { uid, name, ini, ip, lat, lng, socketId, ts } */
  const discovery = new Map();
  const chatSessions = new Map();
  const CHAT_IDLE_MS = 15 * 60 * 1000;

  function chatKey(a, b) {
    return [String(a), String(b)].sort().join(':');
  }
  function touchChat(a, b) {
    if (!a || !b) return;
    const key = chatKey(a, b);
    const existing = chatSessions.get(key);
    if (existing && existing.timer) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      const s = chatSessions.get(key);
      if (!s) return;
      io.to('user:' + s.a).emit('chat:ended', { by:'system', peer:s.b, reason:'inactive', ts:Date.now() });
      io.to('user:' + s.b).emit('chat:ended', { by:'system', peer:s.a, reason:'inactive', ts:Date.now() });
      chatSessions.delete(key);
    }, CHAT_IDLE_MS);
    chatSessions.set(key, { a:String(a), b:String(b), timer, ts:Date.now() });
  }
  function endChatBoth(a, b, reason) {
    if (!a || !b) return;
    const key = chatKey(a, b);
    const s = chatSessions.get(key);
    if (s && s.timer) clearTimeout(s.timer);
    chatSessions.delete(key);
    io.to('user:' + a).emit('chat:ended', { by:a, peer:b, self:true, reason:reason || 'ended', ts:Date.now() });
    io.to('user:' + b).emit('chat:ended', { by:a, peer:a, reason:reason || 'ended', ts:Date.now() });
  }

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
        nearby.push({ uid:id, name:d.alias, ini:d.ini, alias:d.alias, sameNetwork:sameNet, distanceM: dist ? Math.round(dist) : null, distanceKm: dist ? (dist/1000).toFixed(1) : null });
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
    socket.on('discovery:on', ({ lat, lng }) => {
      const uid = socket.data.userId;
      if (!uid) return;
      const alias = aliasFor(uid);
      discovery.set(uid, { uid, alias, ini:iniFor(alias), ip, lat:lat||null, lng:lng||null, socketId:socket.id, ts:Date.now() });
      const nearby = findNearby(uid, ip, lat, lng);
      socket.emit('discovery:nearby', nearby);
      /* Tell nearby users this person appeared */
      nearby.forEach(function(n) {
        io.to('user:'+n.uid).emit('discovery:appeared', { uid, name:alias, alias, ini:iniFor(alias), sameNetwork:n.sameNetwork, distanceM:n.distanceM });
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
    socket.on('chat:request', ({ to }) => {
      const alias = aliasFor(socket.data.userId);
      io.to('user:'+to).emit('chat:incoming', { from: socket.data.userId, fromName: alias, alias, ini: iniFor(alias) });
    });

    socket.on('chat:accept', ({ to }) => {
      touchChat(socket.data.userId, to);
      io.to('user:'+to).emit('chat:accepted', { by: socket.data.userId, alias: aliasFor(socket.data.userId), ini: iniFor(aliasFor(socket.data.userId)) });
    });

    socket.on('chat:resume', ({ to }) => {
      touchChat(socket.data.userId, to);
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
      touchChat(uid, to);
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
      touchChat(uid, to);
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

    /* ── SHARE DIGITAL CONTACT CARD in chat ── */
    socket.on('chat:card', ({ to, card }) => {
      touchChat(socket.data.userId, to);
      io.to('user:' + to).emit('chat:card', {
        from: socket.data.userId, card, ts: Date.now(),
      });
    });

    socket.on('chat:edit', ({ to, messageId, text }) => {
      const uid = socket.data.userId;
      if (!uid || !to || !messageId || !String(text || '').trim()) return;
      touchChat(uid, to);
      io.to('user:' + to).emit('chat:edited', { from:uid, messageId, text:String(text).trim(), ts:Date.now() });
      socket.emit('chat:edited', { from:uid, messageId, text:String(text).trim(), self:true, ts:Date.now() });
    });

    socket.on('chat:delete', ({ to, messageId }) => {
      const uid = socket.data.userId;
      if (!uid || !to || !messageId) return;
      touchChat(uid, to);
      io.to('user:' + to).emit('chat:deleted', { from:uid, messageId, ts:Date.now() });
      socket.emit('chat:deleted', { from:uid, messageId, self:true, ts:Date.now() });
    });

    /* ── EMOJI REACTION on a message ── */
    socket.on('chat:react', ({ to, messageId, emoji }) => {
      touchChat(socket.data.userId, to);
      io.to('user:' + to).emit('chat:react', {
        from: socket.data.userId, messageId, emoji, ts: Date.now(),
      });
    });

    /* ── EMOTION BURST (large animated emoji share) ── */
    socket.on('chat:emotion', ({ to, emoji, label }) => {
      touchChat(socket.data.userId, to);
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
      endChatBoth(socket.data.userId, to, 'ended');
    });

    /* ── DISCONNECT ── */
    socket.on('disconnect', () => {
      const uid = socket.data.userId;
      if (uid) {
        discovery.delete(uid);
        socket.broadcast.emit('discovery:gone', { uid });
      }
      /* Clean up album room if host disconnects */
      if (socket.data.albumRoom) {
        const roomId = socket.data.albumRoom;
        const room   = albumRooms.get(roomId);
        if (room && room.hostSocketId === socket.id) {
          io.to('album:' + roomId).emit('album:closed', { message: 'The host disconnected. Session ended.' });
          albumRooms.delete(roomId);
        }
      }
    });

    /* ── SECRET ALBUM events (inside connection handler) ── */
    socket.on('album:host', ({ roomId, expiresAt }) => {
      albumRooms.set(roomId, {
        hostSocketId: socket.id,
        expiresAt:    new Date(expiresAt),
        viewers:      new Set(),
        active:       true,
      });
      socket.join('album:' + roomId);
      socket.data.albumRoom = roomId;
      const ms = new Date(expiresAt).getTime() - Date.now();
      setTimeout(function() {
        const room = albumRooms.get(roomId);
        if (room && room.active) { io.to('album:' + roomId).emit('album:expired'); albumRooms.delete(roomId); }
      }, Math.max(ms, 1000));
    });

    socket.on('album:join', ({ roomId }) => {
      const room = albumRooms.get(roomId);
      if (!room || !room.active) { socket.emit('album:error', { message: 'This album link has expired or been closed.' }); return; }
      if (new Date() > room.expiresAt) { socket.emit('album:error', { message: 'This viewing session has expired.' }); albumRooms.delete(roomId); return; }
      socket.join('album:' + roomId);
      room.viewers.add(socket.id);
      io.to(room.hostSocketId).emit('album:viewer-joined', { viewerCount: room.viewers.size, socketId: socket.id });
      socket.emit('album:session-info', { expiresAt: room.expiresAt, viewerCount: room.viewers.size });
      io.to(room.hostSocketId).emit('album:stream-to', { viewerSocketId: socket.id });
    });

    socket.on('album:photo', ({ viewerSocketId, data, index, total, filename }) => {
      if (!data || data.length > 10 * 1024 * 1024) return;
      io.to(viewerSocketId).emit('album:photo', { data, index, total, filename });
    });

    socket.on('album:broadcast-photo', ({ roomId, data, index, total, filename }) => {
      if (!data || data.length > 10 * 1024 * 1024) return;
      socket.to('album:' + roomId).emit('album:photo', { data, index, total, filename });
    });

    socket.on('album:close', ({ roomId }) => {
      io.to('album:' + roomId).emit('album:closed', { message: 'The host ended this viewing session.' });
      albumRooms.delete(roomId);
    });

    socket.on('album:leave', ({ roomId }) => {
      const room = albumRooms.get(roomId);
      if (room) { room.viewers.delete(socket.id); io.to(room.hostSocketId).emit('album:viewer-count', { viewerCount: room.viewers.size }); }
    });

    socket.on('album:screenshot-attempt', ({ roomId, reason }) => {
      const room = albumRooms.get(roomId);
      if (room) io.to(room.hostSocketId).emit('album:screenshot-attempt', { from: socket.id, reason });
    });

  });   /* end io.on('connection') */

  /* Clean up stale discovery entries every 2 minutes */
  setInterval(function() {
    const cutoff = Date.now() - 2*60*1000;
    for (const [uid, d] of discovery.entries()) {
      if (d.ts < cutoff) discovery.delete(uid);
    }
  }, 2*60*1000);

  return io;
};
