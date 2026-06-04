import { Router, Request, Response, NextFunction } from 'express';
import * as bcrypt from 'bcryptjs';
import { db } from '../../lib/db';
import { requireAuth, requireRole } from '../../middleware/auth';
import { AppError } from '../../middleware/error';

const router = Router();

router.get('/', requireAuth, requireRole('OWNER', 'MANAGER'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await db.user.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, avatarUrl: true, lastLoginAt: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

router.post('/', requireAuth, requireRole('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone, role, password } = req.body;
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) throw new AppError(409, 'EMAIL_EXISTS', 'Email already in use');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: { name, email, phone, role, passwordHash },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err) { next(err); }
});

router.patch('/:id', requireAuth, requireRole('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, role, isActive, password } = req.body;
    const data: any = {};
    if (name) data.name = name;
    if (phone) data.phone = phone;
    if (role) data.role = role;
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (password) data.passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, requireRole('OWNER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.userId === req.params.id) throw new AppError(400, 'SELF_DELETE', 'Cannot delete your own account');
    await db.user.update({ where: { id: req.params.id }, data: { isActive: false, deletedAt: new Date() } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
