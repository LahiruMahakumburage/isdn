import { Request, Response } from 'express';
// TODO: implement users controller methods
export const placeholder = (_req: Request, res: Response) =>
  res.json({ module: 'users', status: 'stub' });
