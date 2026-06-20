const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { JWT_SECRET = 'change-me', JWT_EXPIRES_IN = '7d' } = process.env;

const router = express.Router();

const trustIdSchema = new mongoose.Schema({
  id: String,
  level: { type: Number, default: 1 },
  score: { type: Number, default: 100 },
  status: { type: String, default: 'active' },
  issuedAt: { type: Date, default: Date.now },
}, { _id: false });

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'pending', 'suspended'], default: 'active' },
  trustId: { type: trustIdSchema, default: () => ({}) },
}, { timestamps: true });

const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrustUser', required: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, required: true, trim: true },
  category: { type: String, default: 'identity', trim: true },
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  isPrimary: { type: Boolean, default: false },
  rejectionReason: String,
}, { timestamps: true });

documentSchema.virtual('user', {
  ref: 'TrustUser',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});
documentSchema.set('toJSON', { virtuals: true });
documentSchema.set('toObject', { virtuals: true });

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrustUser', required: true },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, default: 'Other', trim: true },
  icon: { type: String, default: '💸' },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

const reminderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrustUser', required: true },
  title: { type: String, required: true, trim: true },
  dueDate: { type: Date, required: true },
  done: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
}, { timestamps: true });

const todoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrustUser', required: true },
  title: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  category: { type: String, default: 'General', trim: true },
}, { timestamps: true });

const TrustUser = mongoose.models.TrustUser || mongoose.model('TrustUser', userSchema);
const TrustDocument = mongoose.models.TrustDocument || mongoose.model('TrustDocument', documentSchema);
const TrustExpense = mongoose.models.TrustExpense || mongoose.model('TrustExpense', expenseSchema);
const TrustReminder = mongoose.models.TrustReminder || mongoose.model('TrustReminder', reminderSchema);
const TrustTodo = mongoose.models.TrustTodo || mongoose.model('TrustTodo', todoSchema);

function publicUser(user) {
  const doc = user.toObject ? user.toObject() : user;
  delete doc.passwordHash;
  return doc;
}

