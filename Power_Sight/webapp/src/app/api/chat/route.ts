import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Tính 8 chỉ số hiệu suất theo data_processor.py
async function computeMetrics(employeeId: string, year: number) {
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
        if (data.length < limit) hasMore = false;
        else from += limit;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  const [sapData, kpiData, fraudData, sessionData] = await Promise.all([
    fetchAllRows('sap_reality', '*'),
    fetchAllRows('kpi_data', '*'),
    fetchAllRows('fraud_events', '*'),
    fetchAllRows('browser_sessions', '*')
  ]);

  // 1. Thời gian làm việc TB
  const totalSeconds = sessionData.reduce((sum, s) => sum + (s.total_seconds || 0), 0);
  const totalHours = totalSeconds / 3600;
  const sessionDays = new Set(sessionData.map(s => s.session_start?.split('T')[0])).size || 1;
  const avgWorkTime = totalHours / sessionDays;

  // 2. Tỷ lệ hoàn thành đơn
  const salesDocs = Array.from(new Set(sapData.map(d => d.sales_doc)));
  const totalOrders = salesDocs.length;
  const completedRows = sapData.filter(d => d.os === 'C' && d.ds === 'C');
  const completedDocs = Array.from(new Set(completedRows.map(d => d.sales_doc)));
  const completedOrders = completedDocs.length;
  const orderCompletionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

  // 3. Lợi nhuận ròng TB/đơn
  const totalProfit = completedRows.reduce((sum, d) => sum + Number(d.net_value || 0), 0);
  const avgProfit = completedOrders > 0 ? totalProfit / completedOrders : 0;

  // 4. Tỷ lệ sửa đổi TB
  let totalMods = 0;
  completedDocs.forEach(doc => {
    const rowsCount = sapData.filter(d => d.sales_doc === doc).length;
    totalMods += (rowsCount - 1);
  });
  const avgModRate = completedOrders > 0 ? totalMods / completedOrders : 0;

  // 5. Tần suất vi phạm
  const totalFraud = fraudData.length;
  const violationFreq = totalHours > 0 ? totalFraud / totalHours : 0;

  // 6. Tỷ lệ hoàn thành KPI
  const kpiTarget = kpiData.reduce((sum, d) => sum + Number(d.kpi_value || 0), 0);
  const kpiCompletionRate = kpiTarget > 0 ? (completedOrders / kpiTarget) * 100 : 0;

  // 7. Thời gian làm việc hiệu quả
  const effectiveTimeSec = sapData.length * 300;
  const effectiveRatio = totalSeconds > 0 ? Math.min(effectiveTimeSec / totalSeconds, 1.0) : 0;

  // 8. Chu kỳ đơn hàng
  let totalCycleHours = 0;
  completedDocs.forEach(doc => {
    const docRows = sapData.filter(d => d.sales_doc === doc).sort((a: any, b: any) => a.id - b.id);
    const lastRow = docRows[docRows.length - 1];
    if (lastRow && lastRow.cust_ref_date && lastRow.created_on) {
      const diff = (new Date(lastRow.cust_ref_date).getTime() - new Date(lastRow.created_on).getTime()) / (1000 * 3600);
      totalCycleHours += Math.abs(diff);
    }
  });
  const avgCycleTime = completedOrders > 0 ? totalCycleHours / completedOrders : 0;

  return {
    avgWorkTime, orderCompletionRate, avgProfit, avgModRate,
    violationFreq, kpiCompletionRate, kpiTarget, effectiveRatio,
    avgCycleTime, totalOrders, completedOrders, totalProfit, totalFraud
  };
}

function buildSystemPrompt(employeeId: string, year: number, m: any): string {
  return `Bạn là PowerSight Assistant, trợ lý hiệu suất chuyên nghiệp.
Phân tích 8 CHỈ SỐ HIỆU SUẤT CỦA ${employeeId} (${year}):

- Thời gian làm việc TB: ${m.avgWorkTime.toFixed(2)} giờ/ngày
- Tỷ lệ hoàn thành đơn: ${m.orderCompletionRate.toFixed(2)}%
- Lợi nhuận ròng TB/đơn: ${m.avgProfit.toLocaleString()} VND
- Sửa đổi TB/đơn: ${m.avgModRate.toFixed(2)} lần
- Tần suất vi phạm: ${m.violationFreq.toFixed(4)} lần/giờ
- Tỷ lệ hoàn thành KPI: ${m.kpiCompletionRate.toFixed(2)}% (Mục tiêu: ${m.kpiTarget} đơn)
- Thời gian làm việc hiệu quả: ${m.effectiveRatio.toFixed(3)}
- Chu kỳ đơn hàng: ${m.avgCycleTime.toFixed(2)} giờ

Thông tin bổ sung:
- Tổng đơn: ${m.totalOrders}
- Đã hoàn thành: ${m.completedOrders}
- Tổng lợi nhuận: ${m.totalProfit.toLocaleString()} VND
- Tổng số vi phạm: ${m.totalFraud}

QUY TẮC PHẢN HỒI:
- Trả lời tiếng Việt, lịch sự, chuyên nghiệp.
- Sử dụng Markdown (in đậm, danh sách gạch đầu dòng) để trình bày trực quan, dễ đọc.
- Phân tích dựa trên 8 chỉ số trên.
- Soạn thảo email khi có yêu cầu dựa trên dữ liệu vi phạm/hiệu suất.`;
}

export async function POST(request: Request) {
  try {
    const { sessionId, message, employeeId } = await request.json();
    const year = 2026;

    if (!employeeId || !message) {
      return NextResponse.json({ reply: 'Thiếu thông tin nhân viên hoặc tin nhắn.' }, { status: 400 });
    }

    // 1. Tạo session mới nếu chưa có
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const title = message.length > 50 ? message.substring(0, 50) + '...' : message;
      const { data: newSession, error } = await supabase
        .from('chat_sessions')
        .insert({ emp_id: employeeId, title })
        .select('id')
        .single();

      if (error || !newSession) {
        return NextResponse.json({ reply: 'Lỗi tạo phiên trò chuyện.' }, { status: 500 });
      }
      activeSessionId = newSession.id;
    }

    // 2. Lưu tin nhắn user vào DB
    await supabase.from('chat_messages').insert({
      session_id: activeSessionId,
      role: 'user',
      content: message
    });

    // 3. Lấy lịch sử tin nhắn từ DB
    const { data: historyRows } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', activeSessionId)
      .order('created_at', { ascending: true });

    const history = (historyRows || []).slice(0, -1).map(r => ({
      role: r.role,
      parts: [{ text: r.content }]
    }));

    // 4. Tính toán metrics và tạo System Prompt
    const metrics = await computeMetrics(employeeId, year);
    const systemPrompt = buildSystemPrompt(employeeId, year, metrics);

    // 5. Sử dụng startChat với history
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      systemInstruction: systemPrompt,
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    // 6. Lưu phản hồi của model vào DB
    await supabase.from('chat_messages').insert({
      session_id: activeSessionId,
      role: 'model',
      content: reply
    });

    // 7. Cập nhật thời gian session
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', activeSessionId);

    return NextResponse.json({ reply, sessionId: activeSessionId });

  } catch (error: any) {
    console.error('[Chat API Error]:', error);
    return NextResponse.json({
      reply: 'Xin lỗi, tôi gặp lỗi khi xử lý: ' + (error.message || 'Lỗi không xác định.')
    }, { status: 500 });
  }
}
