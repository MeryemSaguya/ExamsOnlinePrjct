// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    req.flash('error', 'Veuillez vous connecter pour accéder à cette page');
    return res.redirect('/login');
  }
  next();
};

// Student role middleware
const isStudent = (req, res, next) => {
  if (req.session.user.userType !== 'student') {
    req.flash('error', 'Accès non autorisé');
    return res.status(403).render('error', { error: 'Accès non autorisé' });
  }
  next();
};

// Teacher role middleware
const isTeacher = (req, res, next) => {
  if (req.session.user.userType !== 'teacher') {
    req.flash('error', 'Accès non autorisé');
    return res.status(403).render('error', { error: 'Accès non autorisé' });
  }
  next();
};

module.exports = {
  isAuthenticated,
  isStudent,
  isTeacher
}; 