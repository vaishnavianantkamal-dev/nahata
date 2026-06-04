import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { login, refreshAccessToken, logout, getMe } from './auth.service';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const router = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, accessToken, refreshToken } = await login(req.body.email, req.body.password);
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ user, accessToken });
  } catch (err) { next(err); }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) return res.status(401).json({ error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token' } });
    const { accessToken, refreshToken } = await refreshAccessToken(token);
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken });
  } catch (err) { next(err); }
});

router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.refresh_token;
    if (token) await logout(token);
    res.clearCookie('refresh_token');
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getMe(req.user!.userId);
    res.json(user);
  } catch (err) { next(err); }
});

export default router;
