-- V3: Performance indexes
ALTER TABLE orders    ADD INDEX idx_orders_customer (customer_id);
ALTER TABLE orders    ADD INDEX idx_orders_rdc      (rdc_id);
ALTER TABLE orders    ADD INDEX idx_orders_status   (status);
ALTER TABLE inventory ADD INDEX idx_inv_rdc         (rdc_id);
ALTER TABLE deliveries ADD INDEX idx_del_driver     (driver_id);
ALTER TABLE deliveries ADD INDEX idx_del_status     (status);
ALTER TABLE notifications ADD INDEX idx_notif_user  (user_id, is_read);
