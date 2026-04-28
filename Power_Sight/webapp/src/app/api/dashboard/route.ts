import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const monthYear = searchParams.get('month'); // e.g., '04/2026'

    if (!employeeId || !monthYear) {
      return NextResponse.json({ error: 'Missing employeeId or month' }, { status: 400 });
    }

    // Convert '04/2026' to '2026_04' format used in directories
    const [monthStr, yearStr] = monthYear.split('/');
    const folderName = `${yearStr}_${monthStr}`;

    const dataPath = path.join(process.cwd(), 'generated_data', employeeId, folderName);

    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ error: 'Data not found for this period' }, { status: 404 });
    }

    const sapDataPath = path.join(dataPath, 'sap_data.xlsx');
    const workLogPath = path.join(dataPath, `work_logs_${employeeId}_${folderName}.xlsx`);

    // Initialize daily data structure for 31 days max
    const daysInMonth = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
      day: `Ngày ${i + 1}`,
      dayNum: i + 1,
      violations: 0,
      revenue: 0,
      profit: 0,
      ordersCompleted: 0,
      hoursWorked: 0,
    }));

    let totalOrders = 0;
    let completedOrders = 0;
    let totalProfit = 0;
    let kpiTarget = 0;
    let totalHours = 0;
    let totalFraud = 0;

    // --- Process SAP Data ---
    if (fs.existsSync(sapDataPath)) {
      const buf = fs.readFileSync(sapDataPath);
      const sapWorkbook = xlsx.read(buf, { type: 'buffer' });
      
      // Reality Sheet
      if (sapWorkbook.SheetNames.includes('Reality')) {
        const realitySheet = sapWorkbook.Sheets['Reality'];
        const realityData = xlsx.utils.sheet_to_json(realitySheet) as any[];

        // Group by Sales Doc.
        const orders = new Map<string, any[]>();
        realityData.forEach(row => {
          const doc = row['Sales Doc.'];
          if (doc) {
            if (!orders.has(doc)) orders.set(doc, []);
            orders.get(doc)!.push(row);
          }
        });

        totalOrders = orders.size;

        orders.forEach((rows, doc) => {
          // Check if order is completed (has OS='C' and DS='C')
          const isCompleted = rows.some(r => r['OS'] === 'C' && r['DS'] === 'C');
          
          if (isCompleted) {
            completedOrders++;
            
            // Profit is the Net Value of the completed row
            const completedRow = rows.find(r => r['OS'] === 'C' && r['DS'] === 'C');
            const profit = parseFloat(completedRow['Net Value']) || 0;
            totalProfit += profit;

            // Attribute to day
            const createdOn = new Date(completedRow['Created On']);
            if (!isNaN(createdOn.getTime())) {
              const day = createdOn.getDate();
              if (day >= 1 && day <= daysInMonth) {
                dailyData[day - 1].ordersCompleted++;
                dailyData[day - 1].profit += profit;
                // Roughly estimate revenue based on profit if missing, but it's typically close to net value
                dailyData[day - 1].revenue += profit * 1.5; 
              }
            }
          }
        });
      }

      // KPI Sheet
      if (sapWorkbook.SheetNames.includes('KPI')) {
        const kpiSheet = sapWorkbook.Sheets['KPI'];
        const kpiData = xlsx.utils.sheet_to_json(kpiSheet) as any[];
        if (kpiData.length > 0 && kpiData[0]['KPI_NUM']) {
          kpiTarget = parseFloat(kpiData[0]['KPI_NUM']);
        }
      }
    }

    // --- Process Work Logs ---
    if (fs.existsSync(workLogPath)) {
      const workBuf = fs.readFileSync(workLogPath);
      const workWorkbook = xlsx.read(workBuf, { type: 'buffer' });
      
      // Fraud Events
      if (workWorkbook.SheetNames.includes('Fraud_Events')) {
        const fraudSheet = workWorkbook.Sheets['Fraud_Events'];
        const fraudData = xlsx.utils.sheet_to_json(fraudSheet) as any[];
        
        fraudData.forEach(row => {
          totalFraud++;
          const dateStr = row['Date'];
          if (dateStr) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              const day = date.getDate();
              if (day >= 1 && day <= daysInMonth) {
                dailyData[day - 1].violations++;
              }
            }
          }
        });
      }

      // Browser Sessions
      if (workWorkbook.SheetNames.includes('Browser_Sessions')) {
        const browserSheet = workWorkbook.Sheets['Browser_Sessions'];
        const browserData = xlsx.utils.sheet_to_json(browserSheet) as any[];
        
        browserData.forEach(row => {
          const hours = (parseFloat(row['Total_Seconds']) || 0) / 3600;
          totalHours += hours;
          
          const dateStr = row['Date'] || row['Session_Start'];
          if (dateStr) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              const day = date.getDate();
              if (day >= 1 && day <= daysInMonth) {
                dailyData[day - 1].hoursWorked += hours;
              }
            }
          }
        });
      }
    }

    // Round daily hours to 1 decimal
    dailyData.forEach(d => {
      d.hoursWorked = parseFloat(d.hoursWorked.toFixed(1));
    });

    const completionRate = kpiTarget > 0 ? (completedOrders / kpiTarget) * 100 : 0;

    return NextResponse.json({
      dailyData,
      metrics: {
        totalOrders,
        completedOrders,
        totalHours: parseFloat(totalHours.toFixed(1)),
        totalFraud,
        totalProfit,
        kpiTarget,
        completionRate: completionRate.toFixed(1)
      }
    });

  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: 'Lỗi server khi đọc dữ liệu' }, { status: 500 });
  }
}
