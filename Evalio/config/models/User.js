const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userType: {
    type: String,
    enum: ['student', 'teacher'],
    required: true
  },
  gender: {
    type: String,
    enum: ['F', 'M', 'O'],
    required: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  birthDate: {
    type: Date,
    required: true
  },
  school: {
    type: String,
    required: true,
    trim: true
  },
  major: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
