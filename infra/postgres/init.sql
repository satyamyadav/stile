-- PostgreSQL initialization script for Stile

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create reports table
CREATE TABLE IF NOT EXISTS ds_reports (
    id SERIAL PRIMARY KEY,
    project VARCHAR(255) NOT NULL,
    commit VARCHAR(40) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    version VARCHAR(50) NOT NULL,
    files_scanned INTEGER NOT NULL,
    violations INTEGER NOT NULL,
    adherence_score INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project, commit)
);

-- Create findings table
CREATE TABLE IF NOT EXISTS ds_findings (
    id SERIAL PRIMARY KEY,
    project VARCHAR(255) NOT NULL,
    rule VARCHAR(255) NOT NULL,
    file TEXT NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(10) NOT NULL,
    line INTEGER,
    column INTEGER,
    commit VARCHAR(40),
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project, rule, file, line, column)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ds_reports_project ON ds_reports(project);
CREATE INDEX IF NOT EXISTS idx_ds_reports_timestamp ON ds_reports(timestamp);
CREATE INDEX IF NOT EXISTS idx_ds_findings_project ON ds_findings(project);
CREATE INDEX IF NOT EXISTS idx_ds_findings_rule ON ds_findings(rule);
CREATE INDEX IF NOT EXISTS idx_ds_findings_severity ON ds_findings(severity);
CREATE INDEX IF NOT EXISTS idx_ds_findings_timestamp ON ds_findings(timestamp);

-- Create views for analytics
CREATE OR REPLACE VIEW daily_adherence AS
SELECT
    project,
    DATE(timestamp) as date,
    AVG(adherence_score) as avg_score,
    SUM(violations) as total_violations,
    SUM(files_scanned) as total_files
FROM ds_reports
GROUP BY project, DATE(timestamp);

CREATE OR REPLACE VIEW rule_violations AS
SELECT
    project,
    rule,
    DATE(timestamp) as date,
    COUNT(*) as violation_count
FROM ds_findings
GROUP BY project, rule, DATE(timestamp);

-- Create function to get adherence trends
CREATE OR REPLACE FUNCTION get_adherence_trends(
    project_name VARCHAR(255),
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    date DATE,
    adherence_score NUMERIC,
    violations INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE(r.timestamp) as date,
        AVG(r.adherence_score) as adherence_score,
        SUM(r.violations) as violations
    FROM ds_reports r
    WHERE r.project = project_name
        AND r.timestamp >= CURRENT_DATE - INTERVAL '1 day' * days_back
    GROUP BY DATE(r.timestamp)
    ORDER BY date;
END;
$$ LANGUAGE plpgsql;
