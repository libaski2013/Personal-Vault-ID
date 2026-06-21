const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/* ── User ── */
const userSchema = new mongoose.Schema({
  firstName:    { type: String, required: true, trim: true },
  lastName:     { type: String, default: '', trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['user', 'admin'], default: 'user' },
  status:       { type: String, enum: ['active', 'pending', 'suspended'], default: 'active' },
  trustId: {
    id:       String,
    level:    { type: Number, default: 1, min: 1, max: 5 },
    score:    { type: Number, default: 100 },
    status:   { type: String, default: 'active' },
    issuedAt: { type: Date, default: Date.now },
  },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

userSchema.methods.checkPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.safeUser = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

/* ── Document ── */
const documentSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'trustusers', required: true },
  name:            { type: String, required: true },
  type:            { type: String, required: true },
  category:        { type: String, enum: ['identity', 'financial', 'address', 'other'], default: 'other' },
  status:          { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  isPrimary:       { type: Boolean, default: false },
  rejectionReason: String,
}, { timestamps: true });

/* ── Expense ── */
const expenseSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'trustusers', required: true },
  title:    { type: String, required: true },
  amount:   { type: Number, required: true },
  category: { type: String, default: 'Other' },
  icon:     String,
  date:     { type: Date, default: Date.now },
}, { timestamps: true });

/* ── Reminder ── */
const reminderSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'trustusers', required: true },
  title:    { type: String, required: true },
  dueDate:  Date,
  done:     { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
}, { timestamps: true });

/* ── Todo ── */
const todoSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'trustusers', required: true },
  title:    { type: String, required: true },
  done:     { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  category: { type: String, default: 'General' },
}, { timestamps: true });

module.exports = {
  User:     mongoose.model('trustusers',     userSchema),
  Document: mongoose.model('trustdocuments', documentSchema),
  Expense:  mongoose.model('trustexpenses',  expenseSchema),
  Reminder: mongoose.model('trustreminders', reminderSchema),
  Todo:     mongoose.model('trusttodos',     todoSchema),
};
