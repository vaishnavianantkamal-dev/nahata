import express from 'express';
import { requireAuth } from "../../middleware/auth";

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => res.json([]));
router.post('/', async (req, res) => res.status(201).json({}));
router.patch('/:id', async (req, res) => res.json({}));

export default router;
