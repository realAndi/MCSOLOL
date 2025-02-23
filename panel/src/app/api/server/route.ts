import { NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = 'http://localhost:5033';

export async function GET(request: Request) {
  try {
    // Forward the request to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/server`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to list servers');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Server list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list servers' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Forward the request to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/server/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create server');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Server creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create server' },
      { status: 500 }
    );
  }
} 