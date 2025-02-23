import { NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = 'http://localhost:5033';

export async function GET(
  request: Request,
  context: { params: { serverId: string } }
) {
  try {
    const { serverId } = context.params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '100';
    
    // Forward the request to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/server/${serverId}/console?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get console output');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Console output error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get console output' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: { serverId: string } }
) {
  try {
    const { serverId } = context.params;
    const body = await request.json();

    // Forward the request to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/server/${serverId}/console`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send console command');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Console command error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send console command' },
      { status: 500 }
    );
  }
} 