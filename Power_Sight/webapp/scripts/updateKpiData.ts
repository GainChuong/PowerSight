import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const kpiTargets: Record<string, number> = {
  'EM001': 90,
  'EM002': 70,
  'EM003': 50
};

async function updateKpis() {
  console.log('--- UPDATING KPI DATA ---');
  
  const updates = [];
  for (const empId of Object.keys(kpiTargets)) {
    for (let m = 1; m <= 4; m++) {
      updates.push({
        emp_id: empId,
        year: 2026,
        month: m,
        kpi_value: kpiTargets[empId]
      });
    }
  }

  // Clear existing KPI data for these months to avoid duplicates or confusion
  await supabase.from('kpi_data').delete()
    .eq('year', 2026)
    .in('month', [1, 2, 3, 4])
    .in('emp_id', ['EM001', 'EM002', 'EM003']);

  const { error } = await supabase.from('kpi_data').insert(updates);
  
  if (error) {
    console.error('Error updating KPIs:', error);
  } else {
    console.log('Successfully updated KPI targets:');
    console.log('- EM001: 90');
    console.log('- EM002: 70');
    console.log('- EM003: 50');
  }
}

updateKpis();
