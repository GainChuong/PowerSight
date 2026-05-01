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

    // Kiểm tra mật khẩu (Trong môi trường dev hiện tại, so sánh trực tiếp hoặc so sánh với 'test_hash')
    // Kiểm tra mật khẩu (So sánh với bcrypt trong thực tế, hiện tại hỗ trợ fallback '123456')
    if (password && employee.password_hash !== password && employee.password_hash !== 'test_hash' && password !== '123456') {
      return NextResponse.json({ error: 'Mật khẩu không chính xác' }, { status: 401 });
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
