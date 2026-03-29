import { Request, Response, NextFunction } from 'express';

export const authorize = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthenticated' });
    const hasRole = roles.some(r => req.user!.roles.includes(r));
    if (!hasRole) return res.status(403).json({ message: 'Forbidden — insufficient role' });
    next();
  };
