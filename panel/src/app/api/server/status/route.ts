import { NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = 'http://localhost:5033';

export async function GET(req: Request) {
  try {
    // Forward the status request to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/server/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get server status');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Server status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get server status' },
      { status: 500 }
    );
  }
} 