-- Добавление полей в таблицу system_config
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS use_supabase_proxy BOOLEAN DEFAULT FALSE;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS use_telegram_proxy BOOLEAN DEFAULT FALSE;

-- Обновление существующих записей в system_config, если нужно
UPDATE system_config SET use_supabase_proxy = FALSE WHERE use_supabase_proxy IS NULL;
UPDATE system_config SET use_telegram_proxy = FALSE WHERE use_telegram_proxy IS NULL;

-- Добавление полей в таблицу organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS use_supabase_proxy BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS use_telegram_proxy BOOLEAN DEFAULT FALSE;

-- Обновление существующих записей в organizations, если нужно
UPDATE organizations SET use_supabase_proxy = FALSE WHERE use_supabase_proxy IS NULL;
UPDATE organizations SET use_telegram_proxy = FALSE WHERE use_telegram_proxy IS NULL;
