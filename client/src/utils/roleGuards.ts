import type { Role } from '../types/auth.types';
export const hasRole  = (userRoles: Role[], required: Role[]) => required.some(r => userRoles.includes(r));
export const isAdmin  = (roles: Role[]) => roles.includes('super_admin');
export const isStaff  = (roles: Role[]) => ['rdc_manager','rdc_staff'].some(r => roles.includes(r as Role));