function makeTrustId(role) {
  const prefix = role === 'admin' ? 'ADMN' : Math.random().toString(36).slice(2, 6).toUpperCase();
  return {
    id: `TID-${new Date().getFullYear()}-${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    level: role === 'admin' ? 5 : 1,
    score: role === 'admin' ? 950 : 120,
    status: 'active',
    issuedAt: new Date(),
  };
}

function sign(user) {
  return jwt.sign({ id: user._id, role: user.role, app: 'trustid' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required.' });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await TrustUser.findById(payload.id);
    if (!user || user.status === 'suspended') return res.status(401).json({ message: 'Invalid session.' });
    req.trustUser = user;
    next();
  } catch (_err) {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function adminOnly(req, res, next) {
  if (req.trustUser.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' });
  next();
}

async function ensureAdmin() {
  const email = 'admin@trustid.com';
  const existing = await TrustUser.findOne({ email });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash('admin123', 10);
  return TrustUser.create({ firstName: 'Admin', lastName: 'User', email, passwordHash, role: 'admin', trustId: makeTrustId('admin') });
}

router.get('/health', (_req, res) => res.json({ success: true, app: 'trustid', status: 'ok' }));

router.post('/auth/seed-admin', async (_req, res, next) => {
  try {
    const admin = await ensureAdmin();
    res.status(201).json({ success: true, user: publicUser(admin), message: 'TrustID admin is ready. Default password is admin123.' });
  } catch (err) { next(err); }
});

router.post('/auth/register', async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) return res.status(400).json({ message: 'All fields are required.' });
    const exists = await TrustUser.findOne({ email: String(email).toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered.' });
    const user = await TrustUser.create({ firstName, lastName, email, passwordHash: await bcrypt.hash(password, 10), trustId: makeTrustId('user') });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (String(email).toLowerCase() === 'admin@trustid.com') await ensureAdmin();
    const user = await TrustUser.findOne({ email: String(email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password.' });
    if (user.status === 'suspended') return res.status(403).json({ message: 'Account suspended.' });
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.put('/auth/change-password', auth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!(await bcrypt.compare(currentPassword || '', req.trustUser.passwordHash))) return res.status(400).json({ message: 'Current password is incorrect.' });
    req.trustUser.passwordHash = await bcrypt.hash(newPassword, 10);
    await req.trustUser.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (err) { next(err); }
});

router.get('/documents', auth, async (req, res, next) => {
  try { res.json(await TrustDocument.find({ userId: req.trustUser._id }).sort({ createdAt: -1 })); } catch (err) { next(err); }
});

router.post('/documents', auth, async (req, res, next) => {
  try {
    const doc = await TrustDocument.create({ userId: req.trustUser._id, name: req.body.name || req.body.type, type: req.body.type, category: req.body.category || 'identity' });
    req.app.get('io')?.emit?.('trustid:document-created', doc);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.get('/documents/all', auth, adminOnly, async (_req, res, next) => {
  try { res.json(await TrustDocument.find().populate('user', 'firstName lastName email').sort({ createdAt: -1 })); } catch (err) { next(err); }
});

router.put('/documents/:id/verify', auth, adminOnly, async (req, res, next) => {
  try {
    const doc = await TrustDocument.findByIdAndUpdate(req.params.id, { status: 'verified', rejectionReason: undefined }, { new: true });
    res.json(doc);
  } catch (err) { next(err); }
});

router.put('/documents/:id/reject', auth, adminOnly, async (req, res, next) => {
  try {
    const doc = await TrustDocument.findByIdAndUpdate(req.params.id, { status: 'rejected', rejectionReason: req.body.reason || 'Rejected' }, { new: true });
    res.json(doc);
  } catch (err) { next(err); }
});

router.get('/expenses', auth, async (req, res, next) => {
  try { res.json(await TrustExpense.find({ userId: req.trustUser._id }).sort({ date: -1, createdAt: -1 })); } catch (err) { next(err); }
});

router.post('/expenses', auth, async (req, res, next) => {
  try { res.status(201).json(await TrustExpense.create({ userId: req.trustUser._id, ...req.body })); } catch (err) { next(err); }
});

router.delete('/expenses/:id', auth, async (req, res, next) => {
  try { await TrustExpense.deleteOne({ _id: req.params.id, userId: req.trustUser._id }); res.json({ success: true }); } catch (err) { next(err); }
});

router.get('/reminders', auth, async (req, res, next) => {
  try { res.json(await TrustReminder.find({ userId: req.trustUser._id }).sort({ dueDate: 1 })); } catch (err) { next(err); }
});

router.post('/reminders', auth, async (req, res, next) => {
  try { res.status(201).json(await TrustReminder.create({ userId: req.trustUser._id, ...req.body })); } catch (err) { next(err); }
});

router.put('/reminders/:id', auth, async (req, res, next) => {
  try { res.json(await TrustReminder.findOneAndUpdate({ _id: req.params.id, userId: req.trustUser._id }, req.body, { new: true })); } catch (err) { next(err); }
});

router.delete('/reminders/:id', auth, async (req, res, next) => {
  try { await TrustReminder.deleteOne({ _id: req.params.id, userId: req.trustUser._id }); res.json({ success: true }); } catch (err) { next(err); }
});

router.get('/todos', auth, async (req, res, next) => {
  try { res.json(await TrustTodo.find({ userId: req.trustUser._id }).sort({ createdAt: -1 })); } catch (err) { next(err); }
});

router.post('/todos', auth, async (req, res, next) => {
  try { res.status(201).json(await TrustTodo.create({ userId: req.trustUser._id, ...req.body })); } catch (err) { next(err); }
});

router.put('/todos/:id', auth, async (req, res, next) => {
  try { res.json(await TrustTodo.findOneAndUpdate({ _id: req.params.id, userId: req.trustUser._id }, req.body, { new: true })); } catch (err) { next(err); }
});

router.delete('/todos/:id', auth, async (req, res, next) => {
  try { await TrustTodo.deleteOne({ _id: req.params.id, userId: req.trustUser._id }); res.json({ success: true }); } catch (err) { next(err); }
});

router.get('/admin/users', auth, adminOnly, async (_req, res, next) => {
  try {
    const users = await TrustUser.aggregate([
      { $lookup: { from: 'trustdocuments', localField: '_id', foreignField: 'userId', as: 'docs' } },
      { $project: { passwordHash: 0, docs: 0, docsCount: { $size: '$docs' } } },
      { $sort: { createdAt: -1 } },
    ]);
    res.json(users);
  } catch (err) { next(err); }
});

router.get('/admin/stats', auth, adminOnly, async (_req, res, next) => {
  try {
    const [totalUsers, activeTrustIds, verifiedDocs, pendingReviews] = await Promise.all([
      TrustUser.countDocuments(),
      TrustUser.countDocuments({ 'trustId.status': 'active' }),
      TrustDocument.countDocuments({ status: 'verified' }),
      TrustDocument.countDocuments({ status: 'pending' }),
    ]);
    res.json({
      totalUsers,
      activeTrustIds,
      verifiedDocs,
      pendingReviews,
      growth: [
        { m: 'Jan', users: 0, docs: 0 },
        { m: 'Feb', users: 0, docs: 0 },
        { m: 'Mar', users: 0, docs: 0 },
        { m: 'Apr', users: 0, docs: 0 },
        { m: 'May', users: Math.max(0, totalUsers - 1), docs: Math.max(0, verifiedDocs - pendingReviews) },
        { m: 'Jun', users: totalUsers, docs: verifiedDocs + pendingReviews },
      ],
    });
  } catch (err) { next(err); }
});

router.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'TrustID API error.' });
});

module.exports = router;
