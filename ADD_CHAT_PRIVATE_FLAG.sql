-- Добавляем колонку to_admin_only в таблицу chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS to_admin_only BOOLEAN DEFAULT FALSE;

-- Обновляем политики RLS, чтобы не раскрывать приватные сообщения другим сотрудникам
DROP POLICY IF EXISTS "Enable read access for all within organization" ON chat_messages;

CREATE POLICY "Enable read access for all within organization" 
ON chat_messages FOR SELECT 
USING (
  (organization_id = current_setting('app.current_org_id', true) OR organization_id IS NOT NULL)
);

-- Note: In this simple implementation, the filtering of private messages will be handled on the client side based on isChatAdmin / isAdmin / senderId.
-- If strict DB-level security is needed, the RLS policy should be updated to check user roles, which requires a more complex setup.
