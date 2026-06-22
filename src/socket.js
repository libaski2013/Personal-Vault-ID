/**
 * Personal Vault — Real-time Socket.io handler
 * Ephemeral chat: messages are NEVER stored in MongoDB.
 * They live only in memory and vanish when the chat ends.
 */

const { Server } = require('socket.io');

module.exports = function attachSocket(httpServer, jwtDecode) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET','POST'] },
    transports: ['websocket', 'polling'],
    pingTimeout:  20000,
    pingInterval: 8000,
    maxHttpBufferSize: 5e6,   /* 5 MB — allows photo transfers */
  });

  /* Online users: userId → socketId */
  const online = new Map();

  /* Active conversations: convKey(a,b) → { aId, bId, msgs[] } */
  const chats  = new Map();

  function convKey(a, b) {
    return [String(a), String(b)].sort().join(':');
  }
  function getChat(a, b) {
    const key = convKey(a, b);
    if (!chats.has(key)) chats.set(key, { aId: String(a), bId: String(b), msgs: [], ended: false });
    return { key, chat: chats.get(key) };
  }

  io.on('connection', (socket) => {

    /* ── JOIN: user authenticates with JWT token ── */
    socket.on('chat:join', (token) => {
      try {
        const p = jwtDecode(token);
        if (!p || !p.userId) return;
        const uid = String(p.userId);
        socket.data.userId = uid;
        socket.join('user:' + uid);
        online.set(uid, socket.id);
        io.emit('chat:online', { userId: uid, online: true });
      } catch {}
    });

    /* ── MOOD: user sets their mood before/during chat ── */
    socket.on('chat:mood', ({ to, emoji, reason }) => {
      io.to('user:' + to).emit('chat:mood', {
        from:   socket.data.userId,
        emoji,
        reason: reason || '',
        ts:     Date.now(),
      });
    });

    /* ── LIVE TYPE: broadcast every keystroke (instant mirror) ── */
    socket.on('chat:live-type', ({ to, text }) => {
      io.to('user:' + to).emit('chat:live-type', {
        from: socket.data.userId,
        text,
        ts:   Date.now(),
      });
    });

    /* ── SEND: final message ── */
    socket.on('chat:send', ({ to, text, tempId }) => {
      const uid = socket.data.userId;
      if (!uid || !text || !String(text).trim()) return;

      const msg = {
        id:   tempId || ('msg-' + Date.now() + '-' + Math.random().toString(36).slice(2)),
        from: uid,
        to,
        text: String(text).trim(),
        ts:   Date.now(),
        type: 'text',
      };

      /* Relay to recipient instantly */
      io.to('user:' + to).emit('chat:message', msg);
      /* Confirm to sender */
      socket.emit('chat:sent', { tempId, id: msg.id, ts: msg.ts });

      /* Stop live preview on recipient side */
      io.to('user:' + to).emit('chat:live-type', { from: uid, text: '' });
    });

    /* ── PHOTO: share image from gallery ── */
    socket.on('chat:photo', ({ to, data, tempId, filename }) => {
      const uid = socket.data.userId;
      if (!uid || !data) return;
      if (data.length > 4 * 1024 * 1024) {
        socket.emit('chat:error', { message: 'Photo too large (max 4 MB).' });
        return;
      }
      const msg = {
        id:       tempId || ('img-' + Date.now()),
        from:     uid,
        to,
        data,
        filename: filename || 'photo.jpg',
        ts:       Date.now(),
        type:     'photo',
      };
      io.to('user:' + to).emit('chat:message', msg);
      socket.emit('chat:sent', { tempId, id: msg.id, ts: msg.ts });
    });

    /* ── TYPING indicator ── */
    socket.on('chat:typing', ({ to }) => {
      io.to('user:' + to).emit('chat:typing', { from: socket.data.userId, ts: Date.now() });
    });

    /* ── READ receipt ── */
    socket.on('chat:read', ({ to }) => {
      io.to('user:' + to).emit('chat:read', { by: socket.data.userId, ts: Date.now() });
    });

    /* ── SCREENSHOT warning — notify other user ── */
    socket.on('chat:screenshot', ({ to }) => {
      io.to('user:' + to).emit('chat:screenshot-alert', {
        from: socket.data.userId, ts: Date.now(),
      });
    });

    /* ── END CHAT: both sides wiped ── */
    socket.on('chat:end', ({ to }) => {
      const uid = socket.data.userId;
      /* Notify the other user to wipe their screen */
      io.to('user:' + to).emit('chat:ended', { by: uid, ts: Date.now() });
      /* Notify sender too */
      socket.emit('chat:ended', { by: uid, self: true, ts: Date.now() });
    });

    /* ── DISCONNECT ── */
    socket.on('disconnect', () => {
      const uid = socket.data.userId;
      if (uid) {
        online.delete(uid);
        io.emit('chat:online', { userId: uid, online: false });
      }
    });
  });

  return io;
};
