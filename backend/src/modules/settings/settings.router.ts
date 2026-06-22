import express from 'express';
import { requireAuth } from "../../middleware/auth";
import { query, queryMany } from '../../lib/db';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(requireAuth);

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await queryMany('SELECT key, value FROM "Setting" ORDER BY key ASC');
    const result: Record<string, any> = {};
    settings.forEach(s => {
      // The `value` column is JSONB — pg already returns it parsed. Only attempt a
      // parse if it's still a string AND looks like JSON (defensive against legacy rows);
      // otherwise use it as-is. (Re-parsing a plain string like "INR" would throw.)
      let v = s.value;
      if (typeof v === 'string') {
        try { v = JSON.parse(v); } catch { /* keep raw string */ }
      }
      result[s.key] = v;
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Upsert a single setting by key — used by the Settings page and CMS option lists.
router.put('/settings/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const now = new Date();
    await query(
      'INSERT INTO "Setting" (id, key, value, "updatedAt") VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO UPDATE SET value = $3, "updatedAt" = $4',
      [uuidv4(), key, JSON.stringify(value), now]
    );
    res.json({ success: true, key, value });
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
