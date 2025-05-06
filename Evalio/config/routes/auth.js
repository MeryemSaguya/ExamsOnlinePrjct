const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Register route
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, userType } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error', 'Un utilisateur avec cet email existe déjà');
      return res.redirect('/register');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      userType
    });

    await user.save();

    req.flash('success', 'Inscription réussie! Vous pouvez maintenant vous connecter.');
    res.redirect('/login');
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error', 'Erreur lors de l\'inscription');
    res.redirect('/register');
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      req.flash('error', 'Email ou mot de passe incorrect');
      return res.redirect('/login');
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      req.flash('error', 'Email ou mot de passe incorrect');
      return res.redirect('/login');
    }

    // Set session
    req.session.user = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      userType: user.userType
    };

    // Redirect based on user type
    res.redirect(user.userType === 'student' ? '/student/dashboard' : '/teacher/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'Erreur lors de la connexion');
    res.redirect('/login');
  }
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
});

module.exports = router;
