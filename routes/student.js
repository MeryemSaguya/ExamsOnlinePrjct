const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const User = require('../models/User');
const { isAuthenticated, isStudent } = require('../middleware/auth');

// Student Dashboard
router.get('/dashboard', isAuthenticated, isStudent, async (req, res) => {
  try {
    const availableExams = await Exam.find({
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    });

    const examHistory = await Exam.find({
      'submissions.studentId': req.session.user.id
    }).select('title subject submissions');

    res.render('student/dashboard', {
      user: req.session.user,
      availableExams,
      examHistory: examHistory.map(exam => ({
        ...exam.toObject(),
        score: exam.submissions.find(s => s.studentId.toString() === req.session.user.id)?.score || 0,
        completedDate: exam.submissions.find(s => s.studentId.toString() === req.session.user.id)?.submittedAt,
        status: exam.submissions.find(s => s.studentId.toString() === req.session.user.id)?.status || 'Non commencé'
      }))
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { error: 'Une erreur est survenue' });
  }
});

// View available exams
router.get('/exams', (req, res) => {
  res.render('student/exams', {
    title: 'Examens disponibles',
    user: req.session.user
  });
});

// Take an exam
router.get('/exams/:examId', (req, res) => {
  res.render('student/take-exam', {
    title: 'Passer l\'examen',
    user: req.session.user,
    examId: req.params.examId
  });
});

// Exam Access Page
router.get('/exam/:examId', isAuthenticated, isStudent, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) {
      return res.status(404).render('error', { error: 'Examen non trouvé' });
    }

    // Check if exam is available
    const now = new Date();
    if (now < exam.startDate || now > exam.endDate) {
      return res.status(403).render('error', { error: 'Cet examen n\'est pas disponible actuellement' });
    }

    // Check if student has already started/completed the exam
    const submission = exam.submissions.find(s => s.studentId.toString() === req.session.user.id);
    if (submission && submission.status === 'completed') {
      return res.redirect(`/student/exam/${exam._id}/results`);
    }

    res.render('student/exam-access', {
      user: req.session.user,
      exam
    });
  } catch (error) {
    console.error('Exam access error:', error);
    res.status(500).render('error', { error: 'Une erreur est survenue' });
  }
});

// Start Exam
router.get('/exam/:examId/start', isAuthenticated, isStudent, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) {
      return res.status(404).render('error', { error: 'Examen non trouvé' });
    }

    // Check if exam is available
    const now = new Date();
    if (now < exam.startDate || now > exam.endDate) {
      return res.status(403).render('error', { error: 'Cet examen n\'est pas disponible actuellement' });
    }

    // Check if student has already started/completed the exam
    const submission = exam.submissions.find(s => s.studentId.toString() === req.session.user.id);
    if (submission && submission.status === 'completed') {
      return res.redirect(`/student/exam/${exam._id}/results`);
    }

    // If no submission exists, create one
    if (!submission) {
      exam.submissions.push({
        studentId: req.session.user.id,
        status: 'in_progress',
        startedAt: new Date(),
        answers: []
      });
      await exam.save();
    }

    res.redirect(`/student/exam/${exam._id}/question/0`);
  } catch (error) {
    console.error('Start exam error:', error);
    res.status(500).render('error', { error: 'Une erreur est survenue' });
  }
});

// Get Question
router.get('/exam/:examId/question/:questionIndex', isAuthenticated, isStudent, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) {
      return res.status(404).render('error', { error: 'Examen non trouvé' });
    }

    const questionIndex = parseInt(req.params.questionIndex);
    if (questionIndex < 0 || questionIndex >= exam.questions.length) {
      return res.status(404).render('error', { error: 'Question non trouvée' });
    }

    const submission = exam.submissions.find(s => s.studentId.toString() === req.session.user.id);
    if (!submission || submission.status === 'completed') {
      return res.redirect(`/student/exam/${exam._id}`);
    }

    const currentQuestion = exam.questions[questionIndex];
    const selectedAnswer = submission.answers.find(a => a.questionId.toString() === currentQuestion._id.toString())?.answer;

    // Ensure all required data is passed to the template
    res.render('student/exam-question', {
      user: req.session.user,
      exam,
      examId: exam._id,
      currentQuestion: {
        _id: currentQuestion._id,
        question: currentQuestion.question,
        options: currentQuestion.options
      },
      currentQuestionIndex: questionIndex,
      totalQuestions: exam.questions.length,
      selectedAnswer,
      examDuration: exam.duration
    });
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).render('error', { error: 'Une erreur est survenue' });
  }
});

// Save Answer
router.post('/exam/:examId/answer', isAuthenticated, isStudent, async (req, res) => {
  try {
    const { questionId, answer } = req.body;
    const exam = await Exam.findById(req.params.examId);
    
    if (!exam) {
      return res.status(404).json({ error: 'Examen non trouvé' });
    }

    const submission = exam.submissions.find(s => s.studentId.toString() === req.session.user.id);
    if (!submission || submission.status === 'completed') {
      return res.status(403).json({ error: 'Examen non disponible' });
    }

    // Update or add answer
    const answerIndex = submission.answers.findIndex(a => a.questionId.toString() === questionId);
    if (answerIndex >= 0) {
      submission.answers[answerIndex].answer = answer;
    } else {
      submission.answers.push({ questionId, answer });
    }

    await exam.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Save answer error:', error);
    res.status(500).json({ error: 'Une erreur est survenue' });
  }
});

// Submit Exam
router.post('/exam/:examId/submit', isAuthenticated, isStudent, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) {
      return res.status(404).json({ error: 'Examen non trouvé' });
    }

    const submission = exam.submissions.find(s => s.studentId.toString() === req.session.user.id);
    if (!submission || submission.status === 'completed') {
      return res.status(403).json({ error: 'Examen non disponible' });
    }

    // Calculate score
    let correctAnswers = 0;
    exam.questions.forEach(question => {
      const answer = submission.answers.find(a => a.questionId.toString() === question._id.toString());
      if (answer && answer.answer === question.correctAnswer) {
        correctAnswers++;
      }
    });

    const score = Math.round((correctAnswers / exam.questions.length) * 100);

    // Update submission
    submission.status = 'completed';
    submission.submittedAt = new Date();
    submission.score = score;

    await exam.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({ error: 'Une erreur est survenue' });
  }
});

// Exam Results
router.get('/exam/:examId/results', isAuthenticated, isStudent, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) {
      return res.status(404).render('error', { error: 'Examen non trouvé' });
    }

    const submission = exam.submissions.find(s => s.studentId.toString() === req.session.user.id);
    if (!submission || submission.status !== 'completed') {
      return res.redirect(`/student/exam/${exam._id}`);
    }

    // Prepare questions with user answers and correctness
    const questions = exam.questions.map(question => {
      const answer = submission.answers.find(a => a.questionId.toString() === question._id.toString());
      return {
        ...question.toObject(),
        userAnswer: answer?.answer,
        isCorrect: answer?.answer === question.correctAnswer
      };
    });

    res.render('student/exam-results', {
      user: req.session.user,
      exam,
      score: submission.score,
      answeredQuestions: submission.answers.length,
      totalQuestions: exam.questions.length,
      correctAnswers: questions.filter(q => q.isCorrect).length,
      timeUsed: Math.round((submission.submittedAt - submission.startedAt) / (1000 * 60)),
      questions
    });
  } catch (error) {
    console.error('Exam results error:', error);
    res.status(500).render('error', { error: 'Une erreur est survenue' });
  }
});

module.exports = router; 