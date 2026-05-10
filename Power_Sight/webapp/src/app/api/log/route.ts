import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { type, severity, details, timestamp } = data;

    // ANSI escape codes for coloring
    const red = '\x1b[31m';
    const yellow = '\x1b[33m';
    const blue = '\x1b[34m';
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';

    const color = severity === 'critical' ? red : yellow;

    console.log(`\n${bold}${color}⚠️ VIOLATION DETECTED [${timestamp}]${reset}`);
    console.log(`${bold}Type:${reset} ${type}`);
    console.log(`${bold}Severity:${reset} ${severity}`);
    console.log(`${bold}Details:${reset} ${JSON.stringify(details, null, 2)}`);
    console.log(`${color}-------------------------------------------${reset}\n`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
