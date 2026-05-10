import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const employees = ['EM001', 'EM002', 'EM003'];
const reportNames = [
  'Báo cáo tài chính Q1', 'Phân tích thị trường', 'Báo cáo nhân sự', 
  'Kế hoạch sản xuất', 'Kiểm kê kho', 'Báo cáo bán hàng', 
  'Phân tích đối thủ', 'Dự báo ngân sách', 'Báo cáo cổ đông'
];

async function seed() {
  console.log('--- SEEDING BUSINESS REPORTS ---');

  // Clear old data to ensure clean state
  await supabase.from('business_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('fraud_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const records = [];
  const frauds = [];

  for (const emp of employees) {
    let performanceMultiplier = 1;
    let errorRate = 0.05;
    let maxFraud = 10;
    
    if (emp === 'EM001') { performanceMultiplier = 1.2; errorRate = 0.02; maxFraud = 8; } // < 10
    if (emp === 'EM002') { performanceMultiplier = 1.0; errorRate = 0.10; maxFraud = 14; } // < 15
    if (emp === 'EM003') { performanceMultiplier = 0.7; errorRate = 0.25; maxFraud = 19; } // < 20

    for (let m = 1; m <= 4; m++) {
      // 1. Seed Reports
      const count = Math.floor(5 + Math.random() * 5);
      for (let i = 0; i < count; i++) {
        const isCompleted = Math.random() < performanceMultiplier;
        const profit = isCompleted ? (450000000 + Math.random() * 100000000) : 0;
        const errors = Math.random() < errorRate ? Math.floor(Math.random() * 3) + 1 : 0;

        records.push({
          emp_id: emp,
          report_name: reportNames[Math.floor(Math.random() * reportNames.length)] + ` #${i+1}`,
          processing_time_sec: Math.floor(1800 + Math.random() * 3600),
          error_count: errors,
          status: isCompleted ? 'completed' : 'pending',
          profit_generated: profit,
          year: 2026,
          month: m
        });
      }

      // 2. Seed Fraud Events (Violations)
      const fraudCount = Math.floor(maxFraud * 0.5 + Math.random() * (maxFraud * 0.5));
      for (let j = 0; j < fraudCount; j++) {
        frauds.push({
          emp_id: emp,
          event_type: 'FACE_MISMATCH',
          severity: Math.random() > 0.3 ? 'WARNING' : 'CRITICAL',
          details: 'Phát hiện khuôn mặt không khớp trong phiên làm việc',
          is_fraud: 1,
          module: 'Face',
          year: 2026,
          month: m,
          timestamp: new Date(2026, m - 1, Math.floor(Math.random() * 28) + 1).toISOString()
        });
      }
    }
  }

  const { error: repError } = await supabase.from('business_reports').insert(records);
  const { error: fraudError } = await supabase.from('fraud_events').insert(frauds);

  if (repError || fraudError) {
    console.error('Error seeding:', repError || fraudError);
  } else {
    console.log(`Successfully seeded ${records.length} reports and ${frauds.length} fraud events.`);
  }
}

seed();
