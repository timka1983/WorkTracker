-- 1. Включаем расширение для хеширования, если оно еще не включено
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Добавляем колонку pin_hash, если её нет
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "pin_hash" TEXT;

-- 3. Хешируем существующие PIN-коды (используем bcrypt)
UPDATE "public"."users" 
SET "pin_hash" = crypt("pin", gen_salt('bf')) 
WHERE "pin_hash" IS NULL AND "pin" IS NOT NULL;
