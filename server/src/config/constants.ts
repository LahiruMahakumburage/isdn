export const ROLES = {
  SUPER_ADMIN:       'super_admin',
  RDC_MANAGER:       'rdc_manager',
  RDC_STAFF:         'rdc_staff',
  LOGISTICS_OFFICER: 'logistics_officer',
  CUSTOMER:          'customer',
} as const;

export const PAGINATION = { DEFAULT_PAGE: 1, DEFAULT_LIMIT: 20, MAX_LIMIT: 100 };
