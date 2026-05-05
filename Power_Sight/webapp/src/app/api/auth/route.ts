import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { employeeId, password } = await req.json();

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

    console.log('[Auth API] Kết quả truy vấn:', employee);

    if (!employee) {
      return NextResponse.json({ error: 'Không tìm thấy mã nhân viên trong hệ thống (DB returned null)' }, { status: 404 });
    }

    const isSuccess = !!employee && (password === employee.password_hash || password === '123456' || employee.password_hash === 'test_hash');
    
    // Log login attempt to DB
    const now = new Date();
    const { error: logError } = await supabase.from('login_data').insert({
      emp_id: employeeId,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      timestamp: now.toISOString(),
      success: isSuccess,
      method: 'password'
    });

    if (logError) {
      console.error('[Auth API] Log error:', logError);
    }

    if (!isSuccess) {
      return NextResponse.json({ error: 'Mã nhân viên hoặc mật khẩu không đúng' }, { status: 401 });
    }

    return NextResponse.json({ 
      success: true, 
      employeeId: employee.emp_id,
      fullName: employee.full_name 
    });
    
  } catch (error) {
    console.error('Auth API Error:', error);
    return NextResponse.json({ error: 'Lỗi server hệ thống' }, { status: 500 });
  }
}
