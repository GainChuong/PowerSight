import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import warnings

warnings.filterwarnings('ignore')

# ============================================
# CẤU HÌNH CHÍNH
# ============================================
# Sử dụng đường dẫn tương đối để tương thích với cấu trúc dự án Webapp
BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generated_data")
FEEDBACK_PATH = os.path.join(BASE_DIR, "emp_feedback.xlsx")

EMPLOYEES = ["EM001", "EM002", "EM003", "EM004"]

EMPLOYEE_LEVEL = {
    "EM001": "HIGH",
    "EM002": "LOW",
    "EM003": "MEDIUM",
    "EM004": "MEDIUM",
}

EMPLOYEE_COLOR = {
    "EM001": "🟢",
    "EM002": "🔴",
    "EM003": "🟡",
    "EM004": "🟡",
}

CREATED_BY_MAP = {
    "EM001": "LEARN-717",
    "EM002": "LEARN-727",
    "EM003": "LEARN-757",
    "EM004": "LEARN-724",
}

# Tên nhân viên cho feedback
EMPLOYEE_NAMES = {
    "EM001": "Giang",
    "EM002": "Nhi",
    "EM003": "Thu",
    "EM004": "Kha"
}

# Danh sách quản lý cho mg_evaluation
MANAGERS = [
    {"id": "MG001", "name": "Nguyễn Văn A"},
    {"id": "MG002", "name": "Trần Thị B"},
]

YEARS = [2024, 2025, 2026]
MONTHS = range(1, 13)


# ============================================
# CẤU HÌNH DỮ LIỆU THEO CẤP ĐỘ
# ============================================
def get_employee_config(employee: str) -> dict:
    level = EMPLOYEE_LEVEL[employee]
    if level == "HIGH":
        return {
            "transactions_per_month": (90, 130),
            "net_value_range": (15000, 60000),
            "kpi_range": (90, 120),
            "fraud_events_range": (8, 16),
            "mouse_sessions_per_month": (70, 100),
            "mouse_anomaly_score": (0.05, 0.20),
            "work_sessions": 20,
            "hours_per_day": (7.5, 8.5),
            "browser_sessions_per_day": (1, 2),
        }
    elif level == "MEDIUM":
        return {
            "transactions_per_month": (60, 100),
            "net_value_range": (8000, 35000),
            "kpi_range": (70, 100),
            "fraud_events_range": (12, 22),
            "mouse_sessions_per_month": (50, 80),
            "mouse_anomaly_score": (0.20, 0.40),
            "work_sessions": 18,
            "hours_per_day": (5.5, 6.5),
            "browser_sessions_per_day": (1, 2),
        }
    else:  # LOW
        return {
            "transactions_per_month": (40, 70),
            "net_value_range": (3000, 20000),
            "kpi_range": (50, 80),
            "fraud_events_range": (25, 40),
            "mouse_sessions_per_month": (30, 55),
            "mouse_anomaly_score": (0.40, 0.65),
            "work_sessions": 14,
            "hours_per_day": (4.0, 5.5),
            "browser_sessions_per_day": (1, 2),
        }


# ============================================
# HÀM TIỆN ÍCH
# ============================================
def setup_directories() -> None:
    print("📁 Đang tạo thư mục...")
    count = 0
    for emp in EMPLOYEES:
        for year in YEARS:
            for month in MONTHS:
                month_dir = os.path.join(BASE_DIR, emp, f"{year}_{month:02d}")
                os.makedirs(month_dir, exist_ok=True)
                os.makedirs(os.path.join(month_dir, "face_captures"), exist_ok=True)
                count += 1
    # Tạo thư mục chứa file feedback nếu chưa có
    os.makedirs(os.path.dirname(FEEDBACK_PATH), exist_ok=True)
    print(f"✅ Đã tạo {count} thư mục tháng.")


def random_datetime(year: int, month: int, start_hour: int = 8, end_hour: int = 20) -> datetime:
    if month == 12:
        days_in_month = 31
    else:
        days_in_month = (datetime(year, month + 1, 1) - timedelta(days=1)).day
    day = random.randint(1, days_in_month)
    hour = random.randint(start_hour, end_hour)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return datetime(year, month, day, hour, minute, second)


