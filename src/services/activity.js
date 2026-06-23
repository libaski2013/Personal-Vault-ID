const { Activity } = require('../db/models');

async function log(userId, action, details, req, level) {
  try {
    const ip        = req ? (req.headers['x-forwarded-for'] || req.ip || '') : '';
    const userAgent = req ? (req.headers['user-agent'] || '').slice(0, 200) : '';
    await Activity.create({
      userId:    userId || null,
      action,
      details:   details || '',
      ip:        String(ip).split(',')[0].trim().slice(0, 60),
      userAgent,
      level:     level || 'info',
    });
  } catch (e) {
    /* Never crash on audit failure */
    console.error('[Activity log error]', e.message);
  }
}

module.exports = { log };
