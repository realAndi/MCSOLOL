import { NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = 'http://localhost:5033';

// Get console logs
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since'); // Timestamp to get logs after
    const limit = searchParams.get('limit') || '100'; // Number of log lines to return

    // Forward the console logs request to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/server/console?since=${since}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get console logs');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Console logs error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get console logs' },
      { status: 500 }
    );
  }
}

// Send console command
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { command } = body;

    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    // Forward the command to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/server/console`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send command');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Console command error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send command' },
      { status: 500 }
    );
  }
} 