const { ContactCard, SavedContact } = require('../db/models');

function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PVC';
  for (let i = 0; i < 6; i++) code += c[Math.floor(Math.random() * c.length)];
  return code;
}

module.exports = async function cardRoutes(fastify) {

  /* GET /api/trustid/cards — get my card */
  fastify.get('/', { onRequest:[fastify.authenticate] }, async (req) => {
    let card = await ContactCard.findOne({ userId:req.user.userId });
    return { success:true, data:card||null };
  });

  /* PUT /api/trustid/cards — create or update my card */
  fastify.put('/', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const body = req.body||{};
    /* Generate shareCode if first save */
    let shareCode = body.shareCode;
    if (!shareCode) {
      let code, tries=0;
      do { code=genCode(); tries++; } while (tries<10 && await ContactCard.findOne({shareCode:code}));
      shareCode = code;
    }
    const card = await ContactCard.findOneAndUpdate(
      { userId:req.user.userId },
      { $set:{ ...body, userId:req.user.userId, shareCode } },
      { upsert:true, new:true }
    );
    return { success:true, data:card };
  });

  /* GET /api/trustid/cards/view/:code — PUBLIC: view a card by shareCode */
  fastify.get('/view/:code', async (req, reply) => {
    const card = await ContactCard.findOne({ shareCode:req.params.code, isPublic:true });
    if (!card) return reply.code(404).send({ success:false, message:'Card not found or private' });
    /* Apply privacy filters */
    const p = card.privacy||{};
    const pub = card.toObject();
    if (p.showPhoto===false)    { delete pub.photo; }
    if (p.showLogo===false)     { delete pub.logo; }
    if (p.showBio===false)      { delete pub.bio; }
    if (p.showPhones===false)   { pub.phones=[]; }
    if (p.showWhatsapp===false) { delete pub.whatsapp; }
    if (p.showEmail===false)    { delete pub.email; }
    if (p.showWebsite===false)  { delete pub.website; }
    if (p.showLocation===false) { delete pub.location; }
    if (p.showSocials===false)  { delete pub.socials; }
    if (p.showServices===false) { pub.services=[]; }
    return { success:true, data:pub };
  });

  /* POST /api/trustid/cards/save — save a scanned card to my contacts */
  fastify.post('/save', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    const { shareCode, notes } = req.body||{};
    const card = await ContactCard.findOne({ shareCode, isPublic:true });
    if (!card) return reply.code(404).send({ success:false, message:'Card not found' });
    const saved = await SavedContact.findOneAndUpdate(
      { userId:req.user.userId, 'cardData.shareCode':shareCode },
      { $set:{ userId:req.user.userId, cardData:card.toObject(), notes:notes||'', scannedAt:new Date() } },
      { upsert:true, new:true }
    );
    return reply.code(201).send({ success:true, data:saved });
  });

  /* GET /api/trustid/cards/contacts — list my saved contacts */
  fastify.get('/contacts', { onRequest:[fastify.authenticate] }, async (req) => {
    const contacts = await SavedContact.find({ userId:req.user.userId }).sort({ scannedAt:-1 });
    return { success:true, data:contacts };
  });

  /* DELETE /api/trustid/cards/contacts/:id */
  fastify.delete('/contacts/:id', { onRequest:[fastify.authenticate] }, async (req, reply) => {
    await SavedContact.findOneAndDelete({ _id:req.params.id, userId:req.user.userId });
    return { success:true };
  });
};
