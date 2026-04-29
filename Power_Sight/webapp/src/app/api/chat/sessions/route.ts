import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: Lấy danh sách phiên trò chuyện của nhân viên
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const empId = searchParams.get('empId');

  if (!empId) {
    return NextResponse.json({ error: 'Missing empId' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, title, created_at, updated_at')
    .eq('emp_id', empId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions: data });
}

// POST: Tạo phiên trò chuyện mới
export async function POST(request: Request) {
  const { empId, title } = await request.json();

  if (!empId) {
    return NextResponse.json({ error: 'Missing empId' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ emp_id: empId, title: title || 'Cuộc trò chuyện mới' })
    .select('id, title, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data });
}

// DELETE: Xóa một phiên trò chuyện
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
