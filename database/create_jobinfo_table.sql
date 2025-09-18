-- Create JOBINFO table in ofasp database
-- Database: ofasp
-- Schema: aspuser

-- Drop table if exists (for clean setup)
DROP TABLE IF EXISTS aspuser.jobinfo CASCADE;

-- Create JOBINFO table
CREATE TABLE aspuser.jobinfo (
    jobid   CHAR(17) PRIMARY KEY,
    jobname CHAR(36) NOT NULL,
    status  CHAR(9) NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'ERROR', 'HELD', 'CANCELLED')),
    "user"  CHAR(16) NOT NULL DEFAULT 'aspuser',
    sbmdt   CHAR(19) NOT NULL -- format: yyyy-mm-dd hh:mm:ss
);

-- Create indexes for better query performance
CREATE INDEX idx_jobinfo_status ON aspuser.jobinfo(status);
CREATE INDEX idx_jobinfo_sbmdt ON aspuser.jobinfo(sbmdt);
CREATE INDEX idx_jobinfo_user ON aspuser.jobinfo("user");

-- Grant permissions to aspuser
GRANT ALL PRIVILEGES ON TABLE aspuser.jobinfo TO aspuser;

-- Add comment to table
COMMENT ON TABLE aspuser.jobinfo IS 'OpenASP Job Information table for tracking submitted jobs';
COMMENT ON COLUMN aspuser.jobinfo.jobid IS 'Unique job identifier (format: J + timestamp + hash)';
COMMENT ON COLUMN aspuser.jobinfo.jobname IS 'User-defined job name';
COMMENT ON COLUMN aspuser.jobinfo.status IS 'Current job status';
COMMENT ON COLUMN aspuser.jobinfo."user" IS 'User who submitted the job';
COMMENT ON COLUMN aspuser.jobinfo.sbmdt IS 'Job submission date and time';