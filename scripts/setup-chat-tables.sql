-- Chat Persistence Tables for Geeves Command Center
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Chat Threads
CREATE TABLE IF NOT EXISTS chat_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id TEXT NOT NULL,
    title TEXT DEFAULT 'New conversation',
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_chat_threads_agent ON chat_threads(agent_id, is_archived, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at ASC);

-- 4. Auto-update trigger: bump thread updated_at on new message
CREATE OR REPLACE FUNCTION update_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_threads SET updated_at = now() WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_thread_ts ON chat_messages;
CREATE TRIGGER trg_update_thread_ts
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_timestamp();

-- 5. RLS (single-user app — permissive policies)
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_threads" ON chat_threads
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on chat_messages" ON chat_messages
    FOR ALL USING (true) WITH CHECK (true);
