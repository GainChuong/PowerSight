"""
generate_supabase_data_v2.py
Tạo dữ liệu trên Supabase cho 3 nhân viên (EM001 giỏi, EM002 khá, EM003 trung bình)
- Bảng employees (không password)
- Bảng reports (id báo cáo, trạng thái)
- Bảng kpi_data (chỉ số hoàn thành theo tháng)
- Bảng work logs (fraud_events, mouse_details, browser_sessions, login_data)
- Thời gian: năm 2025 và 2026 đến hết tháng 4
"""


from datetime import datetime, timedelta
import random
import warnings
from dotenv import load_dotenv
from supabase import create_client, Client
import bcrypt

warnings.filterwarnings('ignore')

load_dotenv()

# ============================================
# CẤU HÌNH SUPABASE
# ============================================
SUPABASE_URL = "https://chornvckgdhojcbmtuoy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3JudmNrZ2Rob2pjYm10dW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODExMTYsImV4cCI6MjA5MjM1NzExNn0.yIipE9rUP4A6k9EBy23k02IpJ-Ky_7WLWJUz4Tgs3QA"

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Vui lòng cấu hình SUPABASE_URL và SUPABASE_KEY trong file .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ============================================
# CẤU HÌNH NHÂN VIÊN
# ============================================
EMPLOYEES = [
    {"emp_id": "EM001", "full_name": "Nguyễn Văn Giỏi", "level": "HIGH"},
    {"emp_id": "EM002", "full_name": "Trần Thị Khá", "level": "MEDIUM"},
    {"emp_id": "EM003", "full_name": "Lê Văn Trung", "level": "LOW"}
]

# Cấu hình theo cấp độ
LEVEL_CONFIG = {
    "HIGH": {
        "kpi_rate": 0.90,  # 90% hoàn thành báo cáo
        "max_fraud_per_month": 10,  # <10 fraud events
        "min_hours_per_day": 7.0,  # ít nhất 7 tiếng
        "hours_range": (7.0, 8.5),
        "work_days_per_month": 22,
        "mouse_sessions_range": (70, 100),
        "mouse_anomaly_score": (0.05, 0.20),
        "browser_sessions_per_day": (1, 2),
        "reports_per_month": (90, 130)
    },
    "MEDIUM": {
        "kpi_rate": 0.70,
        "max_fraud_per_month": 15,
        "min_hours_per_day": 6.0,
        "hours_range": (6.0, 7.5),
        "work_days_per_month": 20,
        "mouse_sessions_range": (50, 80),
        "mouse_anomaly_score": (0.20, 0.40),
        "browser_sessions_per_day": (1, 2),
        "reports_per_month": (60, 100)
    },
    "LOW": {
        "kpi_rate": 0.50,
        "max_fraud_per_month": 20,
        "min_hours_per_day": 5.0,
        "hours_range": (5.0, 6.5),
        "work_days_per_month": 18,
        "mouse_sessions_range": (30, 55),
        "mouse_anomaly_score": (0.40, 0.65),
        "browser_sessions_per_day": (1, 2),
        "reports_per_month": (40, 70)
    }
}


# ============================================
# HÀM TIỆN ÍCH
# ============================================
def random_datetime(year, month, day=None, start_hour=8, end_hour=20):
    if day is None:
        if month == 2:
            max_day = 29 if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0) else 28
        elif month in [4, 6, 9, 11]:
            max_day = 30
        else:
            max_day = 31
        day = random.randint(1, max_day)
    hour = random.randint(start_hour, end_hour)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return datetime(year, month, day, hour, minute, second)


def random_date_in_year(year):
    start = datetime(year, 1, 1)
    end = datetime(year, 12, 31) if year < 2026 else datetime(2026, 4, 30)
    delta = (end - start).days
    random_days = random.randint(0, delta)
    return start + timedelta(days=random_days)


