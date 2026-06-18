import express from 'express';
import { requireAuth } from '../../middleware/auth';
import { query, queryMany, queryOne } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const users = await queryMany('SELECT id, name, email, phone, role, "isActive", "lastLoginAt", "createdAt" FROM "User" WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC');
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const now = new Date();
    const id = uuidv4();
    
    await query(
      'INSERT INTO "User" (id, name, email, phone, "passwordHash", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, name, email, phone, hash, role || 'AGENT', true, now, now]
    );
    
    const user = await queryOne('SELECT id, name, email, phone, role, "isActive", "createdAt" FROM "User" WHERE id = $1', [id]);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const now = new Date();
    const updates = [];
    const params = [];
    let paramIndex = 2;
    
    if (req.body.name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(req.body.name);
    }
    if (req.body.phone) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(req.body.phone);
    }
    if (req.body.role) {
      updates.push(`role = $${paramIndex++}`);
      params.push(req.body.role);
    }
    if (req.body.isActive !== undefined) {
      updates.push(`"isActive" = $${paramIndex++}`);
      params.push(req.body.isActive);
    }
    
    updates.push(`"updatedAt" = $${paramIndex++}`);
    params.push(now);
    params.unshift(req.params.id);
    
    if (updates.length > 1) {
      await query(`UPDATE "User" SET ${updates.join(', ')} WHERE id = $1`, params);
    }
    
    const user = await queryOne('SELECT id, name, email, phone, role, "isActive", "createdAt" FROM "User" WHERE id = $1', [req.params.id]);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
