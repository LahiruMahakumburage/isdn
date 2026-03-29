import { Response } from 'express';
export const ok    = (res: Response, data: any, msg = 'Success') => res.json({ success: true, message: msg, data });
export const fail  = (res: Response, msg: string, status = 400) => res.status(status).json({ success: false, message: msg });
