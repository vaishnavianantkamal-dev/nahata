import express from 'express';
import { requireAuth } from "../../middleware/auth";

const router = express.Router();
router.use(requireAuth);

router.get('/template-groups', async (req, res) => {
  res.json([]);
});

router.post('/template-groups', async (req, res) => {
  res.status(201).json({});
});

router.get('/templates', async (req, res) => {
  res.json([]);
});

router.post('/templates', async (req, res) => {
  res.status(201).json({});
});

export default router;
