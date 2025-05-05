// Load required modules
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
require('dotenv').config();

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Use static files from the /public directory
app.use(express.static(path.join(__dirname, 'public')));

// Parse form data
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.DB_URL || 'mongodb://localhost:27017/evalio', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// Set up session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'secretKeyEvalio',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.DB_URL || 'mongodb://localhost:27017/evalio'
  }),
  cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
}));

// ROUTES
// Home route
app.get('/', (req, res) => {
  res.render('index', { title: 'Evalio | Plateforme d\'examens en ligne' });
});

// Use separate route files
app.use('/', require('./routes/auth'));       // register/login
app.use('/teacher', require('./routes/teacher')); // teacher dashboard, exams
app.use('/student', require('./routes/student')); // student participation

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
