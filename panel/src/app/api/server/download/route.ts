import { NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = 'http://localhost:5033';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Forward the request to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/server/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to download server');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Server download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download server' },
      { status: 500 }
    );
  }
} 