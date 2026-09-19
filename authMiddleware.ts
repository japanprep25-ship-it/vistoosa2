import type { Request, Response, NextFunction } from 'express';
import { verifyJwtToken, UserProfile } from './userStore';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: UserProfile;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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

  const user = verifyJwtToken(token);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session token. Please log in again.',
    });
  }

  req.userId = user.id;
  req.user = user;
  next();
}

export function extractOptionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  let token = '';

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query?.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (token) {
    const user = verifyJwtToken(token);
    if (user) {
      req.userId = user.id;
      req.user = user;
    }
  }

  // Fallback to default user if no token provided (e.g. public webhook or dev fallback)
  if (!req.userId) {
    req.userId = 'usr_admin_default';
  }

  next();
}
