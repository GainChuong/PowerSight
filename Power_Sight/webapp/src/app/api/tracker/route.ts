import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    // Mặc định dùng 01/2026 vì data generator script mặc định có từ tháng 1
    const monthYear = searchParams.get('month') || '01/2026';

    if (!employeeId) {
      return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 });
    }

    const [monthStr, yearStr] = monthYear.split('/');
    const folderName = `${yearStr}_${monthStr}`;

    const dataPath = path.join(process.cwd(), 'generated_data', employeeId, folderName);
    const workLogPath = path.join(dataPath, `work_logs_${employeeId}_${folderName}.xlsx`);

    if (!fs.existsSync(workLogPath)) {
      return NextResponse.json({ sessions: [], completedTasks: 0, targetTasks: 0, kpiPerformance: 0 });
    }

    const workBuf = fs.readFileSync(workLogPath);
    const workWorkbook = xlsx.read(workBuf, { type: 'buffer' });
    let sessions: any[] = [];

    if (workWorkbook.SheetNames.includes('Browser_Sessions')) {
      const browserSheet = workWorkbook.Sheets['Browser_Sessions'];
      const browserData = xlsx.utils.sheet_to_json(browserSheet) as any[];
      
      sessions = browserData.map(row => {
        const startStr = row['Session_Start'] ? row['Session_Start'].split(' ')[1].substring(0, 5) : '';
        const endStr = row['Session_End'] ? row['Session_End'].split(' ')[1].substring(0, 5) : '';
        
        let durationStr = row['Total_Time'] || '00:00:00';
        const parts = durationStr.split(':');
        if (parts.length >= 2) {
          durationStr = `${parseInt(parts[0], 10)}h ${parts[1]}m`;
        }

        return {
          start: startStr,
          end: endStr,
          duration: durationStr,
          tasks: 0
        };
      });
    }

    const recentSessions = sessions.slice(-5);

    // Read SAP data for KPI
    let completedTasks = 0;
    let targetTasks = 20; // fallback target
    const sapDataPath = path.join(dataPath, 'sap_data.xlsx');

    if (fs.existsSync(sapDataPath)) {
      const sapBuf = fs.readFileSync(sapDataPath);
      const sapWorkbook = xlsx.read(sapBuf, { type: 'buffer' });
      
      if (sapWorkbook.SheetNames.includes('Reality')) {
        const realityData = xlsx.utils.sheet_to_json(sapWorkbook.Sheets['Reality']) as any[];
        const orders = new Map<string, any[]>();
        realityData.forEach(row => {
          const doc = row['Sales Doc.'];
          if (doc) {
            if (!orders.has(doc)) orders.set(doc, []);
            orders.get(doc)!.push(row);
          }
        });

        orders.forEach((rows) => {
          if (rows.some(r => r['OS'] === 'C' && r['DS'] === 'C')) {
            completedTasks++;
          }
        });
      }

      if (sapWorkbook.SheetNames.includes('KPI')) {
        const kpiData = xlsx.utils.sheet_to_json(sapWorkbook.Sheets['KPI']) as any[];
        if (kpiData.length > 0 && kpiData[0]['KPI_NUM']) {
          targetTasks = parseFloat(kpiData[0]['KPI_NUM']);
        }
      }
    }

    const kpiPerformance = targetTasks > 0 ? (completedTasks / targetTasks) * 100 : 0;

    return NextResponse.json({ 
      sessions: recentSessions,
      completedTasks,
      targetTasks,
      kpiPerformance: parseFloat(kpiPerformance.toFixed(1))
    });

  } catch (error) {
    console.error('Tracker API Error:', error);
    return NextResponse.json({ error: 'Lỗi server khi đọc dữ liệu tracker' }, { status: 500 });
  }
}
