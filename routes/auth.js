const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../utils/database');
const { body, validationResult } = require('express-validator');

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  
  res.render('login', {
    title: 'Login | ShadowCore',
    error: null,
    success: req.query.success,
    username: ''
  });
});

// Login handler
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.render('login', {
      title: 'Login | ShadowCore',
      error: errors.array()[0].msg,
      username: req.body.username
    });
  }
  
  const { username, password } = req.body;
  
  try {
    // Find user
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      return res.render('login', {
        title: 'Login | ShadowCore',
        error: 'Invalid username or password',
        username: username
      });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.render('login', {
        title: 'Login | ShadowCore',
        error: 'Invalid username or password',
        username: username
      });
    }
    
    // Create session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.created_at
    };
    
    // Redirect based on role
    if (user.role === 'admin') {
      res.redirect('/admin');
    } else {
      res.redirect('/dashboard');
    }
    
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', {
      title: 'Login | ShadowCore',
      error: 'An error occurred. Please try again.',
      username: username
    });
  }
});

// Signup page
router.get('/signup', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  
  res.render('signup', {
    title: 'Create Account | ShadowCore',
    error: null,
    success: null,
    formData: {}
  });
});

// Signup handler
router.post('/signup', [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Invalid email address'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match')
], async (req, res) => {
  const errors = validationResult(req);
  const { username, email, password } = req.body;
  
  if (!errors.isEmpty()) {
    return res.render('signup', {
      title: 'Create Account | ShadowCore',
      error: errors.array()[0].msg,
      formData: { username, email }
    });
  }
  
  try {
    // Check if username exists
    const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    
    if (existingUser) {
      return res.render('signup', {
        title: 'Create Account | ShadowCore',
        error: 'Username already taken',
        formData: { username, email }
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    await db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email || null, hashedPassword, 'user']
    );
    
    // Auto-login
    const newUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    
    req.session.user = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.created_at
    };
    
    res.redirect('/dashboard?welcome=1');
    
  } catch (error) {
    console.error('Signup error:', error);
    res.render('signup', {
      title: 'Create Account | ShadowCore',
      error: 'An error occurred. Please try again.',
      formData: { username, email }
    });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

// Profile page
router.get('/profile', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    
    res.render('profile', {
      title: 'My Profile | ShadowCore',
      user: { ...req.session.user, ...user },
      plugins: Array.from(global.plugins.values()).filter(p => p.enabled)
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.redirect('/dashboard');
  }
});

module.exports = router;
