const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { Schema } = mongoose;
const OID = Schema.Types.ObjectId;

/* ── User ── */
const userSchema = new Schema({
  firstName:    { type: String, required: true, trim: true },
  middleName:   { type: String, default: '', trim: true },
  lastName:     { type: String, default: '', trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  profilePhoto: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['user', 'admin'], default: 'user' },
  status:       { type: String, enum: ['active', 'pending', 'suspended'], default: 'active' },
  trustId: {
    id: String, level: { type: Number, default: 1, min: 1, max: 5 },
    score: { type: Number, default: 100 }, status: { type: String, default: 'active' },
    issuedAt: { type: Date, default: Date.now },
  },
  phone:        { type: String, default: '', trim: true },
  tier:         { type: String, enum: ['free','paid','premium'], default: 'free' },
  notes:        { type: String, default: '' },   /* admin notes on this user */
  vaultPinHash: { type: String, default: null },
  homeAddress: {
    label: String, street: String, city: String, state: String,
    country: String, postalCode: String, lat: Number, lng: Number,
    mapUrl: String,
  },
  previousAddresses: [{
    label: { type: String, default: 'Previous Address' },
    street: String, city: String, state: String,
    country: String, postalCode: String,
    lat: Number, lng: Number,
    mapUrl: String,
    livedFrom: String,
    livedTo: String,
  }],
  socialHandles: {
    whatsapp: String, facebook: String, instagram: String, x: String,
    linkedin: String, tiktok: String, snapchat: String, website: String,
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

/* ── Chat ── */
const conversationSchema = new Schema({
  participants:  [{ type: OID, ref: 'pvusers' }],
  lastMessage:   { type: String, default: '' },
  lastSenderId:  { type: OID, ref: 'pvusers' },
  lastActivity:  { type: Date, default: Date.now },
  unreadCounts:  { type: Map, of: Number, default: {} },   /* userId → count */
}, { timestamps: true });

const messageSchema = new Schema({
  conversationId: { type: OID, ref: 'pvconversations', required: true },
  from:  { type: OID, ref: 'pvusers', required: true },
  to:    { type: OID, ref: 'pvusers', required: true },
  text:  { type: String, required: true, trim: true },
  read:  { type: Boolean, default: false },
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

/* ── Digital Contact Card ── */
const contactCardSchema = new Schema({
  userId:       { type: OID, ref:'pvusers', required:true },
  shareCode:    { type: String, unique:true, sparse:true },
  /* Visuals */
  photo:        String,   /* base64 passport photo */
  logo:         String,   /* base64 company logo */
  theme:        { type: String, default:'professional' },
  /* Identity */
  fullName:     { type: String, default:'' },
  businessName: { type: String, default:'' },
  jobTitle:     { type: String, default:'' },
  bio:          { type: String, default:'' },
  services:     [String],
  /* Contact */
  phones:       [{ label:String, number:String }],
  whatsapp:     { type: String, default:'' },
  email:        { type: String, default:'' },
  website:      { type: String, default:'' },
  location:     { address:String, city:String, country:String },
  /* Social media */
  socials: {
    linkedin:String, twitter:String, instagram:String, facebook:String,
    tiktok:String, youtube:String, github:String, telegram:String, snapchat:String,
  },
  /* Privacy — what to show when sharing publicly */
  privacy: {
    showPhoto:Boolean, showLogo:Boolean, showBio:Boolean, showPhones:Boolean,
    showWhatsapp:Boolean, showEmail:Boolean, showWebsite:Boolean,
    showLocation:Boolean, showSocials:Boolean, showServices:Boolean,
  },
  isPublic: { type: Boolean, default:true },
}, { timestamps:true });

/* ── Saved (scanned) Contacts ── */
const savedContactSchema = new Schema({
  userId:   { type: OID, ref:'pvusers', required:true },
  cardData: { type: Object },   /* snapshot of the card at scan time */
  notes:    { type: String, default:'' },
  scannedAt:{ type: Date, default: Date.now },
}, { timestamps:true });

/* ── Activity Log / Audit Trail ── */
const activitySchema = new Schema({
  userId:    { type: OID, ref: 'pvusers' },
  action:    { type: String, required: true },   /* 'login', 'register', 'doc_upload', etc. */
  resource:  { type: String, default: '' },
  details:   { type: String, default: '' },
  ip:        { type: String, default: '' },
  userAgent: { type: String, default: '' },
  level:     { type: String, enum: ['info','warn','error'], default: 'info' },
}, { timestamps: true });

/* ── Feature Flags (admin-controlled per tier) ── */
const featureSchema = new Schema({
  name:        { type: String, required: true, unique: true },
  label:       { type: String, required: true },
  icon:        { type: String, default: '⚙️' },
  description: { type: String, default: '' },
  href:        { type: String, default: '' },
  enabled:     { type: Boolean, default: true },
  tiers:       [{ type: String, enum: ['free','paid','premium'] }],
}, { timestamps: true });

/* ── Vault Share Card ── */
const shareSchema = new Schema({
  userId:        { type: OID, ref: 'pvusers', required: true },
  shareCode:     { type: String, unique: true, required: true },
  title:         { type: String, default: 'My Personal Vault' },
  customMessage: { type: String, default: '' },
  sections:      [{ type: String }],   /* identity, documents, academics, lifestory, address, contact */
  isActive:      { type: Boolean, default: true },
  expiresAt:     { type: Date, default: null },
  viewCount:     { type: Number, default: 0 },
}, { timestamps: true });

/* Anonymous proximity social network */
const socialSessionSchema = new Schema({
  userId:     { type: OID, ref: 'pvusers', required: true, index: true },
  token:      { type: String, unique: true, required: true },
  alias:      { type: String, required: true },
  zone:       { type: String, default: 'nearby', index: true },
  isActive:   { type: Boolean, default: true },
  blocked:    [{ type: OID, ref: 'pvusers' }],
  expiresAt:  { type: Date, required: true, index: true },
}, { timestamps: true });

const anonChatSchema = new Schema({
  participants: [{ type: OID, ref: 'pvusers', required: true }],
  participantTokens: [{ type: String }],
  messages: [{
    senderId: { type: OID, ref: 'pvusers' },
    text: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  }],
  reports: [{
    reporterId: { type: OID, ref: 'pvusers' },
    reason: String,
    createdAt: { type: Date, default: Date.now },
  }],
  isDisconnected: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

module.exports = {
  User:         mongoose.model('pvusers',         userSchema),
  ContactCard:  mongoose.model('pvcontactcards',  contactCardSchema),
  SavedContact: mongoose.model('pvsavedcontacts', savedContactSchema),
  Activity:     mongoose.model('pvactivity',      activitySchema),
  Feature:      mongoose.model('pvfeatures',      featureSchema),
  Conversation: mongoose.model('pvconversations', conversationSchema),
  Message:      mongoose.model('pvmessages',      messageSchema),
  ShareCard:    mongoose.model('pvsharecards',    shareSchema),
  SocialSession: mongoose.model('pvsocialsessions', socialSessionSchema),
  AnonChat:  mongoose.model('pvanonchats', anonChatSchema),
  Document:  mongoose.model('pvdocuments', documentSchema),
  Academic:  mongoose.model('pvacademics', academicSchema),
  LifeEntry: mongoose.model('pvlife',      lifeSchema),
  VaultItem: mongoose.model('pvvault',     vaultSchema),
  Legacy:    mongoose.model('pvlegacy',    legacySchema),
  Expense:   mongoose.model('pvexpenses',  expenseSchema),
  Reminder:  mongoose.model('pvreminders', reminderSchema),
  Todo:      mongoose.model('pvtodos',     todoSchema),
};
