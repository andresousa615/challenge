CREATE TABLE IF NOT EXISTS companies (
  id      SERIAL PRIMARY KEY,
  domain  TEXT UNIQUE,
  name    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_products (
  reference   TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  family      TEXT NOT NULL,
  unit        TEXT NOT NULL,
  price_eur   NUMERIC(10,3) NOT NULL,
  -- false when the product is no longer in the API catalog. Products are never deleted.
  active      BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  email_id        TEXT NOT NULL UNIQUE,
  company_id      INTEGER REFERENCES companies(id),
  contact         TEXT,
  customer_email  TEXT NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL,
  requested_date  DATE,
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','em_preparacao','enviada','entregue','cancelada')),
  email_body      TEXT NOT NULL,
  -- Timeline: the day each stage was reached (set on status change, editable, never in the future)
  preparation_date DATE,
  shipped_date     DATE,
  delivered_date   DATE,
  cancelled_date   DATE
);

CREATE TABLE IF NOT EXISTS order_lines (
  id        SERIAL PRIMARY KEY,
  order_id  INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  quantity  INTEGER CHECK (quantity > 0),
  -- Copied from the catalog when the line is saved, so later catalog changes (price, name,
  -- unit, deletion) don't alter past orders. NULL = the code wasn't in the (active) catalog.
  unit_price_eur NUMERIC(10,3),
  description    TEXT,
  unit           TEXT
);

CREATE INDEX IF NOT EXISTS order_lines_order_id_idx ON order_lines(order_id);
