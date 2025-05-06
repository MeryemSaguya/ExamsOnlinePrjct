const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../../../models/User');

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).render('login', { 
        error: 'Email ou mot de passe incorrect'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).render('login', { 
        error: 'Email ou mot de passe incorrect'
      });
    }

    // Set user session
    req.session.user = {
      id: user._id,
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName
    };

    // Redirect based on user type
    if (user.userType === 'student') {
      res.redirect('/student/dashboard');
    } else {
      res.redirect('/teacher/dashboard');
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).render('error', { 
      error: 'Une erreur est survenue lors de la connexion'
    });
  }
});

// Register route
router.post('/register', async (req, res) => {
  try {
    const { 
      userType, gender, lastName, firstName, 
      email, birthDate, school, major, password 
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).render('register', { 
        error: 'Cet email est déjà utilisé'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      userType,
      gender,
      lastName,
      firstName,
      email,
      birthDate,
      school,
      major,
      password: hashedPassword
    });

    await user.save();

    // Set user session
    req.session.user = {
      id: user._id,
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName
    };

    // Redirect based on user type
    if (user.userType === 'student') {
      res.redirect('/student/dashboard');
    } else {
      res.redirect('/teacher/dashboard');
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).render('error', { 
      error: 'Une erreur est survenue lors de l\'inscription'
    });
  }
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).render('error', { 
        error: 'Une erreur est survenue lors de la déconnexion'
      });
    }
    res.redirect('/');
  });
});

module.exports = router;