# ============================================
# 1. TẠO DỮ LIỆU SAP_DATA.XLSX (SHEET REALITY)
# ============================================
def pick_revision_count(level: str) -> int:
    r = random.random()
    if level == "HIGH":
        return 1 if r < 0.60 else (2 if r < 0.90 else 3)
    if level == "MEDIUM":
        return 1 if r < 0.25 else (2 if r < 0.70 else (3 if r < 0.95 else 4))
    # LOW
    if r < 0.10:
        return 2
    if r < 0.35:
        return 3
    if r < 0.60:
        return 4
    if r < 0.80:
        return 5
    return random.choice([6, 7])


def pick_final_stage(level: str) -> str:
    r = random.random()
    if level == "HIGH":
        return "delivery" if r < 0.97 else "no_delivery"
    if level == "MEDIUM":
        return "delivery" if r < 0.93 else "no_delivery"
    return "delivery" if r < 0.85 else "no_delivery"


def generate_reality_data(employee: str, year: int, month: int) -> pd.DataFrame:
    level = EMPLOYEE_LEVEL[employee]
    config = get_employee_config(employee)

    n_docs = random.randint(*config["transactions_per_month"])
    sales_docs = [str(random.randint(1000, 9999)) for _ in range(n_docs)]
    delivery_pool = [f"8000{random.randint(1000, 9999)}" for _ in range(max(60, n_docs))]

    created_by = CREATED_BY_MAP[employee]

    columns = [
        'Sales Doc.', 'OS', 'Net Value', 'Curr.', 'CustRefDat',
        'Created On', 'Time', 'Created By', 'Delivery',
        'DS', 'Created By', 'Time', 'Created On'
    ]

    rows = []

    for sd in sales_docs:
        final_stage = pick_final_stage(level)
        k = pick_revision_count(level)

        base_dt = random_datetime(year, month, 8, 18)
        created_on_1 = base_dt.strftime("%Y-%m-%d")
        time_1 = base_dt.strftime("%H:%M:%S")

        proc_dt = base_dt + timedelta(days=random.randint(0, 5))
        created_on_2 = proc_dt.strftime("%Y-%m-%d")
        time_2 = time_1

        for i in range(k):
            is_last = (i == k - 1)

            net_value = round(random.uniform(*config["net_value_range"]), 2)
            cust_ref = (base_dt + timedelta(days=random.randint(-2, 10))).strftime("%Y-%m-%d")

            if final_stage == "no_delivery":
                if k == 1:
                    os_val = random.choice(['A', 'B'])
                else:
                    if i == 0:
                        os_val = 'A' if random.random() < 0.7 else 'B'
                    elif i == k - 1:
                        os_val = 'B' if random.random() < 0.7 else 'A'
                    else:
                        os_val = random.choice(['A', 'B'])
                row = [
                    sd, os_val, net_value, "USD", cust_ref,
                    created_on_1, time_1, created_by,
                    "", "", "", "", ""
                ]
                rows.append(row)
                continue

            if not is_last:
                if i == 0:
                    os_val = 'A' if random.random() < 0.7 else 'B'
                else:
                    os_val = random.choice(['A', 'B'])
                row = [
                    sd, os_val, net_value, "USD", cust_ref,
                    created_on_1, time_1, created_by,
                    "", "", "", "", ""
                ]
                rows.append(row)
            else:
                delivery_code = random.choice(delivery_pool)
                os_val = 'C'
                ds_val = random.choice(['B', 'C'])
                row = [
                    sd, os_val, net_value, "USD", cust_ref,
                    created_on_1, time_1, created_by,
                    delivery_code,
                    ds_val,
                    created_by, time_2, created_on_2
                ]
                rows.append(row)

    df = pd.DataFrame(rows, columns=columns)
    return df


def generate_kpi_data(employee: str, completed_orders: int) -> pd.DataFrame:
    config = get_employee_config(employee)
    low, high = config["kpi_range"]
    low = max(low, completed_orders)
    if low > high:
        high = low + 10
    kpi_value = random.randint(low, high)
    return pd.DataFrame({'KPI_NUM': [kpi_value]})


