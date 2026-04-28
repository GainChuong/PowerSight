import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ reply: "Xin lỗi, API Key chưa được cấu hình." });
    }

    // Lấy dữ liệu 10 vi phạm gần nhất của nhân viên
    const { data: logs, error } = await supabase
      .from('work_logs')
      .select('event_type, severity, created_at, details')
      .order('created_at', { ascending: false })
      .limit(10);

    let logsSummary = "Không có dữ liệu vi phạm/hoạt động nào gần đây.";
    if (logs && logs.length > 0) {
      logsSummary = logs.map(l => `- [${new Date(l.created_at).toLocaleString()}] Loại: ${l.event_type}, Mức độ: ${l.severity}, Chi tiết: ${l.details}`).join('\n');
    }

    const SYSTEM_PROMPT = `Bạn là NexGen Assistant, một Trợ lý AI Phân tích Hiệu suất chuyên nghiệp. 
Nhiệm vụ của bạn là hỗ trợ người dùng phân tích hiệu suất làm việc, đề xuất lộ trình phát triển và nhắc nhở về các quy định/vi phạm.
Hãy trả lời một cách thông minh, hữu ích, ngắn gọn và lịch sự bằng tiếng Việt.
Dưới đây là dữ liệu vi phạm và hoạt động gần đây của nhân viên này (Dữ liệu thực tế từ hệ thống giám sát):
${logsSummary}

Dựa vào dữ liệu trên, hãy trả lời câu hỏi của người dùng. Nếu họ có vi phạm, hãy nhắc nhở nhẹ nhàng và đưa ra lời khuyên cải thiện. Nếu không có vi phạm, hãy động viên họ.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const userMessage = messages[messages.length - 1].parts[0].text;
    const history = messages.slice(0, -1);

    const chat = model.startChat({ history });

    const result = await chat.sendMessage(userMessage);
    const reply = result.response.text();

    return NextResponse.json({ reply });

  } catch (error: unknown) {
    console.error('Gemini API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to process chat message', 
      details: (error as Error).message || String(error) 
    }, { status: 500 });
  }
}
