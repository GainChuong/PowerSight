# Project Plan: Convert Electronic Performance Monitoring to Web App

**Project Type**: WEB

## Overview
We are converting a Python-based electronic performance monitoring application into a comprehensive Web Application. This platform will act as a "Safe Workspace" for employees and survey participants. It requires:
1. **Safe Working Space**: A web-proctoring environment (Fullscreen enforcement + Tab blur detection) to track real working time and ensure focus without requiring local software installation.
2. **Behavioral Tracking**: Browser-based face and mouse monitoring, evaluating performance via frontend ML inference (ONNX).
3. **Internal Chatbot**: An integrated support assistant.
4. **Dynamic Dashboards**: Reports and visualizations perfectly matching the layout and logic of the original Python dashboard (`Chatbot/dashboard.py`).

## Proposed Architecture & Tech Stack
- **Frontend Framework**: Next.js (React)
- **Styling**: Vanilla CSS Modules (Premium UI, dark theme `#0f172a`, adhering to no-tailwind rule)
- **Safe Workspace Enforcer**: JS Fullscreen API + Page Visibility API (`blur`/`focus` events)
- **Chatbot & API**: Next.js API Routes (Serverless backend for chat)
- **Dashboards**: Recharts or Chart.js for dynamic reporting
- **Face & Mouse Tracking**: MediaPipe (Client-side) + Native JS Events
- **ML Inference**: ONNX Runtime Web (running converted `.pkl` models)
- **Database**: Supabase (PostgreSQL for responses, tracking data, business metrics, and chatbot logs)

## 📊 Business Metrics & Dashboard Layout
Based on your old Python code (`dashboard.py`) and new formulas, the dashboard will include:

**Top Filters:**
- Year Selection, Month Range (From/To), and Reload.

**5 KPI Cards (Dark Theme & Colors):**
1. **ORDER COMPLETION**: Total completed vs executed orders (Tỷ lệ hoàn thành đơn hàng).
2. **TOTAL HOURS / TIME**: Average working time (Thời gian làm việc trung bình).
3. **FRAUD EVENTS (VIOLATIONS)**: Total focus loss events / violation frequency (Tần suất vi phạm).
4. **KPI COMPLETION RATE**: Progress bar for completed vs target orders (Tỷ lệ hoàn thành KPI).
5. **TOTAL PROFIT**: Average net profit per order (Lợi nhuận ròng bình quân).
*(Additional metrics like Revision Rate and Order Creation Time will be integrated as secondary cards or tooltips).*

**5 Main Charts (Using Recharts/Chart.js):**
1. **Orders by Month** (Line Chart: Total vs Completed)
2. **Working Hours by Month** (Bar Chart)
3. **Fraud Events by Month** (Bar Chart: Critical vs Warning)
4. **KPI Completion** (Donut / Pie Chart)
5. **Profit by Month** (Bar/Line Chart)

## 📁 File Structure (Proposed)
```text
├── ml_converter/               # Python scripts to convert .pkl to .onnx
├── webapp/                     # Next.js Application
│   ├── public/
│   │   └── models/             # ONNX models and MediaPipe weights
│   ├── src/
│   │   ├── components/
│   │   │   ├── SafeWorkspace/  # Fullscreen enforcer, blur detection
│   │   │   ├── Tracker/        # FaceTracker, MouseTracker
│   │   │   ├── Chatbot/        # Internal Chat UI
│   │   │   └── Dashboard/      # Recharts implementing the 5 charts & KPI cards
│   │   ├── lib/
│   │   │   ├── supabase.ts     # DB Client
│   │   │   ├── mlInference.ts  # ONNX execution logic
│   │   │   ├── metricsCalc.ts  # Formulas for KPIs
│   │   │   └── chatbotApi.ts   # Chatbot logic
│   │   ├── styles/             # Vanilla CSS Modules
│   │   └── app/                # Next.js App Router pages
```

## 📋 Task Breakdown

### 1. Next.js Foundation & Database setup
- **Agent**: `frontend-specialist` / `database-architect`
- **Task**: Initialize Next.js, setup Supabase schema (users, time_logs, focus_violations, ml_metrics, chat_logs, order_data).

### 2. Safe Workspace Environment (Web Proctoring)
- **Agent**: `frontend-specialist`
- **Task**: Implement the `SafeWorkspace` component. It will force the user into Fullscreen mode. If the user exits fullscreen or the window loses focus (`visibilitychange`/`blur`), it logs a violation to Supabase (used for "Tần suất vi phạm") and pauses the "real working time" tracker.

### 3. ML Conversion & Client-Side Tracking
- **Agent**: `backend-specialist` / `frontend-specialist`
- **Task**: Convert Python `.pkl` models to ONNX. Build the Face/Mouse tracker in the frontend and connect it to ONNX Runtime Web for live inference.

### 4. Internal Chatbot Integration
- **Agent**: `backend-specialist` / `frontend-specialist`
- **Task**: Port the existing `Chatbot` logic into Next.js API Routes. Build the chat interface UI that communicates with the backend, logging conversations.

### 5. Dynamic Dashboards (Python Port)
- **Agent**: `frontend-specialist`
- **Task**: Port `Chatbot/dashboard.py` to React. Build the 5 KPI Cards and the 5 Charts using `Recharts`. Ensure the dark theme (`#0f172a`, `#1e293b`) and identical color schemes (`#3b82f6`, `#10b981`, `#ef4444`, `#8b5cf6`, `#f59e0b`) are preserved exactly.

## ✅ PHASE X Verification
- [ ] No purple/violet hex codes
- [ ] No standard template layouts
- [ ] Socratic Gate was respected
- [ ] `npm run lint` && `npx tsc --noEmit`
- [ ] `python .agent/skills/vulnerability-scanner/scripts/security_scan.py .`
- [ ] Safe Workspace correctly catches tab switches and fullscreen exits
- [ ] Models accurately execute in the browser via ONNX
- [ ] Dashboard exactly replicates the `Chatbot/dashboard.py` layout and KPIs