# ============================================
# 1. TẠO BẢNG
# ============================================
def create_tables():
    print("📋 Tạo các bảng trong Supabase...")
    sql = """
    -- Bảng employees (không password)
    CREATE TABLE IF NOT EXISTS employees (
        emp_id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        level TEXT NOT NULL,
        password_hash TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Bảng business_reports (thay thế reports)
    CREATE TABLE IF NOT EXISTS business_reports (
        id SERIAL PRIMARY KEY,
        report_id TEXT UNIQUE,
        emp_id TEXT REFERENCES employees(emp_id),
        status VARCHAR(20),
        created_date DATE,
        completed_date DATE,
        year INT,
        month INT,
        error_count INT DEFAULT 0,
        processing_time_sec INT DEFAULT 0,
        report_value NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Bảng kpi_data
    CREATE TABLE IF NOT EXISTS kpi_data (
        id SERIAL PRIMARY KEY,
        emp_id TEXT REFERENCES employees(emp_id),
        year INT,
        month INT,
        total_reports INT,
        completed_reports INT,
        kpi_rate NUMERIC,
        kpi_value NUMERIC,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(emp_id, year, month)
    );

    -- Bảng fraud_events
    CREATE TABLE IF NOT EXISTS fraud_events (
        id SERIAL PRIMARY KEY,
        emp_id TEXT REFERENCES employees(emp_id),
        year INT,
        month INT,
        timestamp TIMESTAMP,
        event_type VARCHAR(50),
        details TEXT,
        session_id VARCHAR(100),
        severity VARCHAR(20),
        is_fraud INT,
        module VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Bảng mouse_details
    CREATE TABLE IF NOT EXISTS mouse_details (
        id SERIAL PRIMARY KEY,
        emp_id TEXT REFERENCES employees(emp_id),
        year INT,
        month INT,
        timestamp TIMESTAMP,
        event_type VARCHAR(50),
        details TEXT,
        session_id VARCHAR(100),
        severity VARCHAR(20),
        is_fraud INT,
        module VARCHAR(20),
        total_events INT,
        total_moves INT,
        total_distance DECIMAL(10,2),
        x_axis_distance DECIMAL(10,2),
        y_axis_distance DECIMAL(10,2),
        x_flips INT,
        y_flips INT,
        movement_time_span DECIMAL(10,2),
        velocity DECIMAL(10,2),
        acceleration DECIMAL(10,2),
        x_velocity DECIMAL(10,2),
        y_velocity DECIMAL(10,2),
        x_acceleration DECIMAL(10,2),
        y_acceleration DECIMAL(10,2),
        duration_seconds DECIMAL(10,2),
        anomaly_score DECIMAL(5,3),
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Bảng browser_sessions
    CREATE TABLE IF NOT EXISTS browser_sessions (
        id SERIAL PRIMARY KEY,
        emp_id TEXT REFERENCES employees(emp_id),
        year INT,
        month INT,
        session_id VARCHAR(100),
        session_start TIMESTAMP,
        session_end TIMESTAMP,
        total_seconds INT,
        total_time VARCHAR(20),
        module VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Bảng login_data
    CREATE TABLE IF NOT EXISTS login_data (
        id SERIAL PRIMARY KEY,
        emp_id TEXT REFERENCES employees(emp_id),
        year INT,
        month INT,
        timestamp TIMESTAMP,
        success BOOLEAN,
        method VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_reports_emp ON business_reports(emp_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_kpi_emp ON kpi_data(emp_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_fraud_emp ON fraud_events(emp_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_mouse_emp ON mouse_details(emp_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_browser_emp ON browser_sessions(emp_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_login_emp ON login_data(emp_id, year, month);
    """
    # SQL logic is handled via apply_migration in this tool context, 
    # but the script prints it for manual use.
    pass


