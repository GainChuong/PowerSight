import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Missing email address' }, { status: 400 });
    }

    // Google Sheets link (Raw, but force copy)
    const rawSheetCopyLink = "https://docs.google.com/spreadsheets/d/1j6zm5iILvlt09rwW0jR5fRJ79s-L2BA0_Bl25MulJ74/copy";

    if (!process.env.EMAIL_USER || process.env.EMAIL_USER.includes('your-email')) {
      console.warn('⚠️ SMTP credentials not configured in .env.local');
      return NextResponse.json({ error: 'Mail system not configured' }, { status: 500 });
    }

    // Standard Nodemailer transporter using env vars
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"PowerSight System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Nhiệm vụ: Báo cáo kết quả hoạt động kinh doanh (Phòng Tài chính)',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">PowerSight - Nhiệm vụ tự động</h2>
          <p>Xin chào,</p>
          <p>Theo phân công trên lịch làm việc ngày hôm nay, dưới đây là file dữ liệu báo cáo thô cần được xử lý:</p>
          
          <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; font-weight: bold;">Yêu cầu công việc:</p>
            <ul style="margin-top: 10px;">
              <li>Tạo bản sao của file báo cáo bên dưới.</li>
              <li>Thực hiện tính tổng, format lại giao diện cho dễ nhìn.</li>
              <li>Sử dụng Chatbot của hệ thống để nhận lệnh hỗ trợ nếu cần. <i>(Lưu ý: Không tự ý mở các tab ngoài Google Sheets và Gmail để tránh vi phạm).</i></li>
              <li>Sau khi hoàn tất, soạn email phản hồi đính kèm link bản báo cáo đã xử lý của bạn.</li>
            </ul>
          </div>

          <a href="${rawSheetCopyLink}" style="display: inline-block; padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Mở File Báo Cáo (Bản Sao)
          </a>

          <p style="margin-top: 30px; font-size: 0.85rem; color: #64748b;">
            Đây là email tự động từ hệ thống PowerSight.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Send email error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}
