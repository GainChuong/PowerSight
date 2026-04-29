"""
generate_supabase_data.py (SAP Lifecycle Mode)
Tạo dữ liệu SAP với định dạng mã chuẩn (4 số) và vòng đời (A -> B -> C)
- Sales Doc: 4 chữ số (1000-9999)
- Delivery: 8 chữ số (8000xxxx)
- OS: Tiến triển từ A -> B -> C
"""

import os
import bcrypt
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import warnings
from dotenv import load_dotenv
from supabase import create_client, Client

warnings.filterwarnings('ignore')
load_dotenv()

SUPABASE_URL = "https://chornvckgdhojcbmtuoy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3JudmNrZ2Rob2pjYm10dW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODExMTYsImV4cCI6MjA5MjM1NzExNn0.yIipE9rUP4A6k9EBy23k02IpJ-Ky_7WLWJUz4Tgs3QA"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

EMPLOYEES = ["EM001", "EM002", "EM003", "EM004"]
EMPLOYEE_LEVEL = {"EM001": "HIGH", "EM002": "LOW", "EM003": "MEDIUM", "EM004": "MEDIUM"}
CREATED_BY_MAP = {"EM001": "LEARN-717", "EM002": "LEARN-727", "EM003": "LEARN-757", "EM004": "LEARN-724"}
YEARS = [2024, 2025, 2026]
MONTHS = range(1, 13)

EMPLOYEES_DATA = [
    {"emp_id": "EM001", "full_name": "Nguyễn Thị Giang", "email": "giang.nguyen@company.com", "sap_id": "LEARN-717"},
    {"emp_id": "EM002", "full_name": "Trần Thị Nhi", "email": "nhi.tran@company.com", "sap_id": "LEARN-727"},
    {"emp_id": "EM003", "full_name": "Phạm Thị Thu", "email": "thu.pham@company.com", "sap_id": "LEARN-757"},
    {"emp_id": "EM004", "full_name": "Lê Thị Kha", "email": "kha.le@company.com", "sap_id": "LEARN-724"}
]

DEFAULT_PASSWORD = "123456"

def get_employee_config(emp_id: str) -> dict:
    level = EMPLOYEE_LEVEL[emp_id]
    if level == "HIGH":
        return {"transactions_per_month": (90, 130), "net_value_range": (15000, 60000), "kpi_range": (90, 120), "fraud_events_range": (8, 16), "mouse_sessions_per_month": (15, 25), "mouse_anomaly_score": (0.05, 0.20), "work_sessions": 20, "hours_per_day": (7.5, 8.5), "browser_sessions_per_day": (1, 2)}
    elif level == "MEDIUM":
        return {"transactions_per_month": (60, 100), "net_value_range": (8000, 35000), "kpi_range": (70, 100), "fraud_events_range": (12, 22), "mouse_sessions_per_month": (10, 20), "mouse_anomaly_score": (0.20, 0.40), "work_sessions": 18, "hours_per_day": (5.5, 6.5), "browser_sessions_per_day": (1, 2)}
    else:  # LOW
        return {"transactions_per_month": (40, 70), "net_value_range": (3000, 20000), "kpi_range": (50, 80), "fraud_events_range": (25, 40), "mouse_sessions_per_month": (5, 12), "mouse_anomaly_score": (0.40, 0.65), "work_sessions": 14, "hours_per_day": (4.0, 5.5), "browser_sessions_per_day": (1, 2)}

def random_datetime(year, month, start_hour=8, end_hour=20):
    days = 31 if month == 12 else (datetime(year, month + 1, 1) - timedelta(days=1)).day
    return datetime(year, month, random.randint(1, days), random.randint(start_hour, end_hour), random.randint(0, 59), random.randint(0, 59))

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

