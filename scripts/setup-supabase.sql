-- FixHive Supabase Schema Setup
-- Run this script in your Supabase SQL Editor

-- ===========================================
-- Enable Required Extensions
-- ===========================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- Main Knowledge Entries Table
-- ===========================================

CREATE TABLE IF NOT EXISTS knowledge_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Error identification
    error_hash TEXT NOT NULL,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    error_stack TEXT,

    -- Context
    language TEXT NOT NULL,
    framework TEXT,
    dependencies JSONB,

    -- Embedding for semantic search (OpenAI text-embedding-3-small: 1536 dimensions)
    embedding vector(1536),

    -- Resolution
    resolution_description TEXT NOT NULL,
    resolution_code TEXT,
    resolution_steps JSONB,

    -- Metadata
    contributor_id TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Quality control
    is_verified BOOLEAN DEFAULT FALSE,
    report_count INTEGER DEFAULT 0
);

-- ===========================================
-- Indexes
-- ===========================================

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_error_hash ON knowledge_entries(error_hash);
CREATE INDEX IF NOT EXISTS idx_knowledge_language ON knowledge_entries(language);
CREATE INDEX IF NOT EXISTS idx_knowledge_framework ON knowledge_entries(framework);
CREATE INDEX IF NOT EXISTS idx_knowledge_contributor ON knowledge_entries(contributor_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge_entries(created_at DESC);

-- Vector similarity search index (IVFFlat for better performance)
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge_entries
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ===========================================
-- Usage Logs Table
-- ===========================================

CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_id UUID REFERENCES knowledge_entries(id) ON DELETE SET NULL,
    action TEXT NOT NULL,  -- 'view', 'apply', 'upvote', 'downvote'
    user_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_knowledge ON usage_logs(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_usage_action ON usage_logs(action);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_logs(created_at DESC);

-- ===========================================
-- Duplicate Candidates Table (for manual review)
-- ===========================================

CREATE TABLE IF NOT EXISTS duplicate_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_id UUID REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    duplicate_id UUID REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    similarity_score FLOAT NOT NULL,
    status TEXT DEFAULT 'pending',  -- 'pending', 'merged', 'kept_separate'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on duplicate_candidates (admin-only table)
ALTER TABLE duplicate_candidates ENABLE ROW LEVEL SECURITY;

-- Only service role can access duplicate_candidates (not exposed to public)
-- No policies for anon = no public access
CREATE POLICY "Service role full access to duplicate_candidates"
ON duplicate_candidates FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ===========================================
-- Functions
-- ===========================================

-- Search for similar errors using vector similarity
CREATE OR REPLACE FUNCTION search_similar_errors(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_language TEXT DEFAULT NULL,
    filter_framework TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    error_hash TEXT,
    error_type TEXT,
    error_message TEXT,
    error_stack TEXT,
    language TEXT,
    framework TEXT,
    resolution_description TEXT,
    resolution_code TEXT,
    resolution_steps JSONB,
    contributor_id TEXT,
    upvotes INTEGER,
    downvotes INTEGER,
    usage_count INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_verified BOOLEAN,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ke.id,
        ke.error_hash,
        ke.error_type,
        ke.error_message,
        ke.error_stack,
        ke.language,
        ke.framework,
        ke.resolution_description,
        ke.resolution_code,
        ke.resolution_steps,
        ke.contributor_id,
        ke.upvotes,
        ke.downvotes,
        ke.usage_count,
        ke.created_at,
        ke.updated_at,
        ke.is_verified,
        1 - (ke.embedding <=> query_embedding) AS similarity
    FROM knowledge_entries ke
    WHERE
        ke.embedding IS NOT NULL
        AND 1 - (ke.embedding <=> query_embedding) > match_threshold
        AND (filter_language IS NULL OR ke.language = filter_language)
        AND (filter_framework IS NULL OR ke.framework = filter_framework)
        AND ke.report_count < 5  -- Exclude heavily reported entries
    ORDER BY
        similarity DESC,
        ke.upvotes DESC,
        ke.usage_count DESC
    LIMIT match_count;
END;
$$;

-- Check for duplicate entries before insert
CREATE OR REPLACE FUNCTION check_duplicate_entry(
    new_hash TEXT,
    new_embedding vector(1536),
    similarity_threshold FLOAT DEFAULT 0.95
)
RETURNS TABLE (
    is_duplicate BOOLEAN,
    existing_id UUID,
    similarity_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    found_record RECORD;
BEGIN
    -- First check by exact hash
    SELECT ke.id INTO found_record
    FROM knowledge_entries ke
    WHERE ke.error_hash = new_hash
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT TRUE, found_record.id, 1.0::FLOAT;
        RETURN;
    END IF;

    -- Then check by embedding similarity
    SELECT
        ke.id,
        1 - (ke.embedding <=> new_embedding) AS sim
    INTO found_record
    FROM knowledge_entries ke
    WHERE
        ke.embedding IS NOT NULL
        AND 1 - (ke.embedding <=> new_embedding) > similarity_threshold
    ORDER BY sim DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT TRUE, found_record.id, found_record.sim;
        RETURN;
    END IF;

    -- No duplicate found
    RETURN QUERY SELECT FALSE, NULL::UUID, 0.0::FLOAT;
END;
$$;

-- Increment vote count
CREATE OR REPLACE FUNCTION increment_vote(
    entry_id UUID,
    vote_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF vote_type = 'upvotes' THEN
        UPDATE knowledge_entries
        SET upvotes = upvotes + 1, updated_at = NOW()
        WHERE id = entry_id;
    ELSIF vote_type = 'downvotes' THEN
        UPDATE knowledge_entries
        SET downvotes = downvotes + 1, updated_at = NOW()
        WHERE id = entry_id;
    END IF;
END;
$$;

-- Increment usage count
CREATE OR REPLACE FUNCTION increment_usage_count(
    entry_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE knowledge_entries
    SET usage_count = usage_count + 1, updated_at = NOW()
    WHERE id = entry_id;
END;
$$;

-- ===========================================
-- Row Level Security
-- ===========================================

ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can read knowledge entries
CREATE POLICY "Knowledge entries are viewable by everyone"
ON knowledge_entries FOR SELECT
USING (true);

-- Anyone can insert knowledge entries (anonymous contributions)
CREATE POLICY "Anyone can insert knowledge"
ON knowledge_entries FOR INSERT
WITH CHECK (true);

-- Contributors can update their own entries
CREATE POLICY "Contributors can update own entries"
ON knowledge_entries FOR UPDATE
USING (contributor_id = current_setting('app.contributor_id', true));

-- Anyone can read usage logs
CREATE POLICY "Usage logs are viewable by everyone"
ON usage_logs FOR SELECT
USING (true);

-- Anyone can insert usage logs
CREATE POLICY "Anyone can insert usage logs"
ON usage_logs FOR INSERT
WITH CHECK (true);

-- ===========================================
-- Triggers
-- ===========================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER knowledge_entries_updated_at
    BEFORE UPDATE ON knowledge_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- Initial Data (Optional)
-- ===========================================

-- You can add seed data here if needed
-- INSERT INTO knowledge_entries (...) VALUES (...);

-- ===========================================
-- Security: Vote Records Table (중복 투표 방지)
-- ===========================================

CREATE TABLE IF NOT EXISTS vote_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_id UUID REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    user_hash TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(knowledge_id, user_hash)
);

CREATE INDEX IF NOT EXISTS idx_vote_knowledge ON vote_records(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_vote_user ON vote_records(user_hash);

ALTER TABLE vote_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vote records are viewable by everyone"
ON vote_records FOR SELECT USING (true);

CREATE POLICY "Anyone can insert vote records"
ON vote_records FOR INSERT WITH CHECK (true);

-- ===========================================
-- Security: Rate Limiting Function
-- ===========================================

CREATE OR REPLACE FUNCTION check_insert_rate_limit(p_contributor_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    hourly_count INTEGER;
    daily_count INTEGER;
BEGIN
    -- 시간당 10개 제한
    SELECT COUNT(*) INTO hourly_count
    FROM knowledge_entries
    WHERE contributor_id = p_contributor_id
      AND created_at > NOW() - INTERVAL '1 hour';

    IF hourly_count >= 10 THEN
        RETURN FALSE;
    END IF;

    -- 일일 50개 제한
    SELECT COUNT(*) INTO daily_count
    FROM knowledge_entries
    WHERE contributor_id = p_contributor_id
      AND created_at > NOW() - INTERVAL '1 day';

    IF daily_count >= 50 THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- 기존 정책 삭제 후 Rate Limited 정책 적용
DROP POLICY IF EXISTS "Anyone can insert knowledge" ON knowledge_entries;

CREATE POLICY "Rate limited knowledge inserts"
ON knowledge_entries FOR INSERT
WITH CHECK (check_insert_rate_limit(contributor_id));

-- ===========================================
-- Security: Input Validation Trigger
-- ===========================================

CREATE OR REPLACE FUNCTION validate_knowledge_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- 필수 필드 검증
    IF NEW.error_message IS NULL OR trim(NEW.error_message) = '' THEN
        RAISE EXCEPTION 'error_message is required';
    END IF;

    IF NEW.resolution_description IS NULL OR trim(NEW.resolution_description) = '' THEN
        RAISE EXCEPTION 'resolution_description is required';
    END IF;

    IF NEW.contributor_id IS NULL OR trim(NEW.contributor_id) = '' THEN
        RAISE EXCEPTION 'contributor_id is required';
    END IF;

    -- 길이 제한
    IF length(NEW.error_message) > 5000 THEN
        RAISE EXCEPTION 'error_message too long (max 5000 chars)';
    END IF;

    IF NEW.error_stack IS NOT NULL AND length(NEW.error_stack) > 10000 THEN
        RAISE EXCEPTION 'error_stack too long (max 10000 chars)';
    END IF;

    IF length(NEW.resolution_description) > 10000 THEN
        RAISE EXCEPTION 'resolution_description too long (max 10000 chars)';
    END IF;

    IF NEW.resolution_code IS NOT NULL AND length(NEW.resolution_code) > 20000 THEN
        RAISE EXCEPTION 'resolution_code too long (max 20000 chars)';
    END IF;

    -- 악성 콘텐츠 패턴 차단
    IF NEW.error_message ~* '<script|javascript:|data:text/html|onclick=|onerror=' THEN
        RAISE EXCEPTION 'Potentially malicious content in error_message';
    END IF;

    IF NEW.resolution_description ~* '<script|javascript:|data:text/html|onclick=|onerror=' THEN
        RAISE EXCEPTION 'Potentially malicious content in resolution_description';
    END IF;

    IF NEW.resolution_code IS NOT NULL AND
       NEW.resolution_code ~* 'eval\s*\(|document\.write|innerHTML\s*=' THEN
        -- 코드 필드는 좀 더 관대하게, 명백한 악성 패턴만 차단
        RAISE EXCEPTION 'Potentially dangerous code pattern detected';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_knowledge_before_insert ON knowledge_entries;
CREATE TRIGGER validate_knowledge_before_insert
    BEFORE INSERT ON knowledge_entries
    FOR EACH ROW
    EXECUTE FUNCTION validate_knowledge_entry();

-- ===========================================
-- Security: Safe Vote Function (중복 방지)
-- ===========================================

CREATE OR REPLACE FUNCTION safe_vote(
    p_entry_id UUID,
    p_user_hash TEXT,
    p_vote_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    existing_vote TEXT;
BEGIN
    -- 입력 검증
    IF p_vote_type NOT IN ('up', 'down') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid vote type');
    END IF;

    -- 기존 투표 확인
    SELECT vote_type INTO existing_vote
    FROM vote_records
    WHERE knowledge_id = p_entry_id AND user_hash = p_user_hash;

    IF existing_vote IS NOT NULL THEN
        IF existing_vote = p_vote_type THEN
            RETURN jsonb_build_object('success', false, 'error', 'Already voted');
        ELSE
            -- 투표 변경: 기존 투표 취소 후 새 투표
            UPDATE vote_records
            SET vote_type = p_vote_type, created_at = NOW()
            WHERE knowledge_id = p_entry_id AND user_hash = p_user_hash;

            IF p_vote_type = 'up' THEN
                UPDATE knowledge_entries
                SET upvotes = upvotes + 1, downvotes = GREATEST(downvotes - 1, 0)
                WHERE id = p_entry_id;
            ELSE
                UPDATE knowledge_entries
                SET downvotes = downvotes + 1, upvotes = GREATEST(upvotes - 1, 0)
                WHERE id = p_entry_id;
            END IF;

            RETURN jsonb_build_object('success', true, 'action', 'changed');
        END IF;
    END IF;

    -- 새 투표 기록
    INSERT INTO vote_records (knowledge_id, user_hash, vote_type)
    VALUES (p_entry_id, p_user_hash, p_vote_type);

    -- 카운트 업데이트
    IF p_vote_type = 'up' THEN
        UPDATE knowledge_entries SET upvotes = upvotes + 1 WHERE id = p_entry_id;
    ELSE
        UPDATE knowledge_entries SET downvotes = downvotes + 1 WHERE id = p_entry_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'action', 'voted');
END;
$$;

-- ===========================================
-- Security: Report Function
-- ===========================================

CREATE OR REPLACE FUNCTION report_entry(
    p_entry_id UUID,
    p_user_hash TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    -- 신고 횟수 증가
    UPDATE knowledge_entries
    SET report_count = report_count + 1
    WHERE id = p_entry_id;

    -- 로그 기록
    INSERT INTO usage_logs (knowledge_id, action, user_hash)
    VALUES (p_entry_id, 'report', p_user_hash);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ===========================================
-- Grants for anon role (Supabase anonymous access)
-- ===========================================

GRANT SELECT ON knowledge_entries TO anon;
GRANT INSERT ON knowledge_entries TO anon;
GRANT SELECT ON usage_logs TO anon;
GRANT INSERT ON usage_logs TO anon;
GRANT SELECT ON vote_records TO anon;
GRANT INSERT ON vote_records TO anon;
GRANT EXECUTE ON FUNCTION search_similar_errors TO anon;
GRANT EXECUTE ON FUNCTION check_duplicate_entry TO anon;
GRANT EXECUTE ON FUNCTION increment_vote TO anon;
GRANT EXECUTE ON FUNCTION increment_usage_count TO anon;
GRANT EXECUTE ON FUNCTION check_insert_rate_limit TO anon;
GRANT EXECUTE ON FUNCTION safe_vote TO anon;
GRANT EXECUTE ON FUNCTION report_entry TO anon;
