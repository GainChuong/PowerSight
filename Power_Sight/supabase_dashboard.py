"""
Supabase Performance Dashboard - Pro Max Edition
- UI chuẩn 100% theo screenshot
- Dữ liệu thực từ Supabase
- Gộp Doanh thu & Lợi nhuận trong biểu đồ đường
- Thêm Data Labels và Progress Bars cao cấp
"""

import sys
import os
import traceback
from datetime import datetime
import copy
import pandas as pd
import numpy as np
import matplotlib
import matplotlib.pyplot as plt
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure
import mplcursors
from PyQt6.QtWidgets import *
from PyQt6.QtCore import *
from PyQt6.QtGui import *
from supabase import create_client, Client
from dotenv import load_dotenv

matplotlib.use('QtAgg')
load_dotenv()

# --- CONFIG ---
SUPABASE_URL = "https://chornvckgdhojcbmtuoy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNob3JudmNrZ2Rob2pjYm10dW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODExMTYsImV4cCI6MjA5MjM1NzExNn0.yIipE9rUP4A6k9EBy23k02IpJ-Ky_7WLWJUz4Tgs3QA"

class ChartDialog(QDialog):
    def __init__(self, figure, title, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"📊 {title}")
        self.setWindowFlags(Qt.WindowType.Window)
        self.setStyleSheet("QDialog { background-color: #1e293b; }")
        layout = QVBoxLayout(self)
        self.canvas = FigureCanvas(figure)
        layout.addWidget(self.canvas)
        self.resize(1000, 600)

