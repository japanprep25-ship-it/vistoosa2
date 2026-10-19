import type { Request, Response, NextFunction } from 'express';
import { verifyJwtToken, findUserById, sanitizeUser, UserProfile } from './userStore';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: UserProfile;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || '';
    let token = '';

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.query?.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    const user = await verifyJwtToken(token);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token. Please log in again.',
      });
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      message: 'Authentication error: ' + (err?.message || 'Invalid token'),
    });
  }
}

export async function requireMotherGmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    try {
      const { getMotherGmail } = await import('./globalSettingsStore');
      const motherGmail = await getMotherGmail();
      if (!req.user || req.user.email.toLowerCase() !== motherGmail.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Access restricted. Only the authorized Mother Gmail (${motherGmail}) has permission to access API integrations.`,
        });
      }
      next();
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'Permission check failed' });
    }
  });
}

export async function extractOptionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || '';
    let token = '';

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.query?.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (token) {
      const user = await verifyJwtToken(token);
      if (user) {
        req.userId = user.id;
        req.user = user;
      }
    }
  } catch {
    // Ignore error in optional auth
  }

  // Fallback to default user if no token provided (e.g. public webhook or dev fallback)
  if (!req.userId) {
    req.userId = 'usr_admin_default';
  }

  next();
}