def generate_all_data():
    print("STARTING DATA GENERATION (SAP LIFECYCLE MODE)...")
    
    # Update Employees
    pwd_hash = hash_password(DEFAULT_PASSWORD)
    for emp in EMPLOYEES_DATA:
        supabase.table("employees").upsert({**emp, "password_hash": pwd_hash}).execute()

    bulk_data = {k: [] for k in ["browser_sessions", "sap_reality", "kpi_data", "fraud_events", "mouse_details", "login_data"]}
    
    for emp_id in EMPLOYEES:
        level = EMPLOYEE_LEVEL[emp_id]
        config = get_employee_config(emp_id)
        created_by = CREATED_BY_MAP[emp_id]
        
        for year in YEARS:
            for month in MONTHS:
                # 1. Browser Sessions
                month_sessions = []
                for day in range(1, config["work_sessions"] + 1):
                    for s in range(random.randint(*config["browser_sessions_per_day"])):
                        ts = random_datetime(year, month)
                        sid = f"SESS_{emp_id}_{ts.strftime('%Y%m%d%H%M%S')}_{s}"
                        bulk_data["browser_sessions"].append({"emp_id": emp_id, "year": year, "month": month, "session_id": sid, "session_start": ts.isoformat(), "session_end": (ts + timedelta(hours=2)).isoformat(), "total_seconds": 7200, "total_time": "02:00:00", "module": "Browser"})
                        month_sessions.append(sid)
                
                # 2. SAP Reality Lifecycle (MATCHING THE IMAGE)
                n_orders = random.randint(*config["transactions_per_month"]) // 2 # Chia 2 vì mỗi order tạo nhiều dòng
                completed_orders = 0
                for _ in range(n_orders):
                    sd = str(random.randint(1000, 9999)) # 4-digit Sales Doc
                    base_dt = random_datetime(year, month)
                    net_value = round(random.uniform(*config["net_value_range"]), 2)
                    
                    # Dòng 1: Luôn là OS = 'A'
                    bulk_data["sap_reality"].append({
                        "emp_id": emp_id, "year": year, "month": month, "sales_doc": sd, "os": 'A', 
                        "net_value": net_value, "curr": "USD", "cust_ref_date": base_dt.date().isoformat(), 
                        "created_on": base_dt.date().isoformat(), "created_time": base_dt.time().strftime("%H:%M:%S"), 
                        "created_by": created_by
                    })
                    
                    # Dòng 2+: Có thể là 'B' hoặc kết thúc bằng 'C'
                    r = random.random()
                    if r < 0.7: # 70% cơ hội tiến tới B hoặc C
                        if random.random() < 0.4: # Thêm trạng thái trung gian B
                             bulk_data["sap_reality"].append({
                                "emp_id": emp_id, "year": year, "month": month, "sales_doc": sd, "os": 'B', 
                                "net_value": net_value + random.randint(-500, 500), "curr": "USD", "cust_ref_date": base_dt.date().isoformat(), 
                                "created_on": base_dt.date().isoformat(), "created_time": base_dt.time().strftime("%H:%M:%S"), 
                                "created_by": created_by
                            })
                        
                        # Kết thúc bằng 'C' và có Delivery
                        delivery_id = f"8000{random.randint(1000, 9999)}"
                        ds_val = random.choice(['B', 'C'])
                        if ds_val == 'C': completed_orders += 1
                        
                        bulk_data["sap_reality"].append({
                            "emp_id": emp_id, "year": year, "month": month, "sales_doc": sd, "os": 'C', 
                            "net_value": net_value + random.randint(0, 1000), "curr": "USD", "cust_ref_date": base_dt.date().isoformat(), 
                            "created_on": base_dt.date().isoformat(), "created_time": base_dt.time().strftime("%H:%M:%S"), 
                            "created_by": created_by, "delivery": delivery_id, "ds": ds_val,
                            "proc_created_by": created_by, "proc_time": base_dt.time().strftime("%H:%M:%S"),
                            "proc_created_on": (base_dt + timedelta(days=1)).date().isoformat()
                        })

                bulk_data["kpi_data"].append({"emp_id": emp_id, "year": year, "month": month, "kpi_value": random.randint(max(config["kpi_range"][0], completed_orders), config["kpi_range"][1]), "completed_orders": completed_orders})
                
                # 3. Linked Logs
                if month_sessions:
                    for _ in range(random.randint(*config["fraud_events_range"])):
                        linked_sid = random.choice(month_sessions)
                        severity = random.choices(["CRITICAL", "WARNING"], weights=[0.4, 0.6])[0]
                        bulk_data["fraud_events"].append({
                            "emp_id": emp_id, "year": year, "month": month, 
                            "timestamp": random_datetime(year, month).isoformat(), 
                            "event_type": "SUSPICIOUS", "details": "Detected anomaly", 
                            "session_id": linked_sid, "severity": severity, "is_fraud": 1, 
                            "module": random.choice(["Browser", "Mouse", "Face"])
                        })
                    
                    for sid in random.sample(month_sessions, min(len(month_sessions), random.randint(*config["mouse_sessions_per_month"]))):
                        bulk_data["mouse_details"].append({"emp_id": emp_id, "year": year, "month": month, "timestamp": random_datetime(year, month).isoformat(), "event_type": "MOUSE", "details": "Mouse log", "session_id": sid, "severity": "INFO", "is_fraud": 0, "module": "Mouse", "total_events": 1000, "total_distance": 500.0, "velocity": 50.0, "duration_seconds": 60, "anomaly_score": round(random.uniform(*config["mouse_anomaly_score"]), 3)})
                
                for _ in range(20):
                    bulk_data["login_data"].append({"emp_id": emp_id, "year": year, "month": month, "timestamp": random_datetime(year, month).isoformat(), "success": True, "method": "Password"})

    # Bulk Insert
    order = ["browser_sessions", "sap_reality", "kpi_data", "fraud_events", "mouse_details", "login_data"]
    for table in order:
        data_list = bulk_data[table]
        print(f"Inserting {len(data_list)} into {table}...")
        for i in range(0, len(data_list), 500):
            supabase.table(table).insert(data_list[i:i+500]).execute()

    print("DONE! SAP Lifecycle data initialized.")

if __name__ == "__main__":
    generate_all_data()