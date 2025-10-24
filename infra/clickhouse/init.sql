-- ClickHouse initialization script for Stile

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS stile;

-- Use the database
USE stile;

-- Create reports table
CREATE TABLE IF NOT EXISTS ds_reports (
    project String,
    commit String,
    timestamp DateTime,
    version String,
    files_scanned UInt32,
    violations UInt32,
    adherence_score UInt8,
    duration UInt32
) ENGINE = MergeTree()
ORDER BY (project, commit, timestamp);

-- Create findings table
CREATE TABLE IF NOT EXISTS ds_findings (
    project String,
    rule String,
    file String,
    message String,
    severity String,
    line Nullable(UInt32),
    column Nullable(UInt32),
    commit Nullable(String),
    timestamp DateTime
) ENGINE = MergeTree()
ORDER BY (project, rule, timestamp);

-- Create materialized view for daily adherence scores
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_adherence
ENGINE = SummingMergeTree()
ORDER BY (project, date)
AS SELECT
    project,
    toDate(timestamp) as date,
    avg(adherence_score) as avg_score,
    sum(violations) as total_violations,
    sum(files_scanned) as total_files
FROM ds_reports
GROUP BY project, date;

-- Create materialized view for rule violations
CREATE MATERIALIZED VIEW IF NOT EXISTS rule_violations
ENGINE = SummingMergeTree()
ORDER BY (project, rule, date)
AS SELECT
    project,
    rule,
    toDate(timestamp) as date,
    count() as violation_count
FROM ds_findings
GROUP BY project, rule, date;
