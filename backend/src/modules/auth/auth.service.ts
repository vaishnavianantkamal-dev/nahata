import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { query, queryOne, transaction } from '../../lib/db';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error';

function signAccessToken(userId: string, role: string, email: string) {
  return jwt.sign({ userId, role, email }, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as any });
}

function signRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

export async function login(email: string, password: string) {
  const user = await queryOne<any>(
    'SELECT * FROM "User" WHERE email = $1',
    [email]
  );
  if (!user || !user.isActive) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const accessToken = signAccessToken(user.id, user.role, user.email);
  const refreshToken = signRefreshToken();
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO "RefreshToken" (id, "userId", "tokenHash", "expiresAt", "createdAt") VALUES ($1, $2, $3, $4, $5)',
    [crypto.randomUUID(), user.id, tokenHash, expiresAt, new Date()]
  );
  await query(
    'UPDATE "User" SET "lastLoginAt" = $1, "updatedAt" = $2 WHERE id = $3',
    [new Date(), new Date(), user.id]
  );

  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
}

export async function refreshAccessToken(rawToken: string) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const stored = await queryOne<any>(
    'SELECT * FROM "RefreshToken" WHERE "tokenHash" = $1',
    [tokenHash]
  );

  if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Invalid or expired refresh token');
  }

  const user = await queryOne<any>(
    'SELECT * FROM "User" WHERE id = $1',
    [stored.userId]
  );
  if (!user || !user.isActive) throw new AppError(401, 'USER_INACTIVE', 'Account is inactive');

  await query(
    'UPDATE "RefreshToken" SET "isRevoked" = true WHERE "tokenHash" = $1',
    [tokenHash]
  );

  const newRefreshToken = signRefreshToken();
  const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO "RefreshToken" (id, "userId", "tokenHash", "expiresAt", "createdAt") VALUES ($1, $2, $3, $4, $5)',
    [crypto.randomUUID(), user.id, newHash, expiresAt, new Date()]
  );

  const accessToken = signAccessToken(user.id, user.role, user.email);
  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(rawToken: string) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await query(
    'UPDATE "RefreshToken" SET "isRevoked" = true WHERE "tokenHash" = $1',
    [tokenHash]
  );
}

export async function getMe(userId: string) {
  const user = await queryOne<any>(
    'SELECT id, name, email, phone, role, "avatarUrl", "isActive", "lastLoginAt", "createdAt" FROM "User" WHERE id = $1',
    [userId]
  );
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return user;
}
