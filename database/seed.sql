-- ============================================================
-- ISDN — Seed Data (development only)
-- Run AFTER schema.sql
-- ============================================================

-- Roles
INSERT IGNORE INTO roles (name, description) VALUES
  ('super_admin',       'Head Office — full system access'),
  ('rdc_manager',       'Manages a single RDC'),
  ('rdc_staff',         'RDC clerk / warehouse staff'),
  ('logistics_officer', 'Driver / delivery officer'),
  ('customer',          'Retail customer');

-- RDCs
INSERT IGNORE INTO rdcs (name, region, address, latitude, longitude) VALUES
  ('North RDC',   'north',   '12 Jaffna Road, Northern Province',   9.6615,  80.0255),
  ('South RDC',   'south',   '45 Galle Road, Southern Province',    6.0535,  80.2210),
  ('East RDC',    'east',    '78 Trinco Road, Eastern Province',    8.5874,  81.2152),
  ('West RDC',    'west',    '23 Negombo Road, Western Province',   7.2083,  79.8358),
  ('Central RDC', 'central', '56 Kandy Road, Central Province',     7.2906,  80.6337);

-- Categories
INSERT IGNORE INTO categories (name) VALUES
  ('Beverages'), ('Dry Goods'), ('Dairy'), ('Personal Care'), ('Household');

-- Sample admin user (password: Admin@1234)
-- bcrypt hash of 'Admin@1234' with 10 rounds
INSERT IGNORE INTO users (id, full_name, email, password_hash, phone) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'System Administrator',
   'admin@isdn.lk',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   '+94771000001');

-- Assign super_admin role
INSERT IGNORE INTO user_roles (user_id, role_id)
  SELECT '00000000-0000-0000-0000-000000000001', id FROM roles WHERE name='super_admin';

-- Sample products
INSERT IGNORE INTO products (id, sku, name, category_id, unit, unit_price, reorder_level) VALUES
  ('prod-0001-0000-0000-0000-000000000001', 'BEV-001', 'Mineral Water 500ml (24pk)', 1, 'carton', 850.00,  50),
  ('prod-0002-0000-0000-0000-000000000002', 'BEV-002', 'Orange Juice 1L (12pk)',     1, 'carton', 1440.00, 30),
  ('prod-0003-0000-0000-0000-000000000003', 'DRY-001', 'Basmati Rice 5kg',           2, 'bag',    1250.00, 100),
  ('prod-0004-0000-0000-0000-000000000004', 'DAI-001', 'Full Cream Milk 1L (12pk)', 3, 'carton', 2100.00, 40),
  ('prod-0005-0000-0000-0000-000000000005', 'HHD-001', 'Dish Soap 500ml (12pk)',    5, 'carton', 960.00,  25);