# ============================================
# 2. THÊM NHÂN VIÊN
# ============================================
def insert_employees():
    print("\n📝 Thêm nhân viên...")
    pwd_hash = bcrypt.hashpw("123456".encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')
    for emp in EMPLOYEES:
        data = {
            "emp_id": emp["emp_id"],
            "full_name": emp["full_name"],
            "level": emp["level"],
            "password_hash": pwd_hash
        }
        try:
            supabase.table("employees").upsert(data).execute()
            print(f"   ✅ {emp['emp_id']} - {emp['full_name']}")
        except Exception as e:
            print(f"   ❌ Lỗi: {e}")


# ============================================
# 3. SINH DỮ LIỆU BÁO CÁO (reports)
# ============================================
def generate_reports(emp_id, level, year, month):
    config = LEVEL_CONFIG[level]
    num_reports = random.randint(*config["reports_per_month"])
    kpi_rate = config["kpi_rate"]

    # Xác định số báo cáo hoàn thành dựa trên KPI rate
    num_completed = int(num_reports * kpi_rate)
    num_processing = num_reports - num_completed

    reports = []
    report_counter = 1

    # Tạo báo cáo hoàn thành
    for _ in range(num_completed):
        created_date = random_datetime(year, month, start_hour=8, end_hour=17).date()
        # completed_date sau created_date từ 1-5 ngày
        completed_date = created_date + timedelta(days=random.randint(1, 5))
        reports.append({
            "report_id": f"RPT{year}{month:02d}{emp_id}{report_counter:04d}",
            "emp_id": emp_id,
            "status": "completed",
            "created_date": created_date.isoformat(),
            "completed_date": completed_date.isoformat(),
            "year": year,
            "month": month,
            "error_count": random.choices([0, 1, 2], weights=[0.8, 0.15, 0.05])[0],
            "processing_time_sec": random.randint(300, 3600),
            "report_value": random.randint(1000000, 50000000)
        })
        report_counter += 1

    # Tạo báo cáo đang xử lý
    for _ in range(num_processing):
        created_date = random_datetime(year, month, start_hour=8, end_hour=17).date()
        reports.append({
            "report_id": f"RPT{year}{month:02d}{emp_id}{report_counter:04d}",
            "emp_id": emp_id,
            "status": "processing",
            "created_date": created_date.isoformat(),
            "completed_date": None,
            "year": year,
            "month": month
        })
        report_counter += 1

    # Insert vào Supabase
    for r in reports:
        supabase.table("business_reports").insert(r).execute()
    return len(reports), num_completed


# ============================================
# 3b. LƯU KPI DATA
# ============================================
def save_kpi_data(emp_id, year, month, total_reports, completed_reports):
    """Lưu chỉ số KPI vào bảng kpi_data"""
    kpi_rate = (completed_reports / total_reports * 100) if total_reports > 0 else 0
    data = {
        "emp_id": emp_id,
        "year": year,
        "month": month,
        "total_reports": total_reports,
        "completed_reports": completed_reports,
        "kpi_rate": round(kpi_rate, 2),
        "kpi_value": total_reports
    }
    try:
        # Upsert để tránh trùng lặp (nếu chạy lại)
        supabase.table("kpi_data").upsert(data, on_conflict="emp_id,year,month").execute()
    except Exception as e:
        print(f"   ⚠️ Lỗi lưu KPI: {e}")


# ============================================
# 4. SINH DỮ LIỆU FRAUD EVENTS (giới hạn theo cấp độ)
# ============================================
def generate_fraud_events(emp_id, level, year, month):
    config = LEVEL_CONFIG[level]
    max_fraud = config["max_fraud_per_month"]
    # Số fraud events thực tế sẽ nhỏ hơn max_fraud
    num_events = random.randint(0, max_fraud)

    modules = ["Browser", "Mouse", "Face"]
    event_types = {
        "Browser": ["BROWSER_OPEN", "SESSION_START", "RAPID_PAUSE", "TAB_SWITCH", "INACTIVITY_ALERT"],
        "Mouse": ["MOUSE_SESSION", "ANOMALY_DETECTED", "RAPID_PAUSE_DETECTED", "BEHAVIOR_ANOMALY"],
        "Face": ["FACE_VERIFICATION", "LIVENESS_CHECK", "SPOOFING_DETECTED", "FACE_MATCH", "FACE_MISMATCH"],
    }

    for i in range(num_events):
        ts = random_datetime(year, month, start_hour=7, end_hour=22)
        module = random.choice(modules)
        event_type = random.choice(event_types[module])
        if module == "Mouse":
            details = f"Mouse anomaly detected - Score: {random.uniform(0.7, 0.95):.3f}"
            severity = "CRITICAL"
        elif module == "Face":
            details = f"Face verification failed - Similarity: {random.uniform(0.2, 0.5):.3f}"
            severity = "WARNING"
        else:
            details = "Browser suspicious activity detected"
            severity = random.choice(["WARNING", "CRITICAL"])
        session_id = f"SESS_{year}{month:02d}{ts.day:02d}_{i:03d}"

        data = {
            "emp_id": emp_id,
            "year": year,
            "month": month,
            "timestamp": ts.isoformat(),
            "event_type": event_type,
            "details": details,
            "session_id": session_id,
            "severity": severity,
            "is_fraud": 1,
            "module": module
        }
        supabase.table("fraud_events").insert(data).execute()
    return num_events


# ============================================
# 5. SINH DỮ LIỆU MOUSE DETAILS
# ============================================
def generate_mouse_details(emp_id, level, year, month):
    config = LEVEL_CONFIG[level]
    num_sessions = random.randint(*config["mouse_sessions_range"])
    inserted = 0
    for i in range(num_sessions):
        ts = random_datetime(year, month, start_hour=8, end_hour=18)
        is_fraud = 1 if random.random() < 0.08 else 0
        if is_fraud:
            anomaly_score = random.uniform(0.7, 0.95)
            severity = "CRITICAL"
        else:
            anomaly_score = random.uniform(*config["mouse_anomaly_score"])
            severity = "INFO"

        total_events = random.randint(5000, 30000)
        total_moves = total_events
        total_distance = random.uniform(5000, 40000)
        x_dist = total_distance * 0.6
        y_dist = total_distance * 0.4
        x_flips = random.randint(0, 50)
        y_flips = random.randint(0, 30)
        movement_time = random.uniform(30, 180)
        velocity = total_distance / movement_time
        acceleration = random.uniform(5, 50)
        x_vel = x_dist / movement_time
        y_vel = y_dist / movement_time
        x_acc = random.uniform(2, 30)
        y_acc = random.uniform(2, 30)
        session_id = f"MOUSE_{year}{month:02d}{ts.day:02d}_{i:03d}"

        data = {
            "emp_id": emp_id,
            "year": year,
            "month": month,
            "timestamp": ts.isoformat(),
            "event_type": "MOUSE_SESSION",
            "details": f"Mouse session - Score: {anomaly_score:.3f}",
            "session_id": session_id,
            "severity": severity,
            "is_fraud": is_fraud,
            "module": "Mouse",
            "total_events": total_events,
            "total_moves": total_moves,
            "total_distance": round(total_distance, 2),
            "x_axis_distance": round(x_dist, 2),
            "y_axis_distance": round(y_dist, 2),
            "x_flips": x_flips,
            "y_flips": y_flips,
            "movement_time_span": round(movement_time, 2),
            "velocity": round(velocity, 2),
            "acceleration": round(acceleration, 2),
            "x_velocity": round(x_vel, 2),
            "y_velocity": round(y_vel, 2),
            "x_acceleration": round(x_acc, 2),
            "y_acceleration": round(y_acc, 2),
            "duration_seconds": round(movement_time, 2),
            "anomaly_score": round(anomaly_score, 3)
        }
        supabase.table("mouse_details").insert(data).execute()
        inserted += 1
    return inserted


# ============================================
# 6. SINH DỮ LIỆU BROWSER SESSIONS (đảm bảo giờ làm tối thiểu)
# ============================================
def generate_browser_sessions(emp_id, level, year, month):
    config = LEVEL_CONFIG[level]
    work_days = config["work_days_per_month"]
    min_hours = config["min_hours_per_day"]

    # Tính số ngày trong tháng
    if month == 2:
        max_day = 29 if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0) else 28
    elif month in [4, 6, 9, 11]:
        max_day = 30
    else:
        max_day = 31

    # Chọn ngày làm việc (tránh thứ 7, CN)
    work_days_list = []
    for day in range(1, max_day + 1):
        date = datetime(year, month, day)
        if date.weekday() < 5:  # Thứ 2 đến thứ 6
            work_days_list.append(day)
    random.shuffle(work_days_list)
    selected_days = sorted(work_days_list[:work_days])

    inserted = 0
    for day in selected_days:
        num_sessions = random.randint(*config["browser_sessions_per_day"])
        total_hours = 0
        for s in range(num_sessions):
            start_hour = random.randint(8, 15)
            start_minute = random.randint(0, 59)
            start_time = datetime(year, month, day, start_hour, start_minute, 0)
            # Đảm bảo tổng giờ làm >= min_hours
            if s == num_sessions - 1:
                hours_worked = max(min_hours - total_hours, random.uniform(*config["hours_range"]))
            else:
                hours_worked = random.uniform(*config["hours_range"]) / num_sessions
            total_hours += hours_worked
            total_seconds = int(hours_worked * 3600)
            end_time = start_time + timedelta(seconds=total_seconds)
            hours = int(hours_worked)
            minutes = int((hours_worked - hours) * 60)
            total_time_str = f"{hours:02d}:{minutes:02d}:00"
            session_id = f"BROWSER_{year}{month:02d}{day:02d}_{s:02d}"
            data = {
                "emp_id": emp_id,
                "year": year,
                "month": month,
                "session_id": session_id,
                "session_start": start_time.isoformat(),
                "session_end": end_time.isoformat(),
                "total_seconds": total_seconds,
                "total_time": total_time_str,
                "module": "Browser_Session"
            }
            supabase.table("browser_sessions").insert(data).execute()
            inserted += 1
    return inserted


