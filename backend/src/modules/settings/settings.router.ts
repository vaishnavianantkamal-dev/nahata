import express from 'express';
import { requireAuth } from "../../middleware/auth";
import { query, queryMany, queryOne } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(requireAuth);

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await queryMany('SELECT key, value FROM "Setting" ORDER BY key ASC');
    const result: Record<string, any> = {};
    settings.forEach(s => {
      result[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/settings', async (req, res, next) => {
  try {
    const now = new Date();
    for (const [key, value] of Object.entries(req.body)) {
      await query(
        'INSERT INTO "Setting" (id, key, value, "updatedAt") VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO UPDATE SET value = $3, "updatedAt" = $4',
        [uuidv4(), key, JSON.stringify(value), now]
      );
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
