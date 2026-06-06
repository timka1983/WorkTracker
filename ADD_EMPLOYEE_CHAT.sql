-- Скрипт создания таблицы для Чата сотрудников

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_by TEXT,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они существуют
DROP POLICY IF EXISTS "Enable read access for all within organization" ON chat_messages;
DROP POLICY IF EXISTS "Enable insert access for all" ON chat_messages;
DROP POLICY IF EXISTS "Enable update access for all" ON chat_messages;

-- Создаем новые
CREATE POLICY "Enable read access for all within organization" 
ON chat_messages FOR SELECT 
USING (organization_id = current_setting('app.current_org_id', true) OR organization_id IS NOT NULL);

CREATE POLICY "Enable insert access for all" 
ON chat_messages FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Enable update access for all"
ON chat_messages FOR UPDATE
USING (true);

-- Добавляем колонку is_chat_admin в users, если её нет
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_chat_admin BOOLEAN DEFAULT FALSE;
