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
    lastDate DATE not null,
    publishDate DATE not null,
    tenderURL TEXT not null,
    phone VARCHAR(1024) null,
    status tinyint(1) default 1,
    requirements LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_tender_dates ON tenders(lastDate, publishDate);
CREATE INDEX idx_tender_status ON tenders(status);
CREATE INDEX idx_tender_title ON tenders(title(255));
CREATE INDEX idx_tender_summary ON tenders(aiml_summary(255));
