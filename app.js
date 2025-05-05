const express = require('express'); 
const app = express();
const path = require('path');
const port = 3000;

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Set the views directory (optional but recommended)
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the "public" folder
app.use(express.static('public'));

// Route for index page
app.get('/', (req, res) => {
  res.render('index'); // Ensure this matches the name of your EJS file
});

// Route for register page
app.get('/register', (req, res) => {
  res.render('register'); // This will render the register.ejs page
});

// Route for login page
app.get('/login', (req, res) => {
  res.render('login'); // This will render the login.ejs page
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