# ============================================
# 7. SINH DỮ LIỆU LOGIN
# ============================================
def generate_login_data(emp_id, year, month):
    num_events = random.randint(15, 35)
    for _ in range(num_events):
        ts = random_datetime(year, month, start_hour=0, end_hour=23)
        success = random.random() < 0.9
        method = random.choices(['Password', 'Face'], weights=[0.7, 0.3])[0]
        data = {
            "emp_id": emp_id,
            "year": year,
            "month": month,
            "timestamp": ts.isoformat(),
            "success": success,
            "method": method
        }
        supabase.table("login_data").insert(data).execute()
    return num_events


# ============================================
# HÀM CHÍNH
# ============================================
def generate_all_data():
    print("=" * 70)
    print("🚀 TẠO DỮ LIỆU TRÊN SUPABASE (2025 - 2026 đến tháng 4)")
    print("=" * 70)

    # insert_employees is called directly to handle the upsert
    insert_employees()

    # Danh sách các tháng cần tạo: năm 2025 (1-12), năm 2026 (1-4)
    months_to_gen = [(2025, m) for m in range(1, 13)] + [(2026, m) for m in range(1, 5)]

    total = {
        "reports": 0,
        "fraud": 0,
        "mouse": 0,
        "browser": 0,
        "login": 0,
        "kpi": 0
    }

    for emp in EMPLOYEES:
        emp_id = emp["emp_id"]
        level = emp["level"]
        print(f"\n📌 {emp_id} ({level})")
        for year, month in months_to_gen:
            print(f"  📅 {year}-{month:02d}...", end=" ", flush=True)

            # Reports
            r_count, r_completed = generate_reports(emp_id, level, year, month)
            total["reports"] += r_count

            # Lưu KPI data dựa trên kết quả báo cáo
            save_kpi_data(emp_id, year, month, r_count, r_completed)
            total["kpi"] += 1

            # Fraud events
            f_count = generate_fraud_events(emp_id, level, year, month)
            total["fraud"] += f_count

            # Mouse details
            m_count = generate_mouse_details(emp_id, level, year, month)
            total["mouse"] += m_count

            # Browser sessions
            b_count = generate_browser_sessions(emp_id, level, year, month)
            total["browser"] += b_count

            # Login data
            l_count = generate_login_data(emp_id, year, month)
            total["login"] += l_count

            print(f"✅ R:{r_count} F:{f_count} M:{m_count} B:{b_count} L:{l_count} | KPI saved")

    # Báo cáo tổng kết
    print("\n" + "=" * 70)
    print("📊 TỔNG KẾT DỮ LIỆU ĐÃ TẠO")
    print("=" * 70)
    print(f"   • employees:      {len(EMPLOYEES)} dòng")
    print(f"   • business_reports: {total['reports']} dòng")
    print(f"   • kpi_data:       {total['kpi']} dòng")
    print(f"   • fraud_events:   {total['fraud']} dòng")
    print(f"   • mouse_details:  {total['mouse']} dòng")
    print(f"   • browser_sessions: {total['browser']} dòng")
    print(f"   • login_data:     {total['login']} dòng")
    print(f"\n📅 Thời gian: 2025 (cả năm) + 2026 (tháng 1-4)")
    print(f"👥 Số nhân viên: {len(EMPLOYEES)}")
    print("=" * 70)
    print("🎉 HOÀN THÀNH!")


if __name__ == "__main__":
    print("⚠️  Bạn sắp tạo dữ liệu trên Supabase với cấu hình:")
    print("   - 3 nhân viên: EM001 (giỏi), EM002 (khá), EM003 (trung bình)")
    print("   - KPI rate: 90%, 70%, 50%")
    print("   - Fraud limit: <10, <15, <20 mỗi tháng")
    print("   - Giờ làm tối thiểu: 7h, 6h, 5h/ngày")
    print("   - Thời gian: 2025 + 2026 (tháng 1-4)")
    print("   - Bảng business_reports thay thế SAP + bảng kpi_data riêng")
    
    # In automated environment, we assume yes
    # confirm = input("\n📌 Bạn đã tạo bảng trong Supabase chưa? (yes/no): ")
    # if confirm.lower() == 'yes':
    generate_all_data()
