-- schema.sql
CREATE DATABASE IF NOT EXISTS tender_scraper;
USE tender_scraper;

-- Create tenders table

CREATE TABLE IF NOT EXISTS tenders (
    tenderid int PRIMARY KEY,
    title TEXT NOT NULL not null,
    raw_description LONGTEXT null,
    aiml_summary TEXT null,
    email VARCHAR(1024) null,
    lastDate DATETIME not null,
    publishDate DATETIME not null,
    tenderURL TEXT not null,
    phone VARCHAR(1024) null,
    status tinyint(1) default 1,
    requirements LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_tender_dates ON tenders(lastDate, publishDate);
CREATE INDEX idx_tender_status ON tenders(status);