# ============================================
# 2. TẠO DỮ LIỆU WORK_LOGS
# ============================================
def generate_fraud_events_data(employee: str, year: int, month: int) -> pd.DataFrame:
    config = get_employee_config(employee)
    num_events = random.randint(*config["fraud_events_range"])

    modules = ["Browser", "Mouse", "Face"]
    event_types = {
        "Browser": ["BROWSER_OPEN", "SESSION_START", "RAPID_PAUSE", "TAB_SWITCH", "INACTIVITY_ALERT"],
        "Mouse": ["MOUSE_SESSION", "ANOMALY_DETECTED", "RAPID_PAUSE_DETECTED", "BEHAVIOR_ANOMALY"],
        "Face": ["FACE_VERIFICATION", "LIVENESS_CHECK", "SPOOFING_DETECTED", "FACE_MATCH", "FACE_MISMATCH"],
    }

    columns = [
        'Timestamp', 'Event_Type', 'Details', 'User', 'Session_ID',
        'Severity', 'IsFraud', 'Date', 'Time', 'Module',
    ]

    rows = []
    for i in range(num_events):
        ts = random_datetime(year, month, 7, 22)
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

        rows.append({
            'Timestamp': ts.strftime("%Y-%m-%d %H:%M:%S"),
            'Event_Type': event_type,
            'Details': details,
            'User': employee,
            'Session_ID': session_id,
            'Severity': severity,
            'IsFraud': 1,
            'Date': ts.strftime("%Y-%m-%d"),
            'Time': ts.strftime("%H:%M:%S"),
            'Module': module,
        })
    return pd.DataFrame(rows, columns=columns)


def generate_mouse_details_data(employee: str, year: int, month: int) -> pd.DataFrame:
    config = get_employee_config(employee)
    num_sessions = random.randint(*config["mouse_sessions_per_month"])

    columns = [
        'Timestamp', 'Event_Type', 'Details', 'User', 'Session_ID', 'Severity', 'IsFraud',
        'Date', 'Time', 'Module', 'TotalEvents', 'TotalMoves', 'TotalDistance',
        'XAxisDistance', 'YAxisDistance', 'XFlips', 'YFlips', 'MovementTimeSpan',
        'Velocity', 'Acceleration', 'XVelocity', 'YVelocity', 'XAcceleration',
        'YAcceleration', 'DurationSeconds', 'AnomalyScore',
    ]

    rows = []
    for i in range(num_sessions):
        ts = random_datetime(year, month, 8, 18)
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

        rows.append({
            'Timestamp': ts.strftime("%Y-%m-%d %H:%M:%S"),
            'Event_Type': "MOUSE_SESSION",
            'Details': f"Mouse session - Score: {anomaly_score:.3f}",
            'User': employee,
            'Session_ID': session_id,
            'Severity': severity,
            'IsFraud': is_fraud,
            'Date': ts.strftime("%Y-%m-%d"),
            'Time': ts.strftime("%H:%M:%S"),
            'Module': "Mouse",
            'TotalEvents': total_events,
            'TotalMoves': total_moves,
            'TotalDistance': round(total_distance, 2),
            'XAxisDistance': round(x_dist, 2),
            'YAxisDistance': round(y_dist, 2),
            'XFlips': x_flips,
            'YFlips': y_flips,
            'MovementTimeSpan': round(movement_time, 2),
            'Velocity': round(velocity, 2),
            'Acceleration': round(acceleration, 2),
            'XVelocity': round(x_vel, 2),
            'YVelocity': round(y_vel, 2),
            'XAcceleration': round(x_acc, 2),
            'YAcceleration': round(y_acc, 2),
            'DurationSeconds': round(movement_time, 2),
            'AnomalyScore': round(anomaly_score, 3),
        })
    return pd.DataFrame(rows, columns=columns)


