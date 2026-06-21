const { Legacy, User } = require('../db/models');
const emailSvc = require('../services/email');

const INACTIVITY_DAYS    = 90;
const PROMPT_DAYS        = [75, 80, 85, 88, 89, 90];

module.exports = async function legacyRoutes(fastify) {

  /* GET /api/trustid/legacy — get user's legacy setup */
  fastify.get('/', { onRequest:[fastify.authenticate] }, async (req) => {
    let rec = await Legacy.findOne({ userId:req.user.userId });
    if (!rec) rec = { status:'active', contacts:[], message:'', messageTitle:'My Final Message', discloseTo:'' };
    const user = await User.findById(req.user.userId).select('lastActivity');
    const daysSince = user ? Math.floor((Date.now()-new Date(user.lastActivity).getTime())/(1000*60*60*24)) : 0;
    return { success:true, data:rec, daysSinceActivity:daysSince };
  });

  /* PUT /api/trustid/legacy — setup/update legacy vault */
  fastify.put('/', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const { messageTitle, message, discloseTo, contacts } = req.body||{};
    const contacts3 = (contacts||[]).slice(0,3).map((c,i)=>({ name:c.name||'', email:c.email||'', phone:c.phone||'', order:i+1 }));
    const rec = await Legacy.findOneAndUpdate(
      { userId:req.user.userId },
      { $set:{ messageTitle:messageTitle||'My Final Message', message:message||'', discloseTo:discloseTo||'', contacts:contacts3 }},
      { upsert:true, new:true }
    );
    return { success:true, data:rec };
  });

  /* POST /api/trustid/legacy/check-in — user confirms they're alive, resets timer */
  fastify.post('/check-in', { onRequest:[fastify.authenticate] }, async (req) => {
    await User.findByIdAndUpdate(req.user.userId, { lastActivity:new Date() });
    await Legacy.findOneAndUpdate(
      { userId:req.user.userId },
      { $set:{ status:'active', promptCount:0, lastPromptSent:null } },
      { upsert:true }
    );
    return { success:true, message:'Check-in confirmed. Your 90-day clock has been reset.' };
  });

  /* POST /api/trustid/legacy/disclose/:userId — ADMIN: mark as disclosed, send message */
  fastify.post('/disclose/:userId', { onRequest:[fastify.requireAdmin] }, async (req, reply) => {
    const rec = await Legacy.findOne({ userId:req.params.userId });
    if (!rec) return reply.code(404).send({ success:false, message:'No legacy record' });
    if (!rec.discloseTo) return reply.code(400).send({ success:false, message:'No disclosure recipient set' });

    if (process.env.SMTP_USER) {
      await emailSvc.sendOTP(rec.discloseTo, 'Recipient', ''); // reuse transport
    } else {
      console.log('[LEGACY] Would disclose message to:', rec.discloseTo);
      console.log('[LEGACY] Message:', rec.message);
    }

    rec.status = 'disclosed';
    rec.disclosedAt = new Date();
    await rec.save();
    return { success:true, message:'Legacy message disclosed to '+rec.discloseTo };
  });

  /* GET /api/trustid/admin/inactivity — ADMIN: list inactive users needing attention */
  fastify.get('/admin-report', { onRequest:[fastify.requireAdmin] }, async () => {
    const threshold75  = new Date(Date.now() - 75*24*60*60*1000);
    const users = await User.find({ lastActivity:{ $lt:threshold75 }, role:'user' }).select('firstName lastName email lastActivity');
    const report = await Promise.all(users.map(async (u) => {
      const days = Math.floor((Date.now()-new Date(u.lastActivity).getTime())/(1000*60*60*24));
      const legacy = await Legacy.findOne({ userId:u._id });
      return { user:{ _id:u._id, name:u.firstName+' '+u.lastName, email:u.email }, daysSilent:days, legacy:legacy||null };
    }));
    return { success:true, data:report };
  });
};

/* ── Background inactivity checker (runs every 24 h) ── */
async function runInactivityCheck() {
  try {
    const { Legacy, User } = require('../db/models');
    const emailSvc = require('../services/email');
    const now = Date.now();

    for (const days of PROMPT_DAYS) {
      const threshold = new Date(now - days*24*60*60*1000);
      const nextDay   = new Date(now - (days-1)*24*60*60*1000);
      const users = await User.find({ lastActivity:{ $gte:threshold, $lt:nextDay }, role:'user' });

      for (const user of users) {
        const legacy = await Legacy.findOne({ userId:user._id });
        if (!legacy || legacy.status === 'disclosed' || legacy.status === 'cancelled') continue;

        if (days < 90) {
          /* Send prompt email */
          const daysLeft = 90 - days;
          console.log(`[LEGACY] Prompting ${user.email} — ${days} days inactive, ${daysLeft} days left`);
          if (process.env.SMTP_USER && user.email) {
            await emailSvc.sendInactivityPrompt(user, daysLeft).catch(()=>{});
          }
          await Legacy.findByIdAndUpdate(legacy._id, {
            $set:{ status:'prompted', lastPromptSent:new Date() },
            $inc:{ promptCount:1 },
          });
        } else {
          /* 90 days — notify admin */
          if (legacy.status !== 'admin_notified') {
            console.log(`[LEGACY] Admin alert: ${user.email} has been inactive 90+ days`);
            await Legacy.findByIdAndUpdate(legacy._id, { status:'admin_notified', adminNotifiedAt:new Date() });
          }
        }
      }
    }
  } catch (e) {
    console.error('[LEGACY] Inactivity check error:', e.message);
  }
}

/* Run check every 24 hours after a 1-minute startup delay */
setTimeout(function startChecker() {
  runInactivityCheck();
  setInterval(runInactivityCheck, 24*60*60*1000);
}, 60*1000);
