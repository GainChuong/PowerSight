import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { employeeId } = await req.json();

    if (!employeeId) {
      return NextResponse.json({ error: 'Mã nhân viên là bắt buộc' }, { status: 400 });
    }

    // Kiểm tra thư mục nhân viên trong generated_data
    const generatedDataPath = path.join(process.cwd(), 'generated_data', employeeId);
    
    if (fs.existsSync(generatedDataPath)) {
      return NextResponse.json({ success: true, employeeId });
    } else {
      return NextResponse.json({ error: 'Không tìm thấy nhân viên trong dữ liệu hệ thống' }, { status: 404 });
    }
  } catch (error) {
    console.error('Auth API Error:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
