-- ============================================
-- ASP Terminal Session Management Table DDL
-- Database: PostgreSQL 15+
-- Schema: aspuser
-- Created: 2025-09-13
-- Purpose: OpenASP AX Terminal Session Management
-- ============================================

-- 1. 스키마 생성 (필요한 경우)
CREATE SCHEMA IF NOT EXISTS aspuser;

-- 2. 트리거 함수 생성
CREATE OR REPLACE FUNCTION aspuser.update_asp_terminal_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$;

-- 3. asp_terminal 테이블 생성 (기존 테이블이 있으면 DROP)
DROP TABLE IF EXISTS aspuser.asp_terminal CASCADE;

CREATE TABLE aspuser.asp_terminal (
    wsname        VARCHAR(8) NOT NULL,
    username      VARCHAR(16) NOT NULL,
    conn_time     VARCHAR(19) NOT NULL,
    status        CHAR(1) NOT NULL DEFAULT '0',
    terminal_id   VARCHAR(16),
    session_id    VARCHAR(64),
    display_mode  VARCHAR(16) DEFAULT 'legacy',
    encoding      VARCHAR(16) DEFAULT 'sjis',
    last_activity TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    login_time    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    properties    TEXT DEFAULT '{}',
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT asp_terminal_pkey PRIMARY KEY (wsname)
);

-- 4. 인덱스 생성
CREATE INDEX idx_asp_terminal_username ON aspuser.asp_terminal (username);
CREATE INDEX idx_asp_terminal_status ON aspuser.asp_terminal (status);
CREATE INDEX idx_asp_terminal_conn_time ON aspuser.asp_terminal (conn_time);
CREATE INDEX idx_asp_terminal_last_activity ON aspuser.asp_terminal (last_activity);

-- 5. 트리거 생성
CREATE TRIGGER asp_terminal_updated_at_trigger
    BEFORE UPDATE ON aspuser.asp_terminal
    FOR EACH ROW
    EXECUTE FUNCTION aspuser.update_asp_terminal_updated_at();

-- 6. 테이블 소유자 설정
ALTER TABLE aspuser.asp_terminal OWNER TO aspuser;

-- 7. 코멘트 추가
COMMENT ON TABLE aspuser.asp_terminal IS 'ASP Terminal Session Management Table';
COMMENT ON COLUMN aspuser.asp_terminal.wsname IS 'Workstation Name (Primary Key)';
COMMENT ON COLUMN aspuser.asp_terminal.username IS 'Username';
COMMENT ON COLUMN aspuser.asp_terminal.conn_time IS 'Connection Time (YYYY/MM/DD-HH:MM:SS)';
COMMENT ON COLUMN aspuser.asp_terminal.status IS 'Status (0:Inactive, 1:Active)';
COMMENT ON COLUMN aspuser.asp_terminal.terminal_id IS 'Terminal ID';
COMMENT ON COLUMN aspuser.asp_terminal.session_id IS 'Session ID';
COMMENT ON COLUMN aspuser.asp_terminal.display_mode IS 'Display Mode (legacy/web)';
COMMENT ON COLUMN aspuser.asp_terminal.encoding IS 'Character Encoding (sjis/utf8)';
COMMENT ON COLUMN aspuser.asp_terminal.last_activity IS 'Last Activity Timestamp';
COMMENT ON COLUMN aspuser.asp_terminal.login_time IS 'Login Timestamp';
COMMENT ON COLUMN aspuser.asp_terminal.properties IS 'Additional Properties (JSON)';
COMMENT ON COLUMN aspuser.asp_terminal.created_at IS 'Record Creation Timestamp';
COMMENT ON COLUMN aspuser.asp_terminal.updated_at IS 'Record Update Timestamp';

-- 8. 샘플 데이터 삽입 (테스트용)
INSERT INTO aspuser.asp_terminal (wsname, username, conn_time, status, terminal_id, session_id, display_mode, encoding) VALUES
('WSNAME00', 'admin', '2025/09/13-12:00:00', '1', 'webui', 'ws_WSNAME00_sample001', 'web', 'utf8'),
('DEMO001', 'demo', '2025/09/13-12:30:00', '0', 'webui', 'ws_DEMO001_sample002', 'legacy', 'sjis'),
('TEST001', 'testuser', '2025/09/13-13:00:00', '1', 'webui', 'ws_TEST001_sample003', 'web', 'utf8');

-- ============================================
-- 데이터 검증 쿼리 (실행 시 주석 해제)
-- ============================================

-- 테이블 구조 확인
-- \d+ aspuser.asp_terminal

-- 샘플 데이터 조회
-- SELECT * FROM aspuser.asp_terminal ORDER BY created_at;

-- 활성 세션 조회
-- SELECT wsname, username, status, last_activity 
-- FROM aspuser.asp_terminal 
-- WHERE status = '1' 
-- ORDER BY last_activity DESC;

-- ============================================
-- 운영 관리 쿼리 (참고용)
-- ============================================

-- 1. 비활성 세션 정리 (30분 이상 비활성)
-- UPDATE aspuser.asp_terminal 
-- SET status = '0' 
-- WHERE status = '1' 
--   AND last_activity < NOW() - INTERVAL '30 minutes';

-- 2. 오래된 세션 레코드 삭제 (7일 이상)
-- DELETE FROM aspuser.asp_terminal 
-- WHERE status = '0' 
--   AND updated_at < NOW() - INTERVAL '7 days';

-- 3. 세션 통계 조회
-- SELECT 
--     status,
--     COUNT(*) as count,
--     MAX(last_activity) as latest_activity
-- FROM aspuser.asp_terminal 
-- GROUP BY status;

-- ============================================
-- 실행 완료 확인
-- ============================================
SELECT 'asp_terminal table creation completed successfully' AS result;
SELECT COUNT(*) as initial_records FROM aspuser.asp_terminal;