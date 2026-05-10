// VERSION: 2.2 - FIXED SYNTAX
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const imapConfig = {
  imap: {
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASS || '',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 5000
  }
};

async function fetchLatestReportEmail() {
  try {
    const connection = await imaps.connect(imapConfig);
    await connection.openBox('INBOX');
    const searchCriteria = ['ALL'];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      struct: true
    };
    const messages = await connection.search(searchCriteria, fetchOptions);
    if (messages.length === 0) {
      connection.end();
      return null;
    }
    const latestMessage = messages[messages.length - 1];
    const all = latestMessage.parts.find(part => part.which === '');
    const mail = await simpleParser(all?.body);
    connection.end();
    return {
      subject: mail.subject,
      from: mail.from?.text,
      text: mail.text,
      date: mail.date
    };
  } catch (err) {
    console.error('IMAP Error:', err);
    return null;
  }
}
async function fetchGoogleSheetCSV(sheetId: string) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await fetch(url);
    if (!response.ok) return 'Không thể tải dữ liệu. Hãy đảm bảo Sheet ở chế độ "Bất kỳ ai có liên kết đều có thể xem".';
    return await response.text();
  } catch (err) {
    return 'Lỗi kết nối khi tải Sheet.';
  }
}

function extractSheetId(text: string): string | null {
  const match = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

const STANDARD_SHEET_ID = '12ZSvldy-OpiALVzpMY_rlNYJbLE1hl8LIa2tTNHUmMc';

async function computeMetrics(employeeId: string, year: number) {
  const fetchAllRows = async (table: string, columns: string) => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase.from(table).select(columns).eq('emp_id', employeeId).eq('year', year).range(from, from + limit - 1);
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

  const [reportData, kpiData, fraudData, sessionData, latestEmail] = await Promise.all([
    fetchAllRows('business_reports', '*'),
    fetchAllRows('kpi_data', '*'),
    fetchAllRows('fraud_events', '*'),
    fetchAllRows('browser_sessions', '*'),
    fetchLatestReportEmail()
  ]);

  const totalSeconds = sessionData.reduce((sum, s) => sum + (s.total_seconds || 0), 0);
  const totalHours = totalSeconds / 3600;
  const sessionDays = new Set(sessionData.map(s => s.session_start?.split('T')[0])).size || 1;
  const avgWorkTime = totalHours / sessionDays;

  const totalReports = reportData.length;
  const completedReportsData = reportData.filter(d => d.status === 'completed');
  const completedReports = completedReportsData.length;
  const reportCompletionRate = totalReports > 0 ? (completedReports / totalReports) * 100 : 0;

  const totalFraud = fraudData.length;

  const kpiTarget = kpiData.reduce((sum, d) => sum + Number(d.kpi_value || 0), 0);
  const kpiCompletionRate = kpiTarget > 0 ? (completedReports / kpiTarget) * 100 : 0;

  const totalProcessingTime = reportData.reduce((sum, d) => sum + (d.processing_time_sec || 0), 0);
  const effectiveRatio = totalSeconds > 0 ? Math.min(totalProcessingTime / totalSeconds, 1.0) : 0;

  const recentReports = reportData.slice(-10).map(d => `- [${d.created_at}] Báo cáo #${d.report_id}: ${d.status}`).join('\n');
  const recentViolations = fraudData.slice(-15).map(d => `- [${d.timestamp}] ${d.event_type} (${d.severity}): ${d.details}`).join('\n');

  const today = new Date().toISOString().split('T')[0];
  const todayReports = reportData.filter(d => d.created_at?.startsWith(today));
  const todayCompleted = todayReports.filter(d => d.status === 'completed').length;
  const todayFraudEvents = fraudData.filter(d => d.timestamp?.startsWith(today));
  const todayFraud = todayFraudEvents.length;
  const todayViolationsSummary = todayFraudEvents.map(d => {
    const time = d.timestamp ? d.timestamp.split('T')[1].split('.')[0] : 'N/A';
    return `- [${time}] ${d.event_type}: ${d.details}`;
  }).join('\n');

  const todaySessions = sessionData.filter(d => d.session_start?.startsWith(today));
  const todaySeconds = todaySessions.reduce((sum, s) => sum + (s.total_seconds || 0), 0);
  const todayHours = todaySeconds / 3600;

  return {
    avgWorkTime, reportCompletionRate,
    violationFreq: totalHours > 0 ? totalFraud / totalHours : 0,
    kpiCompletionRate, kpiTarget, effectiveRatio,
    totalReports, completedReports, totalFraud,
    recentReports, recentViolations,
    todayStats: {
      reports: todayReports.length,
      completed: todayCompleted,
      fraud: todayFraud,
      violations: todayViolationsSummary || 'Không có vi phạm trong hôm nay.',
      hours: todayHours.toFixed(2)
    },
    latestEmailContent: latestEmail ? `Chủ đề: ${latestEmail.subject}\nNgười gửi: ${latestEmail.from}\nNội dung: ${latestEmail.text?.substring(0, 1000)}` : 'Không tìm thấy mail báo cáo gần đây.',
    comparisonData: {
      standard: await fetchGoogleSheetCSV(STANDARD_SHEET_ID),
      userReport: latestEmail ? await (async () => {
        const id = extractSheetId(latestEmail.text || '');
        return id ? await fetchGoogleSheetCSV(id) : 'Không tìm thấy link Google Sheet trong email của bạn.';
      })() : 'Chưa có email báo cáo để đối chiếu.'
    }
  };
}

function detectIntent(message: string): 'suggestion' | 'support' | 'complaint' | 'general' | 'scenario_1' | 'scenario_2' | 'scenario_3' | 'scenario_4' {
  const msg = message.toLowerCase();
  if (msg.includes('hiệu suất') && (msg.includes('đầu năm') || msg.includes('hiện tại'))) return 'scenario_1';
  if (msg.includes('vi phạm') && (msg.includes('hôm nay') || msg.includes('ngày hôm nay'))) return 'scenario_2';
  if (msg.includes('tối ưu') && (msg.includes('quy trình') || msg.includes('xử lý báo cáo'))) return 'scenario_3';
  if (msg.includes('kiểm tra') || msg.includes('sai') || msg.includes('hoàn thiện') || msg.includes('đã gửi')) return 'scenario_4';
  if (msg.includes('đề xuất') || msg.includes('khóa học') || msg.includes('phát triển')) return 'suggestion';
  if (msg.includes('hỗ trợ') || msg.includes('chi tiết') || msg.includes('thông tin') || msg.includes('chưa xử lý')) return 'support';
  if (msg.includes('khiếu nại') || msg.includes('tại sao') || msg.includes('lỗi')) return 'complaint';
  return 'general';
}

function buildSystemPrompt(employeeId: string, year: number, m: any, intent: string): string {
  const metricsSummary = `
CHỈ SỐ HIỆU SUẤT CỦA ${employeeId} (Từ đầu năm ${year} đến nay):
- Thời gian làm việc TB: ${m.avgWorkTime.toFixed(2)} giờ/ngày
- Tỷ lệ hoàn thành báo cáo: ${m.reportCompletionRate.toFixed(2)}% (Đã xử lý ${m.completedReports}/${m.totalReports} báo cáo)
- Tần suất vi phạm tracker: ${m.violationFreq.toFixed(4)} lần/giờ
- Tỷ lệ hoàn thành KPI: ${m.kpiCompletionRate.toFixed(2)}% (Mục tiêu: ${m.kpiTarget} báo cáo)

TRẠNG THÁI HÔM NAY (${new Date().toLocaleDateString('vi-VN')}):
- Số báo cáo đã xử lý: ${m.todayStats.completed}/${m.todayStats.reports}
- Số giờ làm việc: ${m.todayStats.hours} giờ
- Vi phạm ghi nhận: ${m.todayStats.fraud} lần

DANH SÁCH VI PHẠM CHI TIẾT TRONG HÔM NAY:
${m.todayStats.violations}

DANH SÁCH VI PHẠM LỊCH SỬ (Gần nhất):
${m.recentViolations || 'Không có vi phạm.'}

HOẠT ĐỘNG XỬ LÝ BÁO CÁO GẦN ĐÂY:
${m.recentReports || 'Không có hoạt động.'}
`;
  const standardResults = `
BẢNG KẾT QUẢ CHUẨN (Dùng để đối chiếu):
- Tổng số Báo cáo cần xử lý: 90
- Yêu cầu: Hoàn thành 100%, thời gian xử lý tối ưu.

DỮ LIỆU ĐỐI CHIẾU CHI TIẾT (Cho Scenario 3):
1. BÁO CÁO CHUẨN (Dữ liệu gốc):
${m.comparisonData.standard}

2. BÁO CÁO CỦA NHÂN VIÊN (Trích xuất từ email mới nhất):
${m.comparisonData.userReport}
`;

  const basePrompt = `Bạn là PowerSight AI Advisor – trợ lý phân tích dữ liệu chuyên nghiệp.
Nhân viên: ${employeeId}
${metricsSummary}
${standardResults}

QUY TẮC PHẢN HỒI:
1. TRẢ LỜI ĐÚNG TRỌNG TÂM: Chỉ trả lời đúng khía cạnh người dùng hỏi. Không liệt kê các chỉ số khác nếu không được yêu cầu.
2. DỰA TRÊN SỐ LIỆU: Luôn dẫn chứng bằng con số cụ thể từ dữ liệu trên.
3. PHÂN TÍCH ĐỐI CHIẾU (SCENARIO 3): Nếu người dùng hỏi về tối ưu quy trình hoặc so sánh báo cáo, hãy đối chiếu "BÁO CÁO CHUẨN" và "BÁO CÁO CỦA NHÂN VIÊN". Chỉ rõ dòng nào, số nào bị lệch, thiếu trường thông tin nào và đưa ra lời khuyên sửa đổi cụ thể.
4. NGẮN GỌN & CHUYÊN NGHIỆP: Trả lời bằng Tiếng Việt chuyên nghiệp, đi thẳng vào vấn đề. Không nhắc đến SAP, chỉ tập trung quy trình Gmail/Google Sheets.
`;

  if (intent === 'scenario_1') return `${basePrompt}\nNHIỆM VỤ: PHÂN TÍCH HIỆU SUẤT TỔNG THỂ.`;
  if (intent === 'scenario_2') return `${basePrompt}\nNHIỆM VỤ: KIỂM SÓT TUÂN THỦ.`;
  if (intent === 'scenario_3') return `${basePrompt}\nNHIỆM VỤ: TỐI ƯU QUY TRÌNH.`;
  if (intent === 'scenario_4') return `${basePrompt}\nNHIỆM VỤ: KIỂM TRA & XÁC THỰC BÁO CÁO.\nDỮ LIỆU MAIL MỚI NHẤT:\n${m.latestEmailContent}`;
  return `${basePrompt}\nHỗ trợ nhân viên xử lý báo cáo.`;
}

export async function POST(request: Request) {
  try {
    const { sessionId, message, employeeId } = await request.json();
    const year = 2026;
    if (!employeeId || !message) return NextResponse.json({ reply: 'Thiếu thông tin.' }, { status: 400 });
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const { data: newSession } = await supabase.from('chat_sessions').insert({ emp_id: employeeId, title: message.substring(0, 50) }).select('id').single();
      activeSessionId = newSession?.id;
    }
    await supabase.from('chat_messages').insert({ session_id: activeSessionId, role: 'user', content: message });
    const { data: historyRows } = await supabase.from('chat_messages').select('role, content').eq('session_id', activeSessionId).order('created_at', { ascending: true });
    const history = (historyRows || []).slice(0, -1).map(r => ({ role: r.role, parts: [{ text: r.content }] }));
    const intent = detectIntent(message);
    const metrics = await computeMetrics(employeeId, year);
    const systemPrompt = buildSystemPrompt(employeeId, year, metrics, intent);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: systemPrompt });
    const result = await model.startChat({ history }).sendMessage(message);
    const reply = result.response.text();
    await supabase.from('chat_messages').insert({ session_id: activeSessionId, role: 'model', content: reply });
    return NextResponse.json({ reply, sessionId: activeSessionId });
  } catch (error) {
    console.error('[Chat API Error]:', error);
    return NextResponse.json({ reply: 'Hệ thống bận.' }, { status: 500 });
  }
}
