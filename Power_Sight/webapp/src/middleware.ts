import { type NextRequest, NextResponse } from 'next/server'

// Middleware đơn giản - chỉ pass-through, không gọi Supabase Auth
// (App dùng custom auth context, không cần Supabase session middleware)
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
