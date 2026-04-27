-- Schema for Electronic Performance Monitoring (Mapped from Excel)

-- Employees table (Mapped from employee_ids.xlsx)
CREATE TABLE IF NOT EXISTS employees (
  emp_id TEXT PRIMARY KEY, -- 'ID' in excel
  full_name TEXT NOT NULL, -- 'Full_Name'
  email TEXT NOT NULL, -- 'Email'
  sap_id TEXT NOT NULL UNIQUE, -- 'SAP'
  password_hash TEXT NOT NULL, -- 'Pwd'
  client INTEGER, -- 'Client'
  log_pass TEXT, -- 'LogPass'
  manager_id TEXT, -- 'MGID'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SAP Orders table (Mapped from sap_data.xlsx)
CREATE TABLE IF NOT EXISTS sap_orders (
  sales_doc TEXT PRIMARY KEY, -- 'Sales Doc.'
  order_status TEXT, -- 'OS'
  net_value DECIMAL(12,2), -- 'Net Value'
  currency TEXT, -- 'Curr.'
  cust_ref_date DATE, -- 'CustRefDat'
  created_on DATE, -- 'Created On' (first instance)
  created_time TIME, -- 'Time' (first instance)
  created_by_sap_id TEXT REFERENCES employees(sap_id), -- 'Created By' (first instance)
  delivery TEXT, -- 'Delivery'
  delivery_status TEXT, -- 'DS'
  delivery_created_by TEXT, -- 'Created By' (second instance)
  delivery_time TIME, -- 'Time' (second instance)
  delivery_created_on DATE, -- 'Created On' (second instance)
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Work Logs table (Mapped from work_logs_*.xlsx)
CREATE TABLE IF NOT EXISTS work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITHOUT TIME ZONE, -- 'Timestamp'
  event_type TEXT NOT NULL, -- 'Event_Type'
  details TEXT, -- 'Details'
  emp_id TEXT REFERENCES employees(emp_id), -- 'User'
  session_id TEXT, -- 'Session_ID'
  severity TEXT, -- 'Severity'
  is_fraud BOOLEAN, -- 'IsFraud'
  module TEXT, -- 'Module'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_sap_orders_created_by ON sap_orders(created_by_sap_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_emp_id ON work_logs(emp_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_timestamp ON work_logs(timestamp);
