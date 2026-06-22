import express from 'express';
import { requireAuth } from "../../middleware/auth";

const router = express.Router();
router.use(requireAuth);

// Self-prefixed paths (router is mounted at the API root alongside the other shared routers).
// Follow-up sequences are not yet implemented — these return empty/no-op so the
// Settings page renders ("No sequences yet") instead of 404-ing.
router.get('/sequences', async (req, res) => res.json([]));
router.post('/sequences', async (req, res) => res.status(201).json({}));
router.patch('/sequences/:id', async (req, res) => res.json({}));

export default router;
