import { NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = 'http://localhost:5033';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Forward the control request to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/server/control`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to control server');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Server control error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to control server' },
      { status: 500 }
    );
  }
} 