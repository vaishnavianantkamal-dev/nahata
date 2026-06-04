import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { db } from '../../lib/db';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error';

function signAccessToken(userId: string, role: string, email: string) {
  return jwt.sign({ userId, role, email }, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as any });
}

function signRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

export async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const accessToken = signAccessToken(user.id, user.role, user.email);
  const refreshToken = signRefreshToken();
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
}

export async function refreshAccessToken(rawToken: string) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const stored = await db.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Invalid or expired refresh token');
  }

  const user = await db.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.isActive) throw new AppError(401, 'USER_INACTIVE', 'Account is inactive');

  // Rotate refresh token
  await db.refreshToken.update({ where: { tokenHash }, data: { isRevoked: true } });

  const newRefreshToken = signRefreshToken();
  const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.refreshToken.create({ data: { userId: user.id, tokenHash: newHash, expiresAt } });

  const accessToken = signAccessToken(user.id, user.role, user.email);
  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(rawToken: string) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await db.refreshToken.updateMany({ where: { tokenHash }, data: { isRevoked: true } });
}

export async function getMe(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, role: true, avatarUrl: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return user;
}
