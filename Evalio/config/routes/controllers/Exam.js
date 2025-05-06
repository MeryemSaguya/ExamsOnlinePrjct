const mongoose = require('mongoose');
const crypto = require('crypto');

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'mcq'],
    required: true
  },
  statement: {
    type: String,
    required: true
  },
  media: {
    type: {
      type: String,
      enum: ['image', 'audio', 'video', 'none'],
      default: 'none'
    },
    url: String
  },
  answer: {
    type: String,
    required: true
  },
  toleranceRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  options: [{
    text: String,
    isCorrect: Boolean
  }],
  score: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  }
});

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  targetAudience: {
    year: {
      type: String,
      required: true
    },
    semester: {
      type: String,
      required: true
    },
    group: String
  },
  accessLink: {
    type: String,
    unique: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 15
  },
  passingScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  maxAttempts: {
    type: Number,
    required: true,
    min: 1
  },
  shuffleQuestions: {
    type: Boolean,
    default: false
  },
  showResults: {
    type: Boolean,
    default: false
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  questions: [questionSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate unique access link before saving
examSchema.pre('save', function(next) {
  if (!this.accessLink) {
    // Generate a unique 8-character code
    this.accessLink = crypto.randomBytes(4).toString('hex');
  }
  this.updatedAt = new Date();
  next();
});

// Virtual for full access URL
examSchema.virtual('accessUrl').get(function() {
  return `${process.env.BASE_URL || 'http://localhost:3000'}/exam/${this.accessLink}`;
});

const Exam = mongoose.model('Exam', examSchema);

module.exports = Exam;

