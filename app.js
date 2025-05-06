const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const path = require('path');
const flash = require('connect-flash');
const multer = require('multer');
const csrf = require('csurf');
const fs = require('fs');
require('dotenv').config();

// Import routes and models
const authRoutes = require('./routes/auth');
const Exam = require('./models/Exam');
c
const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/examsonline', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Set the correct views directory
app.set('views', path.join(__dirname, 'Evalio', 'config', 'routes', 'controllers', 'views'));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Flash messages
app.use(flash());

// CSRF protection
app.use(csrf());
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Session configuration
// Session configuration with secure settings
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/examsonline',
    ttl: 24 * 60 * 60 // Session TTL (1 day)
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// Authentication middleware
const authMiddleware = (req, res, next) => {
  // Add user and flash messages to locals for all templates
  res.locals.user = req.session.user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
};

app.use(authMiddleware);

// Routes
app.use('/auth', authRoutes);

// Public routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.userType === 'student' ? '/student/dashboard' : '/teacher/dashboard');
  }
  res.render('register');
});

app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.userType === 'student' ? '/student/dashboard' : '/teacher/dashboard');
  }
  res.render('login');
});

// Protected route middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Protected routes
// Student dashboard route
app.get('/student/dashboard', requireAuth, (req, res) => {
  if (req.session.user.userType !== 'student') {
    return res.status(403).render('error', { error: 'Accès non autorisé' });
  }
  res.render('student/dashboard');
});

// Teacher dashboard route
app.get('/teacher/dashboard', requireAuth, (req, res) => {
  if (req.session.user.userType !== 'teacher') {
    return res.status(403).render('error', { error: 'Accès non autorisé' });
  }
  res.render('teacher/dashboard');
});

// Exam creation routes
app.get('/teacher/exams/create', requireAuth, (req, res) => {
  if (req.session.user.userType !== 'teacher') {
    return res.status(403).render('error', { error: 'Accès non autorisé' });
  }
  res.render('teacher/createExam');
});

// Ensure uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File type validation
const allowedTypes = {
  'image': ['image/jpeg', 'image/png', 'image/gif'],
  'audio': ['audio/mpeg', 'audio/wav'],
  'video': ['video/mp4', 'video/webm']
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const mediaType = req.body.mediaType;
    if (!mediaType || !allowedTypes[mediaType]) {
      cb(new Error('Type de média non valide'));
      return;
    }
    
    if (!allowedTypes[mediaType].includes(file.mimetype)) {
      cb(new Error('Type de fichier non supporté'));
      return;
    }
    
    cb(null, true);
  }
});

// Create exam
app.post('/teacher/exams/create', requireAuth, async (req, res) => {
  if (req.session.user.userType !== 'teacher') {
    return res.status(403).render('error', { error: 'Accès non autorisé' });
  }
  
  try {
    const examData = {
      ...req.body,
      teacher: req.session.user._id,
      duration: parseInt(req.body.duration),
      passingScore: parseInt(req.body.passingScore),
      maxAttempts: parseInt(req.body.maxAttempts),
      shuffleQuestions: !!req.body.shuffleQuestions,
      showResults: !!req.body.showResults,
      targetAudience: {
        year: req.body.targetAudience.year,
        semester: req.body.targetAudience.semester,
        group: req.body.targetAudience.group
      }
    };

    const exam = new Exam(examData);
    await exam.save();

    req.flash('success', 'Examen créé avec succès');
    res.redirect(`/teacher/exams/${exam._id}/questions`);
  } catch (error) {
    console.error('Error creating exam:', error);
    req.flash('error', 'Erreur lors de la création de l\'examen');
    res.redirect('/teacher/exams/create');
  }
});

// Edit exam questions page
app.get('/teacher/exams/:examId/questions', requireAuth, async (req, res) => {
  if (req.session.user.userType !== 'teacher') {
    return res.status(403).render('error', { error: 'Accès non autorisé' });
  }

  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) {
      req.flash('error', 'Examen non trouvé');
      return res.redirect('/teacher/dashboard');
    }

    if (exam.teacher.toString() !== req.session.user._id.toString()) {
      return res.status(403).render('error', { error: 'Accès non autorisé' });
    }

    res.render('teacher/editExamQuestions', { exam });
  } catch (error) {
    console.error('Error getting exam:', error);
    req.flash('error', 'Erreur lors du chargement de l\'examen');
    res.redirect('/teacher/dashboard');
  }
});

// Add question to exam
app.post('/teacher/exams/:examId/questions', requireAuth, upload.single('media'), async (req, res) => {
  if (req.session.user.userType !== 'teacher') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }

  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam || exam.teacher.toString() !== req.session.user._id.toString()) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const questionData = {
      type: req.body.type,
      statement: req.body.statement,
      score: parseInt(req.body.score),
      duration: parseInt(req.body.duration),
      media: {
        type: req.body.mediaType || 'none',
        url: req.file ? `/uploads/${req.file.filename}` : undefined
      }
    };

    if (req.body.type === 'direct') {
      questionData.answer = req.body.answer;
      questionData.toleranceRate = parseInt(req.body.toleranceRate);
    } else if (req.body.type === 'mcq') {
      questionData.options = JSON.parse(req.body.options);
    }

    exam.questions.push(questionData);
    await exam.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la question' });
  }
});

// Update question
app.put('/teacher/exams/:examId/questions/:questionIndex', requireAuth, upload.single('media'), async (req, res) => {
  if (req.session.user.userType !== 'teacher') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }

  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam || exam.teacher.toString() !== req.session.user._id.toString()) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const questionIndex = parseInt(req.params.questionIndex);
    if (questionIndex < 0 || questionIndex >= exam.questions.length) {
      return res.status(404).json({ error: 'Question non trouvée' });
    }

    const questionData = {
      type: req.body.type,
      statement: req.body.statement,
      score: parseInt(req.body.score),
      duration: parseInt(req.body.duration),
      media: {
        type: req.body.mediaType || exam.questions[questionIndex].media.type,
        url: req.file ? `/uploads/${req.file.filename}` : exam.questions[questionIndex].media.url
      }
    };

    if (req.body.type === 'direct') {
      questionData.answer = req.body.answer;
      questionData.toleranceRate = parseInt(req.body.toleranceRate);
    } else if (req.body.type === 'mcq') {
      questionData.options = JSON.parse(req.body.options);
    }

    exam.questions[questionIndex] = questionData;
    await exam.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Erreur lors de la modification de la question' });
  }
});

// Delete question
app.delete('/teacher/exams/:examId/questions/:questionIndex', requireAuth, async (req, res) => {
  if (req.session.user.userType !== 'teacher') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }

  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam || exam.teacher.toString() !== req.session.user._id.toString()) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const questionIndex = parseInt(req.params.questionIndex);
    if (questionIndex < 0 || questionIndex >= exam.questions.length) {
      return res.status(404).json({ error: 'Question non trouvée' });
    }

    exam.questions.splice(questionIndex, 1);
    await exam.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la question' });
  }
});

// Multer error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Le fichier est trop volumineux (max 10MB)' });
    }
    return res.status(400).json({ error: 'Erreur lors du téléchargement du fichier' });
  }
  next(err);
});

// CSRF error handling
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Session expirée, veuillez rafraîchir la page' });
  }
  next(err);
});

// General error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (req.xhr || req.headers.accept.includes('application/json')) {
    res.status(500).json({ error: 'Une erreur est survenue' });
  } else {
    res.status(500).render('error', { 
      error: 'Une erreur est survenue'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { 
    error: 'Page introuvable'
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
