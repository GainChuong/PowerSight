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

  // 9. Detailed Context for AI
  const recentOrders = sapData
    .filter(d => d.os === 'C' && d.ds === 'C')
    .slice(-10)
    .map(d => `Đơn ${d.sales_doc}: Lợi nhuận ${Number(d.net_value).toLocaleString()} VND, Ngày ${d.created_on}`)
    .join('\n');

  const recentViolations = fraudData
    .slice(-5)
    .map(d => `Vi phạm: ${d.event_type}, Mức độ: ${d.severity}, Ngày: ${d.timestamp}`)
    .join('\n');

  // Lọc đơn hàng chưa xử lý (unique by sales_doc)
  const uniqueDocs = Array.from(new Set(sapData.map(d => d.sales_doc)));
  const pendingOrders = uniqueDocs
    .map(doc => {
      const docRows = sapData.filter(d => d.sales_doc === doc);
      const isPending = docRows.some(d => d.os !== 'C' || d.ds !== 'C');
      if (isPending) {
        const latest = docRows[docRows.length - 1];
        return `Đơn ${doc}: Trạng thái ${latest.os}/${latest.ds}, Ngày tạo ${latest.created_on}`;
      }
      return null;
    })
    .filter(Boolean)
    .slice(-10)
    .join('\n');

  return {
    avgWorkTime, orderCompletionRate, avgProfit, avgModRate,
    violationFreq, kpiCompletionRate, kpiTarget, effectiveRatio,
    avgCycleTime, totalOrders, completedOrders, totalProfit, totalFraud,
    recentOrders, recentViolations, pendingOrders
  };
}

function detectIntent(message: string): 'suggestion' | 'support' | 'complaint' | 'general' | 'scenario_1' | 'scenario_2' | 'scenario_3' {
  const msg = message.toLowerCase();
  
  // Scenario specifics
  if (msg.includes('đánh giá hiệu suất') && msg.includes('đầu năm')) return 'scenario_1';
  if (msg.includes('vi phạm bao nhiêu lần') || msg.includes('hôm nay và những lỗi gì')) return 'scenario_2';
  if (msg.includes('tối ưu và giảm sai sót') || msg.includes('xử lý báo cáo')) return 'scenario_3';

  if (msg.includes('đề xuất') || msg.includes('khóa học') || msg.includes('phát triển') || msg.includes('học')) return 'suggestion';
  if (msg.includes('hỗ trợ') || msg.includes('mã đơn') || msg.includes('chi tiết') || msg.includes('thông tin') || msg.includes('chưa xử lý') || msg.includes('pending') || msg.includes('đơn hàng')) return 'support';
  if (msg.includes('khiếu nại') || msg.includes('vi phạm') || msg.includes('tại sao') || msg.includes('lỗi')) return 'complaint';
  return 'general';
}

