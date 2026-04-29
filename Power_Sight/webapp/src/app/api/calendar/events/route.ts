import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { searchParams } = new URL(request.url);
  const empId = searchParams.get('empId');
  const month = searchParams.get('month');
  const year = searchParams.get('year');

  if (!empId || !month || !year) {
    return NextResponse.json({ error: 'Missing empId, month, or year' }, { status: 400 });
  }

  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;

  // Fetch regular events for this month
  const { data: events, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('emp_id', empId)
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('start_time', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also fetch recurring events that could generate instances in this range
  const { data: recurringEvents } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('emp_id', empId)
    .eq('is_recurring', true)
    .is('recurrence_parent_id', null)
    .lte('event_date', endDate)
    .order('start_time', { ascending: true });

  // Generate recurring event instances
  const generatedEvents = generateRecurringInstances(
    recurringEvents || [],
    startDate,
    endDate
  );

  // Combine: regular events + generated recurring instances (dedup by checking recurrence_parent_id)
  const existingParentIds = new Set(
    (events || []).filter(e => e.recurrence_parent_id).map(e => `${e.recurrence_parent_id}-${e.event_date}`)
  );

  const newGenerated = generatedEvents.filter(
    e => !existingParentIds.has(`${e.recurrence_parent_id}-${e.event_date}`)
  );

  // Filter out recurring parents that already have child instances in this range from events list
  const regularEvents = (events || []).filter(e => !e.is_recurring || e.recurrence_parent_id);

  const allEvents = [...regularEvents, ...newGenerated].sort((a, b) => {
    if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
    return (a.start_time || '').localeCompare(b.start_time || '');
  });

  return NextResponse.json({ events: allEvents });
}

function generateRecurringInstances(
  recurringEvents: Array<Record<string, unknown>>,
  startDate: string,
  endDate: string
) {
  const generated: Array<Record<string, unknown>> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (const event of recurringEvents) {
    const eventDate = new Date(event.event_date as string);
    const recurrenceEnd = event.recurrence_end_date
      ? new Date(event.recurrence_end_date as string)
      : new Date(end.getFullYear(), end.getMonth() + 3, end.getDate()); // 3 months ahead max

    const actualEnd = recurrenceEnd < end ? recurrenceEnd : end;

    let current = new Date(eventDate);

    while (current <= actualEnd) {
      if (current >= start && current <= end && current.toISOString().slice(0, 10) !== (event.event_date as string)) {
        generated.push({
          ...event,
          id: `recurring-${event.id}-${current.toISOString().slice(0, 10)}`,
          event_date: current.toISOString().slice(0, 10),
          recurrence_parent_id: event.id,
          is_generated: true,
        });
      }

      // Advance date based on recurrence type
      switch (event.recurrence_type) {
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
        default:
          current = new Date(actualEnd.getTime() + 86400000); // break loop
      }
    }
  }

  return generated;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const body = await request.json();

  const { emp_id, title, description, category, event_date, start_time, end_time, color, is_recurring, recurrence_type, recurrence_end_date, assigned_by } = body;

  if (!emp_id || !title || !event_date || !start_time || !end_time) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      emp_id,
      title,
      description: description || null,
      category: category || 'other',
      event_date,
      start_time,
      end_time,
      color: color || '#3b82f6',
      is_recurring: is_recurring || false,
      recurrence_type: is_recurring ? recurrence_type : null,
      recurrence_end_date: is_recurring ? recurrence_end_date : null,
      assigned_by: assigned_by || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: data });
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: data });
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