def generate_browser_sessions_data(employee: str, year: int, month: int) -> pd.DataFrame:
    config = get_employee_config(employee)
    work_days = config["work_sessions"]

    rows = []
    if month == 12:
        days_in_month = 31
    else:
        days_in_month = (datetime(year, month + 1, 1) - timedelta(days=1)).day

    work_day_count = 0
    for day in range(1, days_in_month + 1):
        date = datetime(year, month, day)
        if date.weekday() >= 5 and random.random() > 0.2:
            continue
        if work_day_count >= work_days:
            break
        work_day_count += 1

        num_sessions = random.randint(*config["browser_sessions_per_day"])
        for s in range(num_sessions):
            start_hour = random.randint(8, 15)
            start_minute = random.randint(0, 59)
            start_time = datetime(year, month, day, start_hour, start_minute, 0)

            hours_worked = random.uniform(*config["hours_per_day"]) / num_sessions
            total_seconds = int(hours_worked * 3600)
            end_time = start_time + timedelta(seconds=total_seconds)

            hours = int(hours_worked)
            minutes = int((hours_worked - hours) * 60)
            total_time_str = f"{hours:02d}:{minutes:02d}:00"

            session_id = f"BROWSER_{year}{month:02d}{day:02d}_{s:02d}"

            rows.append({
                'Session_ID': session_id,
                'User': employee,
                'Session_Start': start_time.strftime("%Y-%m-%d %H:%M:%S"),
                'Session_End': end_time.strftime("%Y-%m-%d %H:%M:%S"),
                'Total_Seconds': total_seconds,
                'Total_Time': total_time_str,
                'Date': start_time.strftime("%Y-%m-%d"),
                'Module': "Browser_Session",
            })
    return pd.DataFrame(rows)


def generate_login_data(employee: str, year: int, month: int) -> pd.DataFrame:
    """Tạo dữ liệu login cho nhân viên trong một tháng."""
    num_events = random.randint(15, 35)

    rows = []
    for _ in range(num_events):
        ts = random_datetime(year, month, 0, 23)
        success = random.random() < 0.9
        method = random.choices(['Password', 'Face'], weights=[0.7, 0.3])[0]

        rows.append({
            'Timestamp': ts.strftime("%Y-%m-%d %H:%M:%S"),
            'User': employee,
            'Success': success,
            'Method': method
        })
    return pd.DataFrame(rows)


# ============================================
# 3. TẠO DỮ LIỆU FEEDBACK & MG_EVALUATION
# ============================================
def generate_feedback_data():
    """Tạo dữ liệu feedback của nhân viên, mỗi năm 1 sheet, có cột Solved (0/1)."""
    print("📝 Đang tạo dữ liệu feedback (emp_feedback.xlsx)...")
    
    with pd.ExcelWriter(FEEDBACK_PATH, engine='openpyxl') as writer:
        for year in YEARS:
            # Tạo ngẫu nhiên 30-60 feedback mỗi năm
            num_feedbacks = random.randint(30, 60)
            rows = []
            for _ in range(num_feedbacks):
                emp = random.choice(EMPLOYEES)
                month = random.choice(MONTHS)
                ts = random_datetime(year, month, 8, 18)
                feedback_type = random.choice(["System Bug", "Feature Request", "UI/UX Issue", "Performance", "General"])
                severity = random.choice(["Low", "Medium", "High", "Critical"])
                solved = random.choice([0, 1])
                
                rows.append({
                    "Feedback_ID": f"FB_{year}{month:02d}_{random.randint(1000, 9999)}",
                    "Timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
                    "Employee_ID": emp,
                    "Employee_Name": EMPLOYEE_NAMES[emp],
                    "Feedback_Type": feedback_type,
                    "Severity": severity,
                    "Content": f"Feedback regarding {feedback_type.lower()} logged by {EMPLOYEE_NAMES[emp]}.",
                    "Solved": solved
                })
            
            df = pd.DataFrame(rows)
            df = df.sort_values(by="Timestamp").reset_index(drop=True)
            df.to_excel(writer, sheet_name=str(year), index=False)


