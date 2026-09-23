/** Authentication (JWT) + role-based access control. */
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import type { Context, Next } from 'hono';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-only-change-me-please');
const ALG = 'HS256';

export type UserRole = 'staff' | 'supervisor' | 'finance' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  wardId: number | null;
  employeeId: number | null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    email: user.email, displayName: user.displayName, role: user.role,
    wardId: user.wardId, employeeId: user.employeeId,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALG] });
  return {
    id: Number(payload.sub),
    email: String(payload.email),
    displayName: String(payload.displayName),
    role: payload.role as UserRole,
    wardId: (payload.wardId as number | null) ?? null,
    employeeId: (payload.employeeId as number | null) ?? null,
  };
}

/** Require a valid token; attaches `user` to context. */
export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return c.json({ error: 'unauthorized' }, 401);
  try {
    c.set('user', await verifyToken(token));
    await next();
  } catch {
    return c.json({ error: 'invalid_token' }, 401);
  }
}

/** Require one of the given roles (admin always allowed). */
export function requireRole(...roles: UserRole[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthUser | undefined;
    if (!user) return c.json({ error: 'unauthorized' }, 401);
    if (user.role !== 'admin' && !roles.includes(user.role)) {
      return c.json({ error: 'forbidden', need: roles }, 403);
    }
    await next();
  };
}
