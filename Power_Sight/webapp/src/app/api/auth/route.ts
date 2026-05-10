import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { clearDashboardCache } from '../dashboard/route';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { employeeId, password, face_auth } = await req.json();

    if (!employeeId) {
      return NextResponse.json({ error: 'Mã nhân viên là bắt buộc' }, { status: 400 });
    }

    // Truy vấn Supabase để lấy thông tin nhân viên
    console.log('[Auth API] Đang kiểm tra mã nhân viên:', employeeId);
    
    const { data: employee, error } = await supabase
      .from('employees')
      .select('emp_id, password_hash, full_name')
      .eq('emp_id', employeeId)
      .maybeSingle();

    if (error) {
      console.error('[Auth API] Supabase Error:', error);
      return NextResponse.json({ error: 'Lỗi truy vấn cơ sở dữ liệu: ' + error.message }, { status: 500 });
    }

    if (!employee) {
      return NextResponse.json({ error: 'Không tìm thấy mã nhân viên trong hệ thống' }, { status: 404 });
    }

    // Xác thực
    let isSuccess = false;
    if (face_auth === true) {
      isSuccess = true;
    } else {
      // 1. So sánh với bcrypt hash (nếu có)
      if (employee.password_hash && employee.password_hash.startsWith('$2')) {
        isSuccess = await bcrypt.compare(password, employee.password_hash);
      } else {
        // 2. So sánh plain text nếu hash chưa chuẩn (legacy)
        isSuccess = (password === employee.password_hash);
      }
      
      // 3. Fallback cho mật khẩu mặc định 123456 (yêu cầu của user)
      if (!isSuccess && password === '123456') {
        isSuccess = true;
      }
    }
    
    // Log login attempt to DB
    const now = new Date();
    await supabase.from('login_data').insert({
      emp_id: employeeId,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      timestamp: now.toISOString(),
      success: isSuccess,
      method: face_auth ? 'face' : 'password'
    });

    if (!isSuccess) {
      return NextResponse.json({ error: 'Xác thực thất bại' }, { status: 401 });
    }

    // 3. Mandatory Daily Reset - Xóa dữ liệu của ngày hôm nay để bắt đầu phiên mới sạch sẽ
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const nowReset = new Date();
    const currentYear = nowReset.getFullYear();
    const currentMonth = nowReset.getMonth() + 1;

    try {
      // 1. Xóa vi phạm hôm nay
      await supabase.from('fraud_events').delete()
        .eq('emp_id', employeeId)
        .gte('timestamp', `${today}T00:00:00Z`)
        .lte('timestamp', `${today}T23:59:59Z`);

      // 2. Xóa sessions hôm nay
      await supabase.from('browser_sessions').delete()
        .eq('emp_id', employeeId)
        .gte('session_start', `${today}T00:00:00Z`)
        .lte('session_start', `${today}T23:59:59Z`);

      // 3. Xóa báo cáo hôm nay (business_reports)
      await supabase.from('business_reports').delete()
        .eq('emp_id', employeeId)
        .eq('year', currentYear)
        .gte('created_at', `${today}T00:00:00Z`);

      // 4. Xóa phiên chat hôm nay để bắt đầu AI sạch sẽ
      await supabase.from('chat_sessions').delete()
        .eq('emp_id', employeeId)
        .gte('created_at', `${today}T00:00:00Z`);

      // 5. Xóa cache dashboard để cập nhật số liệu ngay lập tức
      clearDashboardCache(employeeId);

      console.log(`[Auth] Full Daily Reset successful for ${employeeId} on ${today}`);
    } catch (resetErr) {
      console.error('[Auth] Failed to perform daily reset:', resetErr);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Face authentication successful',
      method: face_auth ? 'face' : 'password',
      employeeId: employee.emp_id,
      fullName: employee.full_name 
    });
    
  } catch (error) {
    console.error('Auth API Error:', error);
    return NextResponse.json({ error: 'Lỗi server hệ thống' }, { status: 500 });
  }
}
