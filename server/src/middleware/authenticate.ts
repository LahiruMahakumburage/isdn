import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthPayload { userId: string; roles: string[]; rdcId?: number; }
declare global { namespace Express { interface Request { user?: AuthPayload; } } }

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
