import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const yearStr = searchParams.get('year') || '2026'; // e.g., '2026'

    if (!employeeId) {
      return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 });
    }

    const year = parseInt(yearStr);

    // Fetch data from Supabase
    const [sapRes, kpiRes, fraudRes, sessionRes] = await Promise.all([
      supabase.from('sap_reality').select('*').eq('emp_id', employeeId).eq('year', year),
      supabase.from('kpi_data').select('*').eq('emp_id', employeeId).eq('year', year),
      supabase.from('fraud_events').select('*').eq('emp_id', employeeId).eq('year', year),
      supabase.from('browser_sessions').select('month,total_seconds').eq('emp_id', employeeId).eq('year', year)
    ]);

    if (sapRes.error) throw sapRes.error;
    if (kpiRes.error) throw kpiRes.error;
    if (fraudRes.error) throw fraudRes.error;
    if (sessionRes.error) throw sessionRes.error;

    const sapData = sapRes.data || [];
    const kpiData = kpiRes.data || [];
    const fraudData = fraudRes.data || [];
    const sessionData = sessionRes.data || [];

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const monthlyData = [];
    let totalOrdersAll = 0;
    let completedOrdersAll = 0;
    let totalProfitAll = 0;
    let totalTargetAll = 0;
    let totalHoursAll = 0;
    let totalFraudAll = 0;
    let criticalAll = 0;
    let warningAll = 0;

    for (let m = 1; m <= 12; m++) {
      const dSap = sapData.filter((d: any) => d.month === m);
      
      // Calculate Revenue (OS=A)
      const rev = dSap.filter((d: any) => d.os === 'A').reduce((sum: number, d: any) => sum + Number(d.net_value || 0), 0);
      
      // Calculate Completed and Profit
      const completedRows = dSap.filter((d: any) => d.os === 'C' && d.ds === 'C');
      const prof = completedRows.reduce((sum: number, d: any) => sum + Number(d.net_value || 0), 0);
      
      // Unique orders
      const uniqueOrders = new Set(dSap.map((d: any) => d.sales_doc));
      const totalOrd = uniqueOrders.size;
      const compOrd = new Set(completedRows.map((d: any) => d.sales_doc)).size;

      // KPI Target
      const mKpi = kpiData.filter((d: any) => d.month === m);
      const target = mKpi.reduce((sum: number, d: any) => sum + Number(d.kpi_value || 0), 0);

      // Fraud
      const mFraud = fraudData.filter((d: any) => d.month === m);
      const frC = mFraud.filter((d: any) => d.severity === 'CRITICAL').length;
      const frW = mFraud.filter((d: any) => d.severity === 'WARNING').length;
      const frTotal = frC + frW;

      // Hours
      const mSess = sessionData.filter((d: any) => d.month === m);
      const hrs = mSess.reduce((sum: number, d: any) => sum + Number(d.total_seconds || 0), 0) / 3600;

      monthlyData.push({
        monthName: monthNames[m - 1],
        revenue: rev,
        profit: prof,
        totalOrders: totalOrd,
        completedOrders: compOrd,
        target: target,
        hoursWorked: Number(hrs.toFixed(1)),
        fraudCritical: frC,
        fraudWarning: frW,
        fraudTotal: frTotal
      });

      totalOrdersAll += totalOrd;
      completedOrdersAll += compOrd;
      totalProfitAll += prof;
      totalTargetAll += target;
      totalHoursAll += hrs;
      totalFraudAll += frTotal;
      criticalAll += frC;
      warningAll += frW;
    }

    const completionRate = totalTargetAll > 0 ? (completedOrdersAll / totalTargetAll) * 100 : 0;

    return NextResponse.json({
      monthlyData,
      metrics: {
        totalOrders: totalOrdersAll,
        completedOrders: completedOrdersAll,
        totalHours: Number(totalHoursAll.toFixed(1)),
        totalFraud: totalFraudAll,
        criticalFraud: criticalAll,
        warningFraud: warningAll,
        totalProfit: totalProfitAll,
        kpiTarget: totalTargetAll,
        completionRate: completionRate.toFixed(1)
      }
    });

  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: 'Lỗi server khi đọc dữ liệu từ Supabase' }, { status: 500 });
  }
}
