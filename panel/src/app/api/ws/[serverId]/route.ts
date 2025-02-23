import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: { serverId: string } }
) {
  try {
    const serverId = context.params.serverId;
    
    // Check for WebSocket upgrade request
    const upgradeHeader = request.headers.get('upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new NextResponse('Expected Upgrade: websocket', { status: 426 });
    }

    // Get the full path to preserve the /console segment if present
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const messageType = pathSegments[pathSegments.length - 1] === 'console' ? 'console' : 'status';
    
    // Forward the WebSocket connection to the Python backend
    const wsUrl = `ws://localhost:8765/${serverId}/${messageType}`;
    console.log('Forwarding WebSocket connection to:', wsUrl);
    
    // Forward the WebSocket connection
    const response = await fetch(wsUrl, {
      method: 'GET',
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Key': request.headers.get('sec-websocket-key') ?? '',
        'Sec-WebSocket-Version': request.headers.get('sec-websocket-version') ?? '13',
        'Sec-WebSocket-Protocol': request.headers.get('sec-websocket-protocol') ?? ''
      }
    });

    if (response.status !== 101) {
      console.error('Failed to upgrade connection:', response.status, response.statusText);
      return new NextResponse('Failed to upgrade connection', { status: 502 });
    }

    // Forward the upgrade response
    const upgradeHeaders = new Headers(response.headers);
    upgradeHeaders.set('connection', 'upgrade');
    upgradeHeaders.set('upgrade', 'websocket');

    return new NextResponse(null, {
      status: 101,
      headers: upgradeHeaders,
    });
  } catch (error) {
    console.error('WebSocket proxy error:', error);
    return new NextResponse('Failed to connect to WebSocket server', { status: 500 });
  }
} 