import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

async function getGeminiFeedback(employeeId: string, completedTasks: number, targetTasks: number, violationsCount: number) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    const prompt = `Bạn là trợ lý hiệu suất PowerSight. Hãy đưa ra 1 nhận xét cực ngắn (tối đa 25 từ) về hiệu suất của nhân viên ${employeeId} dựa trên:
- Đơn hoàn thành: ${completedTasks}/${targetTasks}
- Số lỗi vi phạm: ${violationsCount} lỗi.
Phong cách: Chuyên nghiệp, trực diện. Nếu có lỗi vi phạm (>0), hãy cảnh báo. Nếu tiến độ tốt, hãy khen ngợi. Trả lời bằng tiếng Việt.`;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('Gemini feedback error:', err);
    return "Không thể tải nhận xét từ AI lúc này.";
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    
    if (!employeeId) {
      return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 1. Fetch recent sessions from Supabase
    const { data: sessionData, error: sessionError } = await supabase
      .from('browser_sessions')
      .select('*')
      .eq('emp_id', employeeId)
      .order('session_start', { ascending: false })
      .limit(10);

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

    // 2. Fetch KPI/Target from Supabase
    // Completed tasks: SAP records for current month where OS='C' and DS='C'
    const { count: completedTasks, error: kpiError } = await supabase
      .from('sap_reality')
      .select('*', { count: 'exact', head: true })
      .eq('emp_id', employeeId)
      .eq('year', currentYear)
      .eq('month', currentMonth)
      .eq('os', 'C')
      .eq('ds', 'C');

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

    // 3. Fetch current violations count for current month
    const { count: violationsCount, error: fraudError } = await supabase
      .from('fraud_events')
      .select('*', { count: 'exact', head: true })
      .eq('emp_id', employeeId)
      .eq('year', currentYear)
      .eq('month', currentMonth);

    if (fraudError) throw fraudError;

    // 4. Get dynamic AI feedback from Gemini
    const aiFeedbackText = await getGeminiFeedback(employeeId, completedTasks || 0, targetTasks, violationsCount || 0);

    return NextResponse.json({ 
      sessions: sessions,
      completedTasks: completedTasks || 0,
      targetTasks,
      violationsCount: violationsCount || 0,
      kpiPerformance: parseFloat(kpiPerformance.toFixed(1)),
      aiFeedback: aiFeedbackText
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

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

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
