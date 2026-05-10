-- Table for Business Report Processing
CREATE TABLE IF NOT EXISTS business_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id TEXT REFERENCES employees(emp_id),
  report_name TEXT NOT NULL,
  processing_time_sec INTEGER, -- how long they took to process this specific report
  error_count INTEGER DEFAULT 0, -- concrete metric for accuracy
  status TEXT, -- 'completed', 'late', 'pending'
  profit_generated DECIMAL(12,2),
  year INTEGER,
  month INTEGER,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_business_reports_emp_id ON business_reports(emp_id);
CREATE INDEX IF NOT EXISTS idx_business_reports_date ON business_reports(year, month);

-- RLS
ALTER TABLE business_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on business_reports" ON business_reports FOR SELECT USING (true);
CREATE POLICY "Allow public insert on business_reports" ON business_reports FOR INSERT WITH CHECK (true);
