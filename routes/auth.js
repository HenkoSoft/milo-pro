const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, authenticate, getBearerToken } = require('../auth');
const { getDatabaseAccessForRequest } = require('../services/runtime-db');

const router = express.Router();

function sanitizeAuthUser(user) {
  return {
    id: Number(user.id || 0),
    username: String(user.username || ''),
    role: String(user.role || ''),
    name: String(user.name || '')
  };
}

function normalizeLoginRequest(body) {
  const data = body && typeof body === 'object' ? body : {};
  return {
    username: String(data.username || '').trim(),
    password: String(data.password || '')
  };
}

function normalizeCreateUserRequest(body) {
  const data = body && typeof body === 'object' ? body : {};
  return {
    username: String(data.username || '').trim(),
    password: String(data.password || ''),
    role: String(data.role || 'technician').trim(),
    name: String(data.name || '').trim()
  };
}

router.post('/login', async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const { username, password } = normalizeLoginRequest(req.body);
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const safeUser = sanitizeAuthUser(user);
  const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '24h' });

  res.json({ token, user: safeUser });
});

router.post('/logout', (_req, res) => {
  res.json({ success: true });
});

router.get('/me', async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.get('SELECT id, username, role, name FROM users WHERE id = ?', [decoded.id]);
    res.json(sanitizeAuthUser(user || decoded));
  } catch (err) {
    console.log('Token verification error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.get('/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const db = getDatabaseAccessForRequest(req);
  const users = (await db.all('SELECT id, username, role, name, created_at FROM users')).map((user) => ({
    ...sanitizeAuthUser(user),
    created_at: user.created_at
  }));
  res.json(users);
});

router.post('/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const db = getDatabaseAccessForRequest(req);
  const { username, password, role, name } = normalizeCreateUserRequest(req.body);
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, password and name are required' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
      const result = await db.run('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', [username, hashedPassword, role, name]);
      await db.save();
      res.json({ id: result.lastInsertRowid, username, role, name });
    } catch (_err) {
      res.status(400).json({ error: 'Username already exists' });
    }
  } catch (_err) {
    res.status(400).json({ error: 'User creation failed' });
  }
});

module.exports = router;
