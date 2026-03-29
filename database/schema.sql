-- ============================================================
-- ISDN — Full Schema
-- Run in phpMyAdmin against isdn_db (utf8mb4_unicode_ci)
-- ============================================================
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS roles (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rdcs (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  region     ENUM('north','south','east','west','central') NOT NULL UNIQUE,
  address    TEXT,
  latitude   DECIMAL(10,7),
  longitude  DECIMAL(10,7),
  manager_id CHAR(36) NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36) PRIMARY KEY,
  full_name     VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  rdc_id        INT UNSIGNED NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (rdc_id) REFERENCES rdcs(id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id     CHAR(36) NOT NULL,
  role_id     INT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS categories (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  parent_id  INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS products (
  id            CHAR(36) PRIMARY KEY,
  sku           VARCHAR(60)  NOT NULL UNIQUE,
  name          VARCHAR(200) NOT NULL,
  category_id   INT UNSIGNED NOT NULL,
  unit          VARCHAR(30),
  unit_price    DECIMAL(12,2) NOT NULL,
  reorder_level INT UNSIGNED DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rdc_id            INT UNSIGNED NOT NULL,
  product_id        CHAR(36) NOT NULL,
  quantity_on_hand  INT NOT NULL DEFAULT 0,
  quantity_reserved INT NOT NULL DEFAULT 0,
  last_updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rdc_product (rdc_id, product_id),
  FOREIGN KEY (rdc_id)     REFERENCES rdcs(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id           CHAR(36) PRIMARY KEY,
  from_rdc_id  INT UNSIGNED NOT NULL,
  to_rdc_id    INT UNSIGNED NOT NULL,
  product_id   CHAR(36) NOT NULL,
  quantity     INT UNSIGNED NOT NULL,
  status       ENUM('pending','in_transit','completed','cancelled') DEFAULT 'pending',
  initiated_by CHAR(36) NOT NULL,
  approved_by  CHAR(36) NULL,
  transfer_date DATE,
  notes        TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_rdc_id)  REFERENCES rdcs(id),
  FOREIGN KEY (to_rdc_id)    REFERENCES rdcs(id),
  FOREIGN KEY (product_id)   REFERENCES products(id),
  FOREIGN KEY (initiated_by) REFERENCES users(id),
  FOREIGN KEY (approved_by)  REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id               CHAR(36) PRIMARY KEY,
  order_number     VARCHAR(30) NOT NULL UNIQUE,
  customer_id      CHAR(36) NOT NULL,
  rdc_id           INT UNSIGNED NOT NULL,
  status           ENUM('draft','confirmed','picking','dispatched','delivered','cancelled','returned') DEFAULT 'draft',
  delivery_address TEXT,
  delivery_lat     DECIMAL(10,7),
  delivery_lng     DECIMAL(10,7),
  subtotal         DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount         DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax              DECIMAL(14,2) NOT NULL DEFAULT 0,
  total            DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  ordered_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at     TIMESTAMP NULL,
  delivered_at     TIMESTAMP NULL,
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (rdc_id)      REFERENCES rdcs(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id   CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  quantity   INT UNSIGNED NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(14,2) NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS delivery_routes (
  id         CHAR(36) PRIMARY KEY,
  rdc_id     INT UNSIGNED NOT NULL,
  driver_id  CHAR(36) NOT NULL,
  route_date DATE NOT NULL,
  stop_count INT UNSIGNED DEFAULT 0,
  total_km   DECIMAL(8,2),
  status     ENUM('planned','active','completed') DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rdc_id)    REFERENCES rdcs(id),
  FOREIGN KEY (driver_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS deliveries (
  id                 CHAR(36) PRIMARY KEY,
  order_id           CHAR(36) NOT NULL UNIQUE,
  driver_id          CHAR(36) NULL,
  rdc_id             INT UNSIGNED NOT NULL,
  route_id           CHAR(36) NULL,
  status             ENUM('scheduled','out_for_delivery','delivered','failed') DEFAULT 'scheduled',
  scheduled_date     DATE NOT NULL,
  actual_delivery_at TIMESTAMP NULL,
  current_lat        DECIMAL(10,7),
  current_lng        DECIMAL(10,7),
  last_gps_update    TIMESTAMP NULL,
  proof_of_delivery  TEXT,
  FOREIGN KEY (order_id)  REFERENCES orders(id),
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (rdc_id)    REFERENCES rdcs(id),
  FOREIGN KEY (route_id)  REFERENCES delivery_routes(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id             CHAR(36) PRIMARY KEY,
  invoice_number VARCHAR(30) NOT NULL UNIQUE,
  order_id       CHAR(36) NOT NULL UNIQUE,
  customer_id    CHAR(36) NOT NULL,
  subtotal       DECIMAL(14,2) NOT NULL,
  tax_amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount   DECIMAL(14,2) NOT NULL,
  status         ENUM('draft','issued','paid','overdue','void') DEFAULT 'draft',
  due_date       DATE,
  issued_at      TIMESTAMP NULL,
  paid_at        TIMESTAMP NULL,
  FOREIGN KEY (order_id)    REFERENCES orders(id),
  FOREIGN KEY (customer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id          CHAR(36) PRIMARY KEY,
  invoice_id  CHAR(36) NOT NULL,
  amount      DECIMAL(14,2) NOT NULL,
  method      ENUM('cash','bank_transfer','card','online_gateway') NOT NULL,
  gateway_ref VARCHAR(120),
  status      ENUM('pending','success','failed','refunded') DEFAULT 'pending',
  paid_at     TIMESTAMP NULL,
  recorded_by CHAR(36) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id)  REFERENCES invoices(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    CHAR(36) NOT NULL,
  type       VARCHAR(60) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  related_id CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

SET FOREIGN_KEY_CHECKS = 1;