class PerformanceDashboard(QWidget):
    def __init__(self, emp_id="EM001"):
        super().__init__()
        self.emp_id = emp_id
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.monthly_data = []
        self.current_year = 2025
        
        self.init_ui()
        QTimer.singleShot(100, self.load_data)

    def init_ui(self):
        self.setWindowTitle(f"PowerSight Pro - {self.emp_id}")
        self.setMinimumSize(1300, 850)
        self.setStyleSheet("""
            QWidget { background-color: #0f172a; font-family: 'Segoe UI', Arial; }
            QLabel { color: #e2e8f0; }
            QGroupBox {
                border: 1px solid #334155;
                border-radius: 10px;
                margin-top: 15px;
                background-color: #1e293b;
                color: #94a3b8;
                font-weight: bold;
            }
            QPushButton {
                background-color: #1e293b;
                color: white;
                border: 1px solid #334155;
                padding: 8px 15px;
                border-radius: 5px;
                font-weight: bold;
            }
            QPushButton:hover { background-color: #334155; border-color: #3b82f6; }
            QComboBox {
                background-color: #1e293b;
                color: white;
                border: 1px solid #334155;
                padding: 4px;
                border-radius: 4px;
            }
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Header Section
        header = QFrame()
        header.setFixedHeight(70)
        header.setStyleSheet("background-color: #0f172a; border-bottom: 1px solid #1e293b;")
        h_layout = QHBoxLayout(header)
        
        btn_home = QPushButton("🏠 HOME")
        btn_chat = QPushButton("💬 CHATBOT")
        h_layout.addWidget(btn_home)
        h_layout.addWidget(btn_chat)
        
        h_layout.addStretch()
        title = QLabel(f"🚀 {self.emp_id} - PERFORMANCE DASHBOARD")
        title.setStyleSheet("font-size: 20px; font-weight: bold; color: white;")
        h_layout.addWidget(title)
        h_layout.addStretch()

        h_layout.addWidget(QLabel("Year:"))
        self.year_combo = QComboBox()
        self.year_combo.addItems(["2024", "2025", "2026"])
        self.year_combo.setCurrentText("2025")
        h_layout.addWidget(self.year_combo)
        
        btn_filter = QPushButton("🔍 FILTER")
        btn_filter.setStyleSheet("background-color: #3b82f6; border: none;")
        btn_filter.clicked.connect(self.load_data)
        h_layout.addWidget(btn_filter)
        
        main_layout.addWidget(header)

        # Summary Line
        summary_bar = QFrame()
        summary_bar.setFixedHeight(40)
        s_layout = QHBoxLayout(summary_bar)
        self.period_lbl = QLabel("📅 PERIOD: 2025 | Full Year")
        self.period_lbl.setStyleSheet("color: #10b981; font-weight: bold; padding-left: 20px;")
        s_layout.addWidget(self.period_lbl)
        s_layout.addStretch()
        self.summary_lbl = QLabel("Loading summary...")
        self.summary_lbl.setStyleSheet("color: #94a3b8; font-size: 11px; padding-right: 20px; background-color: #1e293b; border-radius: 10px; padding: 5px 15px;")
        s_layout.addWidget(self.summary_lbl)
        main_layout.addWidget(summary_bar)

        # Scroll Content
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("QScrollArea { border: none; }")
        
        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setSpacing(20)
        content_layout.setContentsMargins(20, 10, 20, 20)

        # KPI Cards Row
        self.kpi_layout = QHBoxLayout()
        self.card_orders = self.create_card("ORDER COMPLETION", "#3b82f6")
        self.card_hours = self.create_card("TOTAL HOURS", "#10b981")
        self.card_fraud = self.create_card("FRAUD EVENTS", "#ef4444")
        self.card_kpi = self.create_card("KPI RATE", "#8b5cf6", has_progress=True)
        self.card_profit = self.create_card("TOTAL PROFIT", "#f59e0b")
        
        self.kpi_layout.addWidget(self.card_orders)
        self.kpi_layout.addWidget(self.card_hours)
        self.kpi_layout.addWidget(self.card_fraud)
        self.kpi_layout.addWidget(self.card_kpi)
        self.kpi_layout.addWidget(self.card_profit)
        content_layout.addLayout(self.kpi_layout)

        # Charts Grid
        charts_grid = QGridLayout()
        charts_grid.setSpacing(20)

        # Row 1
        self.orders_group, self.orders_fig = self.create_chart_box("ORDERS BY MONTH")
        self.hours_group, self.hours_fig = self.create_chart_box("WORKING HOURS BY MONTH")
        charts_grid.addWidget(self.orders_group, 0, 0)
        charts_grid.addWidget(self.hours_group, 0, 1)

        # Row 2
        self.fraud_group, self.fraud_fig = self.create_chart_box("FRAUD EVENTS BY MONTH")
        self.pie_group, self.pie_fig = self.create_chart_box("KPI COMPLETION RATE")
        charts_grid.addWidget(self.fraud_group, 1, 0)
        charts_grid.addWidget(self.pie_group, 1, 1)

        # Row 3: Combined Rev/Profit
        self.combined_group, self.combined_fig = self.create_chart_box("REVENUE vs PROFIT (COMBINED LINE)")
        charts_grid.addWidget(self.combined_group, 2, 0, 1, 2)

        content_layout.addLayout(charts_grid)
        scroll.setWidget(content)
        main_layout.addWidget(scroll)

    def create_card(self, title, color, has_progress=False):
        frame = QFrame()
        frame.setStyleSheet(f"QFrame {{ background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 15px; }} QFrame:hover {{ border-color: {color}; }}")
        frame.setMinimumHeight(160)
        vbox = QVBoxLayout(frame)
        
        t_lbl = QLabel(title)
        t_lbl.setStyleSheet(f"color: {color}; font-weight: bold; font-size: 13px;")
        t_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        v_lbl = QLabel("0")
        v_lbl.setStyleSheet(f"color: white; font-size: 34px; font-weight: bold;")
        v_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        d_lbl = QLabel("-")
        d_lbl.setStyleSheet("color: #94a3b8; font-size: 11px;")
        d_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        vbox.addWidget(t_lbl)
        vbox.addWidget(v_lbl)
        vbox.addWidget(d_lbl)
        
        if has_progress:
            prog_bg = QFrame()
            prog_bg.setFixedHeight(8)
            prog_bg.setStyleSheet("background-color: #334155; border-radius: 4px;")
            prog_fill = QFrame(prog_bg)
            prog_fill.setFixedHeight(8)
            prog_fill.setStyleSheet(f"background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #ef4444, stop:0.5 #f59e0b, stop:1 #10b981); border-radius: 4px;")
            vbox.addWidget(prog_bg)
            frame.prog_fill = prog_fill
            frame.prog_bg = prog_bg

        frame.v_lbl = v_lbl
        frame.d_lbl = d_lbl
        return frame

    def create_chart_box(self, title):
        group = QGroupBox(title)
        vbox = QVBoxLayout(group)
        fig = Figure(facecolor='#1e293b', tight_layout=True)
        canvas = FigureCanvas(fig)
        canvas.mousePressEvent = lambda e, f=fig, t=title: self.open_dialog(f, t)
        vbox.addWidget(canvas)
        return group, fig

    def load_data(self):
        year = int(self.year_combo.currentText())
        try:
            sap = self.supabase.table("sap_reality").select("*").eq("emp_id", self.emp_id).eq("year", year).execute()
            kpi = self.supabase.table("kpi_data").select("*").eq("emp_id", self.emp_id).eq("year", year).execute()
            fraud = self.supabase.table("fraud_events").select("*").eq("emp_id", self.emp_id).eq("year", year).execute()
            sessions = self.supabase.table("browser_sessions").select("month,total_seconds").eq("emp_id", self.emp_id).eq("year", year).execute()

            self.process_data(pd.DataFrame(sap.data), pd.DataFrame(kpi.data), pd.DataFrame(fraud.data), pd.DataFrame(sessions.data))
        except Exception:
            traceback.print_exc()

    def process_data(self, df_sap, df_kpi, df_fraud, df_sess):
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        stats = []
        for m in range(1, 13):
            d_sap = df_sap[df_sap['month'] == m] if not df_sap.empty else pd.DataFrame()
            rev = d_sap[d_sap['os'] == 'A']['net_value'].sum() if not d_sap.empty else 0
            comp_df = d_sap[(d_sap['os'] == 'C') & (d_sap['ds'] == 'C')] if not d_sap.empty else pd.DataFrame()
            prof = comp_df['net_value'].sum() if not comp_df.empty else 0
            
            target = df_kpi[df_kpi['month'] == m]['kpi_value'].sum() if not df_kpi.empty else 0
            fr_c = len(df_fraud[(df_fraud['month'] == m) & (df_fraud['severity'] == 'CRITICAL')]) if not df_fraud.empty else 0
            fr_w = len(df_fraud[(df_fraud['month'] == m) & (df_fraud['severity'] == 'WARNING')]) if not df_fraud.empty else 0
            hrs = df_sess[df_sess['month'] == m]['total_seconds'].sum() / 3600 if not df_sess.empty else 0
            
            stats.append({
                "name": month_names[m-1], "rev": rev, "prof": prof, "total": d_sap['sales_doc'].nunique() if not d_sap.empty else 0,
                "comp": comp_df['sales_doc'].nunique() if not comp_df.empty else 0, "target": target, "hours": hrs, "fr_c": fr_c, "fr_w": fr_w
            })
        
        self.monthly_data = stats
        self.update_ui()

    def update_ui(self):
        d = self.monthly_data
        t_rev = sum(x['rev'] for x in d)
        t_prof = sum(x['prof'] for x in d)
        t_comp = sum(x['comp'] for x in d)
        t_total = sum(x['total'] for x in d)
        t_hrs = sum(x['hours'] for x in d)
        t_fr_c = sum(x['fr_c'] for x in d)
        t_fr_w = sum(x['fr_w'] for x in d)
        t_target = sum(x['target'] for x in d)
        rate = (t_comp / t_target * 100) if t_target > 0 else 0

        # Cards
        self.card_orders.v_lbl.setText(f"{t_comp:,}")
        self.card_orders.d_lbl.setText(f"Completed: {t_comp} / Total: {t_total}")
        
        self.card_hours.v_lbl.setText(f"{t_hrs:.0f}")
        self.card_hours.d_lbl.setText(f"{t_comp/t_hrs if t_hrs>0 else 0:.2f} orders/hour")
        
        self.card_fraud.v_lbl.setText(f"{t_fr_c+t_fr_w}")
        self.card_fraud.d_lbl.setText(f"Critical: {t_fr_c} | Warning: {t_fr_w}")
        
        self.card_kpi.v_lbl.setText(f"{rate:.1f}%")
        self.card_kpi.d_lbl.setText(f"{t_comp}/{t_target} orders")
        self.card_kpi.prog_fill.setFixedWidth(int(self.card_kpi.prog_bg.width() * min(rate, 100) / 100))
        
        self.card_profit.v_lbl.setText(f"{t_prof:,.0f}")
        self.card_profit.d_lbl.setText(f"Avg: {t_prof/t_comp if t_comp>0 else 0:,.0f} VND")

        self.summary_lbl.setText(f"Completed: {t_comp} | Hours: {t_hrs:.1f}h | Fraud: {t_fr_c+t_fr_w} | KPI: {rate:.1f}% | Profit: {t_prof:,.0f} VND")

        # Charts
        self.draw_orders()
        self.draw_hours()
        self.draw_fraud()
        self.draw_pie(t_comp, t_target)
        self.draw_combined()

    def draw_orders(self):
        ax = self.orders_fig.clear() or self.orders_fig.add_subplot(111)
        ax.set_facecolor('#1e293b')
        x = range(12)
        ax.plot(x, [x['total'] for x in self.monthly_data], marker='o', color='#3b82f6', label='Total Orders', linewidth=2)
        ax.plot(x, [x['comp'] for x in self.monthly_data], marker='s', color='#10b981', label='Completed', linewidth=2)
        ax.set_xticks(x); ax.set_xticklabels([x['name'] for x in self.monthly_data], color='#94a3b8', size=8)
        ax.tick_params(colors='#94a3b8'); ax.legend(facecolor='#1e293b', labelcolor='white', fontsize=8)
        self.orders_fig.canvas.draw()

    def draw_hours(self):
        ax = self.hours_fig.clear() or self.hours_fig.add_subplot(111)
        ax.set_facecolor('#1e293b')
        bars = ax.bar([x['name'] for x in self.monthly_data], [x['hours'] for x in self.monthly_data], color='#10b981', alpha=0.8)
        for b in bars: ax.text(b.get_x()+b.get_width()/2, b.get_height(), f"{b.get_height():.0f}", ha='center', color='white', size=7)
        ax.tick_params(colors='#94a3b8'); ax.set_xticklabels([x['name'] for x in self.monthly_data], size=8)
        self.hours_fig.canvas.draw()

    def draw_fraud(self):
        ax = self.fraud_fig.clear() or self.fraud_fig.add_subplot(111)
        ax.set_facecolor('#1e293b')
        x = np.arange(12)
        ax.bar(x-0.2, [x['fr_c'] for x in self.monthly_data], 0.4, label='Critical', color='#ef4444')
        ax.bar(x+0.2, [x['fr_w'] for x in self.monthly_data], 0.4, label='Warning', color='#f59e0b')
        ax.set_xticks(x); ax.set_xticklabels([x['name'] for x in self.monthly_data], color='#94a3b8', size=8)
        ax.tick_params(colors='#94a3b8'); ax.legend(facecolor='#1e293b', labelcolor='white', fontsize=8)
        self.fraud_fig.canvas.draw()

    def draw_pie(self, comp, target):
        ax = self.pie_fig.clear() or self.pie_fig.add_subplot(111)
        ax.set_facecolor('#1e293b')
        if target > 0:
            ax.pie([comp, max(0, target-comp)], labels=['Completed', 'Remaining'], colors=['#10b981', '#334155'], startangle=90, textprops={'color':'white', 'size':8})
        self.pie_fig.canvas.draw()

    def draw_combined(self):
        ax = self.combined_fig.clear() or self.combined_fig.add_subplot(111)
        ax.set_facecolor('#1e293b')
        x = range(12)
        ax.plot(x, [x['rev'] for x in self.monthly_data], marker='o', color='#f59e0b', label='Revenue', linewidth=2.5)
        ax.plot(x, [x['prof'] for x in self.monthly_data], marker='s', color='#ef4444', label='Profit', linewidth=2.5)
        ax.set_xticks(x); ax.set_xticklabels([x['name'] for x in self.monthly_data], color='#94a3b8')
        ax.tick_params(colors='#94a3b8'); ax.legend(facecolor='#1e293b', labelcolor='white')
        ax.grid(True, alpha=0.1)
        self.combined_fig.canvas.draw()

    def open_dialog(self, fig, title):
        ChartDialog(copy.deepcopy(fig), title, self).exec()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    PerformanceDashboard("EM001").show()
    sys.exit(app.exec())
