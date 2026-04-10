import type { AuthenticatedRequestLike } from '../types/http';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, authenticate, getBearerToken } = require('../config/auth.js');
const { getDatabaseAccessForRequest } = require('../services/runtime-db.js');

type JsonResponse = {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

type RouteRequest<TBody = unknown> = AuthenticatedRequestLike<TBody> & {
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
};

type UserRecord = {
  id?: unknown;
  username?: unknown;
  role?: unknown;
  name?: unknown;
  password?: unknown;
  created_at?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeLoginRequest(body: unknown) {
  const data = isRecord(body) ? body : {};
  return {
    username: String(data.username || '').trim(),
    password: String(data.password || '')
  };
}

function normalizeCreateUserRequest(body: unknown) {
  const data = isRecord(body) ? body : {};
  return {
    username: String(data.username || '').trim(),
    password: String(data.password || ''),
    role: String(data.role || 'technician').trim(),
    name: String(data.name || '').trim()
  };
}

function sanitizeAuthUser(user: UserRecord) {
  return {
    id: Number(user.id || 0),
    username: String(user.username || ''),
    role: String(user.role || ''),
    name: String(user.name || '')
  };
}

function sanitizeUserListItem(user: UserRecord) {
  return {
    ...sanitizeAuthUser(user),
    created_at: typeof user.created_at === 'string' ? user.created_at : undefined
  };
}

const router = express.Router();

router.post('/login', async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccessForRequest(req);
  const { username, password } = normalizeLoginRequest(req.body);
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]) as UserRecord | null;

  if (!user || !bcrypt.compareSync(password, String(user.password || ''))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const safeUser = sanitizeAuthUser(user);
  const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: safeUser });
});

router.post('/logout', (_req: RouteRequest, res: JsonResponse) => {
  res.json({ success: true });
});

router.get('/me', async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccessForRequest(req);
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserRecord;
    const user = await db.get('SELECT id, username, role, name FROM users WHERE id = ?', [decoded.id]) as UserRecord | null;
    res.json(sanitizeAuthUser(user || decoded));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown token verification error';
    console.log('Token verification error:', message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.get('/users', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }

  const db = getDatabaseAccessForRequest(req);
  const users = await db.all('SELECT id, username, role, name, created_at FROM users') as UserRecord[];
  res.json(users.map(sanitizeUserListItem));
});

router.post('/users', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }

  const db = getDatabaseAccessForRequest(req);
  const { username, password, role, name } = normalizeCreateUserRequest(req.body);

  if (!username || !password || !name) {
    res.status(400).json({ error: 'Username, password and name are required' });
    return;
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
      const result = await db.run('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', [username, hashedPassword, role, name]) as { lastInsertRowid?: number | null };
      await db.save();
      res.json({ id: result.lastInsertRowid ?? null, username, role, name });
    } catch {
      res.status(400).json({ error: 'Username already exists' });
    }
  } catch {
    res.status(400).json({ error: 'User creation failed' });
  }
});

export = router;
