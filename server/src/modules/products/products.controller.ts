import { Request, Response } from 'express';
// TODO: implement products controller methods
export const placeholder = (_req: Request, res: Response) =>
  res.json({ module: 'products', status: 'stub' });