function buildSystemPrompt(employeeId: string, year: number, m: any, intent: string): string {
  const metricsSummary = `
CHỈ SỐ HIỆU SUẤT CỦA ${employeeId} (${year}):
- Thời gian làm việc TB: ${m.avgWorkTime.toFixed(2)} giờ/ngày
- Tỷ lệ hoàn thành đơn: ${m.orderCompletionRate.toFixed(2)}%
- Lợi nhuận ròng TB/đơn: ${m.avgProfit.toLocaleString()} VND
- Tần suất vi phạm: ${m.violationFreq.toFixed(4)} lần/giờ
- Tỷ lệ hoàn thành KPI: ${m.kpiCompletionRate.toFixed(2)}% (Mục tiêu: ${m.kpiTarget} đơn)
- Chu kỳ đơn hàng: ${m.avgCycleTime.toFixed(2)} giờ
`;

  const basePrompt = `Bạn là PowerSight AI – trợ lý hỗ trợ nhân viên chuyên nghiệp.
Nhân viên: ${employeeId}
${metricsSummary}`;

  if (intent === 'suggestion') {
    return `${basePrompt}
Dựa trên dữ liệu hiệu suất ở trên, hãy đề xuất các khóa học hoặc hướng phát triển phù hợp để cải thiện các chỉ số còn thấp (ví dụ: chu kỳ đơn hàng, tỷ lệ sửa đổi).
Trả lời ngắn gọn, thân thiện, không dùng ký tự đặc biệt.`;
  }

  if (intent === 'support') {
    return `${basePrompt}
DỮ LIỆU CHI TIẾT ĐỂ TRA CỨU:
- sap_reality: Bảng dữ liệu đơn hàng SAP. Cột 'sales_doc' là Mã Đơn Hàng (ID). Cột 'os' (Order Status) và 'ds' (Delivery Status) dùng để xác định trạng thái. 'C' nghĩa là đã xong (Completed).
- fraud_events (hoặc frau_alert): Bảng ghi nhận vi phạm.

DANH SÁCH ĐƠN HÀNG GẦN ĐÂY:
${m.recentOrders}

DANH SÁCH ĐƠN HÀNG CHƯA XỬ LÝ (PENDING - Có os hoặc ds khác 'C'):
${m.pendingOrders}

YÊU CẦU:
1. Khi nhân viên hỏi về đơn hàng chưa xử lý, hãy LIỆT KÊ CHÍNH XÁC CÁC MÃ ĐƠN (sales_doc) từ danh sách PENDING ở trên.
2. Nêu rõ trạng thái os/ds của từng đơn để nhân viên biết cần làm gì.
3. Nếu không có đơn nào trong danh sách PENDING, hãy báo cáo rằng tất cả đơn hàng đã được xử lý xong.
Trình bày rõ ràng, chuyên nghiệp.`;
  }

  if (intent === 'complaint') {
    return `${basePrompt}
DỮ LIỆU VI PHẠM & ĐƠN HÀNG CHƯA HOÀN THÀNH:
${m.recentViolations}
${m.pendingOrders}

Hãy giải thích minh bạch các vấn đề, dẫn chứng bằng mã đơn hoặc thời điểm cụ thể, không đổ lỗi.
Hướng dẫn nhân viên cách hoàn thiện các đơn hàng đang thiếu hoặc cách giảm thiểu vi phạm trong tương lai.`;
  }

  if (intent === 'scenario_1') {
    return `${basePrompt}
NHIỆM VỤ CỦA BẠN: Phân tích cụ thể các chỉ số hiệu suất từ đầu năm dựa vào dữ liệu trên. 
Nhấn mạnh vào Tỷ lệ hoàn thành đơn, Lợi nhuận và Thời gian làm việc. 
Đưa ra nhận xét khách quan (có khen ngợi nếu tốt, có cảnh báo nếu kém).`;
  }

  if (intent === 'scenario_2') {
    return `${basePrompt}
DỮ LIỆU VI PHẠM GẦN ĐÂY:
${m.recentViolations}

NHIỆM VỤ CỦA BẠN: Dựa vào lịch sử vi phạm, báo cáo tình hình vi phạm trong ngày.
LƯU Ý QUAN TRỌNG: Giải thích cho nhân viên hiểu rằng theo quy định của hệ thống PowerSight, việc mở bất kỳ tab hay ứng dụng nào KHÔNG thuộc danh sách cho phép (Gmail và Google Drive/Sheets) đều bị tính là vi phạm Tracker. Nếu họ đã copy lệnh Chatbot ra một tab ngoài để search, đó chính là nguyên nhân gây lỗi vi phạm.`;
  }

  if (intent === 'scenario_3') {
    return `${basePrompt}
NHIỆM VỤ CỦA BẠN: Đưa ra lời khuyên để tối ưu hóa quy trình xử lý báo cáo tài chính.
LƯU Ý QUAN TRỌNG: Hãy cung cấp và khuyến nghị người dùng đối chiếu công việc với "Sheet Kết Quả Chuẩn" sau đây:
Link Sheet Processed: https://docs.google.com/spreadsheets/d/12ZSvldy-OpiALVzpMY_rlNYJbLE1hl8LIa2tTNHUmMc/edit?usp=sharing

Giải thích tại sao làm theo định dạng chuẩn này (tính tổng hàm SUM chính xác, dùng Conditional Formatting để cảnh báo số liệu bất thường, in đậm Header) lại giúp giảm sai sót.`;
  }

  return `${basePrompt}
Hãy trả lời câu hỏi một cách thân thiện, chính xác dựa trên dữ liệu hiện có. Tập trung vào việc tạo động lực và hỗ trợ nhân viên đạt được KPI.`;
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
    const intent = detectIntent(message);
    const metrics = await computeMetrics(employeeId, year);
    const systemPrompt = buildSystemPrompt(employeeId, year, metrics, intent);

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
