import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { searchParams } = new URL(request.url);
  const empId = searchParams.get('empId');
  const date = searchParams.get('date');
  const month = searchParams.get('month');
  const year = searchParams.get('year');

  if (!empId) {
    return NextResponse.json({ error: 'Missing empId' }, { status: 400 });
  }

  let query = supabase
    .from('calendar_tasks')
    .select('*')
    .eq('emp_id', empId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (date) {
    // Single date
    query = query.eq('task_date', date);
  } else if (month && year) {
    // Full month
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;
    query = query.gte('task_date', startDate).lte('task_date', endDate);
  }

  const { data: tasks, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: tasks || [] });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const body = await request.json();

  const { emp_id, task_date, title, description, category, priority, assigned_by } = body;

  if (!emp_id || !task_date || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get max sort_order for this date
  const { data: existing } = await supabase
    .from('calendar_tasks')
    .select('sort_order')
    .eq('emp_id', emp_id)
    .eq('task_date', task_date)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 0;

  const { data, error } = await supabase
    .from('calendar_tasks')
    .insert({
      emp_id,
      task_date,
      title,
      description: description || null,
      category: category || 'other',
      priority: priority || 'medium',
      sort_order: nextOrder,
      assigned_by: assigned_by || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('calendar_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: data });
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('calendar_tasks')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
