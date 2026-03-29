import { Request, Response } from 'express';
import { authService } from './auth.service';
import { ok, fail } from '../../utils/response';

export const login = async (req: Request, res: Response) => {
  try {
    const tokens = await authService.login(req.body.email, req.body.password);
    ok(res, tokens, 'Login successful');
  } catch (e: any) { fail(res, e.message, 401); }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const tokens = await authService.refreshToken(req.body.refreshToken);
    ok(res, tokens);
  } catch { fail(res, 'Invalid refresh token', 401); }
};

export const logout = (_req: Request, res: Response) => ok(res, null, 'Logged out');
