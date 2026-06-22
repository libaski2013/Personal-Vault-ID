const { ShareCard, User, Document, Academic, LifeEntry } = require('../db/models');

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PV';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

module.exports = async function shareRoutes(fastify) {

  /* POST /api/trustid/share — create a share card */
  fastify.post('/', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const { title, customMessage, sections, expiresInDays } = req.body || {};
    if (!sections || sections.length === 0)
      return reply.code(400).send({ success:false, message:'Select at least one section to share' });

    let shareCode;
    let attempts = 0;
    do {
      shareCode = genCode();
      attempts++;
    } while (attempts < 10 && await ShareCard.findOne({ shareCode }));

    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 864e5) : null;
    const card = await ShareCard.create({
      userId: req.user.userId,
      shareCode,
      title: title || 'My Personal Vault',
      customMessage: customMessage || '',
      sections,
      expiresAt,
    });
    return reply.code(201).send({ success:true, data:card, shareCode });
  });

  /* GET /api/trustid/share — user's own share cards */
  fastify.get('/', { onRequest:[fastify.authenticate] }, async (req) => {
    const data = await ShareCard.find({ userId:req.user.userId }).sort({ createdAt:-1 });
    return { success:true, data };
  });

  /* DELETE /api/trustid/share/:id */
  fastify.delete('/:id', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const r = await ShareCard.findOneAndDelete({ _id:req.params.id, userId:req.user.userId });
    if (!r) return reply.code(404).send({ success:false, message:'Not found' });
    return { success:true };
  });

  /* PATCH /api/trustid/share/:id/toggle — enable/disable */
  fastify.patch('/:id/toggle', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const card = await ShareCard.findOne({ _id:req.params.id, userId:req.user.userId });
    if (!card) return reply.code(404).send({ success:false, message:'Not found' });
    card.isActive = !card.isActive;
    await card.save();
    return { success:true, data:card };
  });

  /* GET /api/trustid/share/view/:code — PUBLIC: view shared vault summary */
  fastify.get('/view/:code', async (req, reply) => {
    const card = await ShareCard.findOne({ shareCode:req.params.code });
    if (!card) return reply.code(404).send({ success:false, message:'Share code not found or has been removed' });
    if (!card.isActive) return reply.code(403).send({ success:false, message:'This share link has been deactivated by the owner' });
    if (card.expiresAt && new Date() > card.expiresAt)
      return reply.code(410).send({ success:false, message:'This share link has expired' });

    /* Increment view count */
    ShareCard.findByIdAndUpdate(card._id, { $inc:{ viewCount:1 } }).catch(()=>{});

    const sections = card.sections || [];
    const payload = {
      title:         card.title,
      customMessage: card.customMessage,
      sections,
      viewCount:     card.viewCount + 1,
      createdAt:     card.createdAt,
    };

    const user = await User.findById(card.userId).select('-passwordHash -vaultPinHash');
    if (!user) return reply.code(404).send({ success:false, message:'User not found' });

    /* Identity */
    if (sections.includes('identity')) {
      payload.identity = {
        name:     `${user.firstName} ${user.middleName || ''} ${user.lastName}`.replace(/\s+/g,' ').trim(),
        trustId:  user.trustId,
        joinedAt: user.joinedAt,
        profilePhoto:user.profilePhoto || '',
        bio:user.bio || '',
      };
    }

    /* Contact */
    if (sections.includes('contact')) {
      payload.contact = { email: user.email, phone:user.phone || '' };
    }

    if (sections.includes('social')) {
      payload.socialHandles = user.socialHandles || {};
    }

    /* Address (city/state/country only, not street) */
    if (sections.includes('address') && user.homeAddress) {
      const a = user.homeAddress;
      payload.address = {
        label:a.label || 'Home',
        city:a.city, state:a.state, country:a.country, postalCode:a.postalCode,
        mapUrl:a.mapUrl || ''
      };
    }

    if (sections.includes('previous-addresses')) {
      payload.previousAddresses = (user.previousAddresses || []).map(a => ({
        label:a.label, city:a.city, state:a.state, country:a.country,
        postalCode:a.postalCode, livedFrom:a.livedFrom, livedTo:a.livedTo,
        mapUrl:a.mapUrl || '',
      }));
    }

    /* Verified documents only */
    if (sections.includes('documents')) {
      const docs = await Document.find({ userId:card.userId, status:'verified' }).select('name type category createdAt');
      payload.documents = docs;
    }

    /* Public academic records */
    if (sections.includes('academics')) {
      const acad = await Academic.find({ userId:card.userId }).select('title type institution year grade isPublic');
      payload.academics = acad.filter(a => a.isPublic);
    }

    /* Public life story entries */
    if (sections.includes('lifestory')) {
      const life = await LifeEntry.find({ userId:card.userId, isPublic:true }).sort({ date:-1 }).select('title category date content tags');
      payload.lifestory = life;
    }

    return { success:true, data:payload };
  });
};
