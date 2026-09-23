import type { Request, Response, NextFunction } from 'express';
import { verifyJwtToken, UserProfile } from './userStore';

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
