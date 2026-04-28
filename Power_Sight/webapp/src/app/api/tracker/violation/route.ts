import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

// POST /api/tracker/violation
// Body: { employeeId, sessionId, details, similarity }
// Appends a FACE_MISMATCH row to the Fraud_Events sheet of the current month's work_logs xlsx
export async function POST(req: Request) {
  try {
    const {
      employeeId = 'EM001',
      sessionId,
      details,
      similarity,
    } = await req.json();

    // Determine the current month folder
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const folderName = `${year}_${month}`;
    const dateStr = `${year}-${month}-${now.getDate().toString().padStart(2, '0')}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const timestamp = `${dateStr} ${timeStr}`;

    const dataPath = path.join(process.cwd(), 'generated_data', employeeId, folderName);
    const xlsxPath = path.join(dataPath, `work_logs_${employeeId}_${folderName}.xlsx`);

    if (!fs.existsSync(xlsxPath)) {
      return NextResponse.json(
        { error: `Không tìm thấy file work_logs tại: ${xlsxPath}` },
        { status: 404 }
      );
    }

    // Read the existing workbook
    const workBuf = fs.readFileSync(xlsxPath);
    const workbook = xlsx.read(workBuf, { type: 'buffer' });

    if (!workbook.SheetNames.includes('Fraud_Events')) {
      return NextResponse.json(
        { error: 'Sheet Fraud_Events không tồn tại trong file' },
        { status: 500 }
      );
    }

    // Build the new violation row
    const simScore = similarity != null ? parseFloat(similarity) : 0;
    const newRow = {
      Timestamp: timestamp,
      Event_Type: 'FACE_MISMATCH',
      Details: details || `Face verification failed - Similarity: ${simScore.toFixed(3)}`,
      User: employeeId,
      Session_ID: sessionId || `SESS_LIVE_${year}${month}${now.getDate().toString().padStart(2, '0')}`,
      Severity: 'WARNING',
      IsFraud: 1,
      Date: dateStr,
      Time: timeStr,
      Module: 'Face',
    };

    // Append to existing Fraud_Events sheet
    const sheet = workbook.Sheets['Fraud_Events'];
    const existingData = xlsx.utils.sheet_to_json(sheet);
    const updatedData = [...existingData, newRow];

    const newSheet = xlsx.utils.json_to_sheet(updatedData);
    workbook.Sheets['Fraud_Events'] = newSheet;

    // Write back to file
    const outBuf = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(xlsxPath, outBuf);

    console.log(`[ViolationAPI] Logged FACE_MISMATCH for ${employeeId} at ${timestamp}`);

    return NextResponse.json({ success: true, timestamp });
  } catch (error) {
    console.error('[ViolationAPI] Error:', error);
    return NextResponse.json({ error: 'Lỗi server khi ghi vi phạm' }, { status: 500 });
  }
}
