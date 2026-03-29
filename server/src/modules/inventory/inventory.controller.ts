import { Request, Response } from 'express';
// TODO: implement inventory controller methods
export const placeholder = (_req: Request, res: Response) =>
  res.json({ module: 'inventory', status: 'stub' });