def generate_mg_evaluation_data(num_evals: int) -> pd.DataFrame:
    """Tạo dữ liệu đánh giá của quản lý."""
    print("📝 Đang tạo dữ liệu đánh giá của quản lý (mg_evaluation)...")
    rows = []
    for _ in range(num_evals):
        emp = random.choice(EMPLOYEES)
        manager = random.choice(MANAGERS)
        year = random.choice(YEARS)
        month = random.choice(MONTHS)
        ts = random_datetime(year, month, 9, 17)
        
        performance_score = random.randint(1, 5)
        attitude_score = random.randint(1, 5)
        kpi_achieved = random.choice([True, False])
        
        rows.append({
            "Eval_ID": f"EV_{year}{month:02d}_{random.randint(1000, 9999)}",
            "Timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
            "Manager_ID": manager["id"],
            "Manager_Name": manager["name"],
            "Employee_ID": emp,
            "Employee_Name": EMPLOYEE_NAMES[emp],
            "Year": year,
            "Month": month,
            "Performance_Score": performance_score,
            "Attitude_Score": attitude_score,
            "KPI_Achieved": 1 if kpi_achieved else 0,
            "Comments": f"Manager evaluation recorded by {manager['name']} for {EMPLOYEE_NAMES[emp]}."
        })
    
    df = pd.DataFrame(rows)
    return df.sort_values(by="Timestamp").reset_index(drop=True)


