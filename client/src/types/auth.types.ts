export interface User { id: string; name: string; email: string; roles: string[]; rdcId?: number; }
export type Role = 'super_admin'|'rdc_manager'|'rdc_staff'|'logistics_officer'|'customer';
