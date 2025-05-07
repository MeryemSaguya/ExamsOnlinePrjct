const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const path = require('path');
const flash = require('connect-flash');
const multer = require('multer');
const csrf = require('csurf');
const fs = require('fs');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

// Import routes and models
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const Exam = require('./models/Exam');
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

// Set view engine and layouts
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Set the correct views directory
app.set('views', path.join(__dirname, 'views'));

// Debug middleware
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Static files - serve these first
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/examsonline',
    ttl: 24 * 60 * 60 // 1 day
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// Flash messages
app.use(flash());

// Authentication middleware
const authMiddleware = (req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
};

app.use(authMiddleware);

// Protected route middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Routes
app.use('/auth', authRoutes);
app.use('/student', studentRoutes);

// Public routes
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Evalio | Plateforme d\'examens en ligne',
    user: req.session.user || null,
    error: req.flash('error'),
    success: req.flash('success')
  });
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

// Protected routes
app.get('/student/dashboard', requireAuth, (req, res) => {
  if (req.session.user.userType !== 'student') {
    return res.status(403).render('error', { error: 'Accès non autorisé' });
  }
  res.render('student/dashboard');
});

app.get('/teacher/dashboard', requireAuth, (req, res) => {
  if (req.session.user.userType !== 'teacher') {
    return res.status(403).render('error', { error: 'Accès non autorisé' });
  }
  res.render('teacher/dashboard');
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

// Create exam route
app.post('/teacher/exams/create', requireAuth, upload.single('media'), async (req, res) => {
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

    if (req.file) {
      examData.media = {
        type: req.body.mediaType,
        path: req.file.path
      };
    }

    const exam = new Exam(examData);
    await exam.save();

    req.flash('success', 'Examen créé avec succès');
    res.redirect('/teacher/dashboard');
  } catch (error) {
    console.error('Error creating exam:', error);
    req.flash('error', 'Erreur lors de la création de l\'examen');
    res.redirect('/teacher/exams/create');
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    error: 'Une erreur est survenue',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
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