def save_mg_evaluation_to_excel(df: pd.DataFrame):
    """Lưu sheet mg_evaluation vào file emp_feedback.xlsx (append mode)."""
    # Vì hàm generate_feedback_data đã tạo file và các sheet năm trước đó, 
    # ta dùng mode='a' để thêm sheet mới vào cùng file.
    with pd.ExcelWriter(FEEDBACK_PATH, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
        df.to_excel(writer, sheet_name='mg_evaluation', index=False)


def generate_all_data(num_mg_evaluations: int = 50) -> None:
    print("=" * 70)
    print("🚀 TẠO DỮ LIỆU HOÀN CHỈNH 2024-2026 - POWER SIGHT SYSTEM")
    print("=" * 70)
    print("👥 Nhân viên: EM001 (Xuất sắc), EM002 (Cần cải thiện), EM003, EM004 (Trung bình)")
    print("📅 Thời gian: 3 năm (2024, 2025, 2026) - 12 tháng mỗi năm")
    print("=" * 70)

    setup_directories()

    total_files = 0
    total_rows = {"sap_reality": 0, "fraud": 0, "mouse": 0, "browser": 0, "login": 0}

    for emp in EMPLOYEES:
        print(f"\n{EMPLOYEE_COLOR[emp]} {emp} ({EMPLOYEE_LEVEL[emp]})")
        for year in YEARS:
            for month in MONTHS:
                month_str = f"{year}_{month:02d}"
                print(f"  📅 {month_str}", end=" ")

                month_dir = os.path.join(BASE_DIR, emp, month_str)

                # SAP_DATA.XLSX
                reality_df = generate_reality_data(emp, year, month)
                completed = reality_df.loc[
                    (reality_df['OS'] == 'C') & (reality_df['DS'] == 'C'),
                    'Sales Doc.'
                ].nunique()
                kpi_df = generate_kpi_data(emp, completed)

                sap_file = os.path.join(month_dir, "sap_data.xlsx")
                with pd.ExcelWriter(sap_file, engine='openpyxl') as writer:
                    reality_df.to_excel(writer, sheet_name='Reality', index=False)
                    kpi_df.to_excel(writer, sheet_name='KPI', index=False)

                # WORK_LOGS
                fraud_df = generate_fraud_events_data(emp, year, month)
                mouse_df = generate_mouse_details_data(emp, year, month)
                browser_df = generate_browser_sessions_data(emp, year, month)
                login_df = generate_login_data(emp, year, month)

                work_file = os.path.join(month_dir, f"work_logs_{emp}_{year}_{month:02d}.xlsx")
                with pd.ExcelWriter(work_file, engine='openpyxl') as writer:
                    fraud_df.to_excel(writer, sheet_name='Fraud_Events', index=False)
                    mouse_df.to_excel(writer, sheet_name='Mouse_Details', index=False)
                    browser_df.to_excel(writer, sheet_name='Browser_Sessions', index=False)
                    login_df.to_excel(writer, sheet_name='Login', index=False)

                total_files += 2
                total_rows["sap_reality"] += len(reality_df)
                total_rows["fraud"] += len(fraud_df)
                total_rows["mouse"] += len(mouse_df)
                total_rows["browser"] += len(browser_df)
                total_rows["login"] += len(login_df)

                kpi_val = kpi_df.iloc[0, 0]
                print(f"✅ (R:{len(reality_df)} | K:{kpi_val} | F:{len(fraud_df)} | M:{len(mouse_df)} | B:{len(browser_df)} | L:{len(login_df)})")

    # Tạo file feedback nhân viên
    generate_feedback_data()
    
    # Tạo và lưu dữ liệu đánh giá quản lý
    mg_eval_df = generate_mg_evaluation_data(num_mg_evaluations)
    save_mg_evaluation_to_excel(mg_eval_df)

    # ========== BÁO CÁO TỔNG KẾT ==========
    print("\n" + "=" * 70)
    print("📊 TỔNG KẾT DỮ LIỆU ĐÃ TẠO")
    print("=" * 70)
    print(f"📁 Thư mục gốc: {BASE_DIR}")
    print(f"📄 Tổng số file Excel: {total_files} (2 file/tháng × 4 nhân viên × 36 tháng = 288 file)")
    print(f"   - sap_data.xlsx: Reality: {total_rows['sap_reality']} dòng")
    print(f"   - work_logs: Fraud_Events: {total_rows['fraud']} dòng")
    print(f"   - work_logs: Mouse_Details: {total_rows['mouse']} dòng")
    print(f"   - work_logs: Browser_Sessions: {total_rows['browser']} dòng")
    print(f"   - work_logs: Login: {total_rows['login']} dòng")
    print(f"📋 File feedback: {FEEDBACK_PATH}")
    print(f"   - Sheet mg_evaluation: {num_mg_evaluations} đánh giá quản lý")
    print("=" * 70)
    print("🎉 HOÀN THÀNH!")

    try:
        os.startfile(BASE_DIR)
        print("📂 Đã mở thư mục chứa dữ liệu")
    except Exception:
        pass


# ============================================
# KIỂM TRA NHANH
# ============================================
def quick_check() -> None:
    print("\n🔍 KIỂM TRA NHANH QUY TẮC TRỐNG & ĐỊNH DẠNG NGÀY...")
    test_emp = "EM001"
    test_year = 2026
    test_month = 1
    month_dir = os.path.join(BASE_DIR, test_emp, f"{test_year}_{test_month:02d}")
    sap_path = os.path.join(month_dir, "sap_data.xlsx")
    if os.path.exists(sap_path):
        df = pd.read_excel(sap_path, sheet_name='Reality')
        kpi_df = pd.read_excel(sap_path, sheet_name='KPI')
        print(f"\n✅ {sap_path}: {len(df)} dòng Reality, KPI = {kpi_df.iloc[0, 0]}")
        
        # Kiểm tra file feedback
        if os.path.exists(FEEDBACK_PATH):
            with pd.ExcelFile(FEEDBACK_PATH) as xls:
                print(f"📋 File feedback có các sheet: {xls.sheet_names}")
                if 'mg_evaluation' in xls.sheet_names:
                    mg_df = pd.read_excel(FEEDBACK_PATH, sheet_name='mg_evaluation')
                    print(f"   - mg_evaluation: {len(mg_df)} dòng đánh giá quản lý")
    else:
        print("❌ Chưa có file để kiểm tra, hãy chạy generate trước.")
    print("\n✅ Kiểm tra nhanh hoàn tất.")


# ============================================
# CHẠY CHƯƠNG TRÌNH
# ============================================
if __name__ == "__main__":
    try:
        import openpyxl  # noqa
    except ImportError:
        print("❌ Thiếu thư viện openpyxl. Cài đặt: pip install openpyxl")
        exit(1)

    print("⚠️  Bạn sắp tạo dữ liệu cho:")
    print("   • 4 nhân viên (EM001, EM002, EM003, EM004)")
    print("   • 3 năm (2024, 2025, 2026) × 12 tháng = 36 tháng")
    print("   • Mỗi tháng 2 file → Tổng 288 file Excel")
    print(f"   • Đường dẫn lưu: {BASE_DIR}")

    confirm = input("⚠️  Tiếp tục? (yes/no): ")
    if confirm.lower() == 'yes':
        generate_all_data(num_mg_evaluations=150)
        quick_check()
    else:
        print("❌ Đã huỷ.")
