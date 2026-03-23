const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run, all, saveDatabase } = require('../database');
const { JWT_SECRET, authenticate } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  
  const user = get('SELECT * FROM users WHERE username = ?', [username]);
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    }
  });
});

router.post('/logout', (req, res) => {
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = get('SELECT id, username, role, name FROM users WHERE id = ?', [decoded.id]);
    if (user) {
      res.json(user);
    } else {
      res.json({ id: decoded.id, username: decoded.username, role: decoded.role, name: decoded.name });
    }
  } catch (err) {
    console.log('Token verification error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.get('/users', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const users = all('SELECT id, username, role, name, created_at FROM users');
  res.json(users);
});

router.post('/users', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const role = String(req.body.role || 'technician').trim();
  const name = String(req.body.name || '').trim();
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, password and name are required' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
      const result = run('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', [username, hashedPassword, role, name]);
      saveDatabase();
      res.json({ id: result.lastInsertRowid, username, role, name });
    } catch (err) {
      res.status(400).json({ error: 'Username already exists' });
    }
  } catch (err) {
    res.status(400).json({ error: 'User creation failed' });
  }
});

module.exports = router;
