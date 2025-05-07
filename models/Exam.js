const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  questions: [{
    type: {
      type: String,
      enum: ['mcq', 'direct'],
      required: true
    },
    statement: {
      type: String,
      required: true
    },
    score: {
      type: Number,
      required: true,
      min: 0
    },
    duration: {
      type: Number,
      required: true,
      min: 1
    },
    media: {
      type: {
        type: String,
        enum: ['image', 'audio', 'video', 'none'],
        default: 'none'
      },
      url: String
    },
    options: [{
      text: String,
      isCorrect: Boolean
    }],
    answer: String,
    toleranceRate: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Exam', examSchema);
