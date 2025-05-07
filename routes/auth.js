const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../Evalio/config/models/User');

// Middleware to trim inputs (optional but helpful)
const trimInputs = (req, res, next) => {
  for (const key in req.body) {
    if (typeof req.body[key] === 'string') {
      req.body[key] = req.body[key].trim();
    }
  }
  next();
};

// LOGIN
router.post('/login', trimInputs, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).render('login', { 
        error: 'Veuillez fournir un email et un mot de passe' 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).render('login', { 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).render('login', { 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    req.session.user = {
      id: user._id,
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName
    };

    res.redirect(user.userType === 'student' ? '/student/dashboard' : '/teacher/dashboard');

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).render('error', { 
      error: 'Une erreur est survenue lors de la connexion' 
    });
  }
});

// REGISTER
router.post('/register', trimInputs, async (req, res) => {
  try {
    const { 
      userType, gender, lastName, firstName, 
      email, birthDate, school, major, password 
    } = req.body;

    if (!userType || !email || !password || !firstName || !lastName) {
      return res.status(400).render('register', { 
        error: 'Veuillez remplir tous les champs obligatoires' 
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).render('register', { 
        error: 'Cet email est déjà utilisé' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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

    req.session.user = {
      id: user._id,
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName
    };

    res.redirect(user.userType === 'student' ? '/student/dashboard' : '/teacher/dashboard');

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).render('error', { 
      error: 'Une erreur est survenue lors de l\'inscription' 
    });
  }
});

// LOGOUT
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
