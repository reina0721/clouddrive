import { NextResponse, type NextRequest } from 'next/server';
import { backendDestination } from './backend-proxy';

// Keep transport, streaming and cookies in Next's proxy; Go owns authorization.
// Read the upstream at runtime so the same artifact can move between deployments.
export function proxy(request: NextRequest) {
  return NextResponse.rewrite(backendDestination(request.url));
}

export const config = {
  matcher: ['/api/:path*', '/wopi/:path*', '/management/:path*'],
};
