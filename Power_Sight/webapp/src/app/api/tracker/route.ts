import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getQuickComment(completedTasks: number, targetTasks: number, violationsCount: number) {
  if (violationsCount > 5) {
    return "Cảnh báo: Số lượng vi phạm quá cao. Vui lòng tuân thủ quy định làm việc để tránh ảnh hưởng đến đánh giá.";
  }
  if (violationsCount > 0) {
    return "Lưu ý: Bạn có một số lỗi vi phạm tracker. Hãy tập trung vào công việc và hạn chế rời khỏi ứng dụng.";
  }
  if (completedTasks >= targetTasks) {
    return "Tuyệt vời! Bạn đã hoàn thành mục tiêu báo cáo trong ngày. Hãy tiếp tục duy trì phong độ này.";
  }
  if (completedTasks > targetTasks * 0.5) {
    return "Tiến độ tốt. Bạn đã hoàn thành hơn một nửa mục tiêu. Hãy cố gắng hoàn thành phần còn lại nhé.";
  }
  return "Đang trong quá trình ghi nhận hiệu suất. Hãy tập trung xử lý các báo cáo được giao.";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    
    if (!employeeId) {
      return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 });
    }

    // 1. Fetch today's sessions from Supabase
    const today = new Date().toISOString().split('T')[0];
    const { data: sessionData, error: sessionError } = await supabase
      .from('browser_sessions')
      .select('*')
      .eq('emp_id', employeeId)
      .gte('session_start', `${today}T00:00:00Z`)
      .lte('session_start', `${today}T23:59:59Z`)
      .order('session_start', { ascending: false });

    if (sessionError) throw sessionError;

    const sessions = sessionData.map(row => {
      const start = new Date(row.session_start);
      const end = row.session_end ? new Date(row.session_end) : null;
      
      const startStr = start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const endStr = end ? end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
      
      let durationStr = row.total_time || '00:00:00';
      const parts = durationStr.split(':');
      if (parts.length >= 2) {
        durationStr = `${parseInt(parts[0], 10)}h ${parts[1]}m`;
      }

      return {
        start: startStr,
        end: endStr,
        duration: durationStr,
        tasks: 0 // Placeholder or calculate from other tables
      };
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Completed tasks: Business Report records for TODAY where status='completed'
    const { count: completedTasks, error: kpiError } = await supabase
      .from('business_reports')
      .select('*', { count: 'exact', head: true })
      .eq('emp_id', employeeId)
      .gte('created_at', `${today}T00:00:00Z`)
      .lte('created_at', `${today}T23:59:59Z`)
      .eq('status', 'completed');

    if (kpiError) throw kpiError;

    // Target from kpi_data for current month
    const { data: targetData, error: targetError } = await supabase
      .from('kpi_data')
      .select('kpi_value')
      .eq('emp_id', employeeId)
      .eq('year', currentYear)
      .eq('month', currentMonth)
      .limit(1)
      .single();

    const targetTasks = targetData?.kpi_value || 20;
    const kpiPerformance = targetTasks > 0 ? ((completedTasks || 0) / targetTasks) * 100 : 0;

    // 3. Fetch current violations count for TODAY
    const { count: violationsCount, error: fraudError } = await supabase
      .from('fraud_events')
      .select('*', { count: 'exact', head: true })
      .eq('emp_id', employeeId)
      .gte('timestamp', `${today}T00:00:00Z`)
      .lte('timestamp', `${today}T23:59:59Z`);

    if (fraudError) throw fraudError;

    // 4. Get performance comment based on rules
    const performanceFeedback = getQuickComment(completedTasks || 0, targetTasks, violationsCount || 0);

    return NextResponse.json({ 
      sessions: sessions,
      completedTasks: completedTasks || 0,
      targetTasks,
      violationsCount: violationsCount || 0,
      kpiPerformance: parseFloat(kpiPerformance.toFixed(1)),
      aiFeedback: performanceFeedback
    });

  } catch (error) {
    console.error('Tracker API Error:', error);
    return NextResponse.json({ error: 'Lỗi server khi lấy dữ liệu tracker từ database' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { employeeId, seconds, startTime, endTime } = await req.json();

    if (!employeeId || seconds === undefined) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // RULE: If session < 1 hour (3600 seconds), do not save
    if (seconds < 3600) {
      return NextResponse.json({ message: 'Session too short (< 1hr), not saved.', saved: false });
    }

    const formatTimeStr = (s: number) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    const now = new Date();
    const start = startTime ? new Date(startTime) : new Date(now.getTime() - seconds * 1000);
    const end = endTime ? new Date(endTime) : now;

    const { error } = await supabase
      .from('browser_sessions')
      .insert({
        session_id: `WEB-${randomUUID().substring(0, 8)}`,
        emp_id: employeeId,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        session_start: start.toISOString(),
        session_end: end.toISOString(),
        total_seconds: seconds,
        total_time: formatTimeStr(seconds),
        module: 'WEB_TRACKER'
      });

    if (error) throw error;

    return NextResponse.json({ message: 'Session saved successfully', saved: true });

  } catch (error) {
    console.error('Tracker POST Error:', error);
    return NextResponse.json({ error: 'Lỗi server khi lưu session' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    if (!employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 });

    // Use exact same logic as GET to identify "today"
    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today}T00:00:00Z`;
    const todayEnd = `${today}T23:59:59Z`;

    console.log(`[Tracker API] 🔄 Resetting ALL today data for ${employeeId} (UTC Range: ${todayStart} - ${todayEnd})`);

    // 1. Delete today's sessions
    const { error: sessionError } = await supabase
      .from('browser_sessions')
      .delete()
      .eq('emp_id', employeeId)
      .gte('session_start', todayStart)
      .lte('session_start', todayEnd);

    if (sessionError) throw sessionError;

    // 2. Delete today's violations
    const { error: fraudError } = await supabase
      .from('fraud_events')
      .delete()
      .eq('emp_id', employeeId)
      .gte('timestamp', todayStart)
      .lte('timestamp', todayEnd);

    if (fraudError) throw fraudError;

    // 3. Delete today's completed reports (Business Reports)
    const { error: reportError } = await supabase
      .from('business_reports')
      .delete()
      .eq('emp_id', employeeId)
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);

    if (reportError) throw reportError;

    return NextResponse.json({ success: true, message: 'Today data fully reset' });
  } catch (error) {
    console.error('Tracker DELETE Error:', error);
    return NextResponse.json({ error: 'Lỗi server khi reset dữ liệu' }, { status: 500 });
  }
}
