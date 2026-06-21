const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { Schema } = mongoose;
const OID = Schema.Types.ObjectId;

/* ── User ── */
const userSchema = new Schema({
  firstName:    { type: String, required: true, trim: true },
  middleName:   { type: String, default: '', trim: true },
  lastName:     { type: String, default: '', trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['user', 'admin'], default: 'user' },
  status:       { type: String, enum: ['active', 'pending', 'suspended'], default: 'active' },
  trustId: {
    id: String, level: { type: Number, default: 1, min: 1, max: 5 },
    score: { type: Number, default: 100 }, status: { type: String, default: 'active' },
    issuedAt: { type: Date, default: Date.now },
  },
  vaultPinHash: { type: String, default: null },
  homeAddress: {
    street: String, city: String, state: String,
    country: String, postalCode: String,
    lat: Number, lng: Number,
  },
  bio:          { type: String, default: '' },
  lastActivity: { type: Date, default: Date.now },
  joinedAt:     { type: Date, default: Date.now },
}, { timestamps: true });

userSchema.methods.checkPassword  = function (p) { return bcrypt.compare(p, this.passwordHash); };
userSchema.methods.checkVaultPin  = function (p) { return this.vaultPinHash ? bcrypt.compare(p, this.vaultPinHash) : false; };
userSchema.methods.safeUser       = function () { const o = this.toObject(); delete o.passwordHash; delete o.vaultPinHash; return o; };

/* ── Document ── */
const documentSchema = new Schema({
  userId: { type: OID, ref: 'pvusers', required: true },
  name: { type: String, required: true }, type: { type: String, required: true },
  category: { type: String, enum: ['identity','financial','address','other'], default: 'other' },
  status: { type: String, enum: ['pending','verified','rejected'], default: 'pending' },
  isPrimary: { type: Boolean, default: false }, rejectionReason: String,
}, { timestamps: true });

/* ── Academic ── */
const academicSchema = new Schema({
  userId:      { type: OID, ref: 'pvusers', required: true },
  title:       { type: String, required: true },
  type:        { type: String, enum: ['certificate','transcript','award','degree','diploma','course','other'], default: 'certificate' },
  institution: { type: String, default: '' },
  year:        Number,
  grade:       { type: String, default: '' },
  description: { type: String, default: '' },
  isPublic:    { type: Boolean, default: false },
}, { timestamps: true });

/* ── Life Story Entry ── */
const lifeSchema = new Schema({
  userId:    { type: OID, ref: 'pvusers', required: true },
  category:  { type: String, enum: ['education','career','family','health','travel','hobby','achievement','milestone','other'], default: 'milestone' },
  title:     { type: String, required: true },
  content:   { type: String, default: '' },
  date:      { type: Date, default: Date.now },
  isPublic:  { type: Boolean, default: false },
  tags:      [String],
}, { timestamps: true });

/* ── Vault Item ── */
const vaultSchema = new Schema({
  userId:  { type: OID, ref: 'pvusers', required: true },
  type:    { type: String, enum: ['note','photo','video'], default: 'note' },
  title:   { type: String, required: true },
  content: { type: String, default: '' },   // text notes or file description
  tags:    [String],
}, { timestamps: true });

/* ── Expense ── */
const expenseSchema = new Schema({
  userId: { type: OID, ref: 'pvusers', required: true },
  title: { type: String, required: true }, amount: { type: Number, required: true },
  category: { type: String, default: 'Other' }, icon: String, date: { type: Date, default: Date.now },
}, { timestamps: true });

/* ── Reminder ── */
const reminderSchema = new Schema({
  userId: { type: OID, ref: 'pvusers', required: true },
  title: { type: String, required: true }, dueDate: Date,
  done: { type: Boolean, default: false },
  priority: { type: String, enum: ['low','medium','high'], default: 'medium' },
}, { timestamps: true });

/* ── Todo ── */
const todoSchema = new Schema({
  userId: { type: OID, ref: 'pvusers', required: true },
  title: { type: String, required: true }, done: { type: Boolean, default: false },
  priority: { type: String, enum: ['low','medium','high'], default: 'medium' },
  category: { type: String, default: 'General' },
}, { timestamps: true });

/* ── Digital Legacy (Dead Man's Switch) ── */
const legacySchema = new Schema({
  userId:         { type: OID, ref: 'pvusers', required: true, unique: true },
  messageTitle:   { type: String, default: 'My Final Message' },
  message:        { type: String, default: '' },
  discloseTo:     { type: String, default: '' },   /* email/name to receive msg */
  contacts: [{                                      /* up to 3 emergency contacts */
    name: String, email: String, phone: String, order: { type: Number },
  }],
  status: {
    type: String,
    enum: ['active','prompted','admin_notified','disclosed','cancelled'],
    default: 'active',
  },
  promptCount:    { type: Number, default: 0 },
  lastPromptSent: Date,
  adminNotifiedAt:Date,
  disclosedAt:    Date,
}, { timestamps: true });

module.exports = {
  User:      mongoose.model('pvusers',     userSchema),
  Document:  mongoose.model('pvdocuments', documentSchema),
  Academic:  mongoose.model('pvacademics', academicSchema),
  LifeEntry: mongoose.model('pvlife',      lifeSchema),
  VaultItem: mongoose.model('pvvault',     vaultSchema),
  Legacy:    mongoose.model('pvlegacy',    legacySchema),
  Expense:   mongoose.model('pvexpenses',  expenseSchema),
  Reminder:  mongoose.model('pvreminders', reminderSchema),
  Todo:      mongoose.model('pvtodos',     todoSchema),
};
