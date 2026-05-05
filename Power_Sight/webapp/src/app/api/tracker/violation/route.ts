import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/tracker/violation
// Body: { employeeId, sessionId, eventType, details, severity, isFraud, module }
// Inserts a violation record into Supabase fraud_events
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      employeeId = 'EM001',
      sessionId,
      eventType = 'FACE_MISMATCH',
      details,
      severity = 'WARNING',
      isFraud = true,
      module = 'Face',
      similarity, // Optional, for backward compatibility
    } = body;

    const now = new Date();

    // --- Log to Supabase ---
    const { error: dbError } = await supabase
      .from('fraud_events')
      .insert([{
        emp_id: employeeId,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        event_type: eventType,
        severity: severity.toUpperCase(),
        details: details || (eventType === 'FACE_MISMATCH' ? `Face verification failed - Similarity: ${similarity}` : ''),
        is_fraud: isFraud ? 1 : 0,
        module: module,
        session_id: sessionId,
        timestamp: now.toISOString()
      }]);

    if (dbError) {
      console.error('[ViolationAPI] Supabase Insert Error:', dbError);
      return NextResponse.json({ error: 'Không thể ghi vi phạm vào database' }, { status: 500 });
    }

    console.log(`[ViolationAPI] Logged ${eventType} for ${employeeId} to Supabase`);

    return NextResponse.json({ success: true, timestamp: now.toISOString() });
  } catch (error) {
    console.error('[ViolationAPI] Error:', error);
    return NextResponse.json({ error: 'Lỗi server khi ghi vi phạm' }, { status: 500 });
  }
}
