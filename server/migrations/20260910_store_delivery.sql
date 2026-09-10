-- Campo Limpo RP - entrega automática da loja
ALTER TABLE products ADD COLUMN delivery_type VARCHAR(30) NOT NULL DEFAULT 'none';
ALTER TABLE products ADD COLUMN delivery_value VARCHAR(255) NULL;
ALTER TABLE products ADD COLUMN delivery_amount INT NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN delivery_days INT NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN vip_max_members INT NOT NULL DEFAULT 0;

ALTER TABLE order_items ADD COLUMN product_id VARCHAR(64) NULL;
ALTER TABLE order_items ADD COLUMN delivery_type VARCHAR(30) NOT NULL DEFAULT 'none';
ALTER TABLE order_items ADD COLUMN delivery_value VARCHAR(255) NULL;
ALTER TABLE order_items ADD COLUMN delivery_amount INT NOT NULL DEFAULT 1;
ALTER TABLE order_items ADD COLUMN delivery_days INT NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN vip_max_members INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS order_item_recipients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_item_id BIGINT UNSIGNED NOT NULL,
  character_id VARCHAR(50) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_item_character (order_item_id, character_id),
  KEY idx_order_item (order_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS store_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dedupe_key VARCHAR(191) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  character_id VARCHAR(50) NOT NULL,
  delivery_type VARCHAR(30) NOT NULL,
  delivery_value VARCHAR(255) NULL,
  delivery_amount INT NOT NULL DEFAULT 1,
  delivery_days INT NOT NULL DEFAULT 0,
  status ENUM('pending','processing','delivered','failed') NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  last_attempt_at DATETIME NULL,
  delivered_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_dedupe (dedupe_key),
  KEY idx_delivery_status (status, attempts),
  KEY idx_delivery_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
