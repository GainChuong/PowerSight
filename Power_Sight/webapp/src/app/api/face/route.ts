import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TEST_EMPLOYEE_ID = 'EM001';

// GET /api/face?employeeId=EM001
// Returns the stored face_descriptor for the employee
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId') || TEST_EMPLOYEE_ID;

    const { data, error } = await supabase
      .from('employees')
      .select('face_descriptor')
      .eq('emp_id', employeeId)
      .maybeSingle();

    if (error) {
      console.error('[Face API] GET Supabase error:', error);
      return NextResponse.json({ faceDescriptor: null });
    }

    return NextResponse.json({ faceDescriptor: data?.face_descriptor ?? null });
  } catch (error) {
    console.error('[Face API] GET Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/face
// Body: { employeeId: string, descriptor: number[] | null }
// Saves (or clears) face_descriptor in Supabase employees table
export async function POST(req: Request) {
  try {
    const { employeeId = TEST_EMPLOYEE_ID, descriptor } = await req.json();

    // If descriptor is null, just clear the face from DB (re-register case)
    if (descriptor === null) {
      const { error } = await supabase
        .from('employees')
        .update({ face_descriptor: null })
        .eq('emp_id', employeeId);
      if (error) {
        console.warn('[Face API] Could not clear face descriptor:', error.message);
      }
      return NextResponse.json({ success: true, cleared: true });
    }

    if (!Array.isArray(descriptor)) {
      return NextResponse.json({ error: 'Invalid descriptor format' }, { status: 400 });
    }

    // Upsert employee record with face descriptor
    // If EM001 already exists (from Excel data sync), this will update the face_descriptor column only
    const { error } = await supabase
      .from('employees')
      .upsert(
        {
          emp_id: employeeId,
          full_name: employeeId === TEST_EMPLOYEE_ID ? 'Test Employee 001' : employeeId,
          email: `${employeeId.toLowerCase()}@powersight.local`,
          sap_id: `SAP_${employeeId}`,
          password_hash: 'test_hash',
          face_descriptor: descriptor,
        },
        { onConflict: 'emp_id' }
      );

    if (error) {
      console.error('[Face API] Supabase upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Face API] POST Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
