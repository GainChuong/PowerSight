import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Simple in-memory cache to dramatically improve dashboard load times
const CACHE: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const yearStr = searchParams.get('year') || '2026';

    if (!employeeId) {
      return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 });
    }

    const year = parseInt(yearStr);
    const cacheKey = `${employeeId}-${year}`;

    // Check cache
    const cached = CACHE[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Fetch data from Supabase using pagination to bypass 1000-row limit
    const fetchAllRows = async (table: string, columns: string) => {
      let allData: any[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from(table)
          .select(columns)
          .eq('emp_id', employeeId)
          .eq('year', year)
          .range(from, from + limit - 1);
        
        if (error) throw error;
        if (data) {
          allData = allData.concat(data);
          if (data.length < limit) {
            hasMore = false;
          } else {
            from += limit;
          }
        } else {
          hasMore = false;
        }
      }
      return allData;
    }

    const [sapData, kpiData, fraudData, sessionData] = await Promise.all([
      fetchAllRows('sap_reality', '*'),
      fetchAllRows('kpi_data', '*'),
      fetchAllRows('fraud_events', '*'),
      fetchAllRows('browser_sessions', 'month,total_seconds')
    ]);

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
      
      const rev = dSap.filter((d: any) => d.os === 'A').reduce((sum: number, d: any) => sum + Number(d.net_value || 0), 0);
      
      const completedRows = dSap.filter((d: any) => d.os === 'C' && d.ds === 'C');
      const prof = completedRows.reduce((sum: number, d: any) => sum + Number(d.net_value || 0), 0);
      
      const uniqueOrders = new Set(dSap.map((d: any) => d.sales_doc));
      const totalOrd = uniqueOrders.size;
      const compOrd = new Set(completedRows.map((d: any) => d.sales_doc)).size;

      const mKpi = kpiData.filter((d: any) => d.month === m);
      const target = mKpi.reduce((sum: number, d: any) => sum + Number(d.kpi_value || 0), 0);

      const mFraud = fraudData.filter((d: any) => d.month === m);
      const frC = mFraud.filter((d: any) => d.severity === 'CRITICAL').length;
      const frW = mFraud.filter((d: any) => d.severity === 'WARNING').length;
      const frTotal = frC + frW;

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

    const responseData = {
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
    };

    // Save to cache
    CACHE[cacheKey] = { data: responseData, timestamp: Date.now() };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: 'Lỗi server khi đọc dữ liệu từ Supabase' }, { status: 500 });
  }
}
