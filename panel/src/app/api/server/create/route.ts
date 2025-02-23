import { NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = 'http://localhost:5033';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: 'Server name is required' }, { status: 400 });
    }

    // Forward the request to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/server/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: body.name,
        version: body.version,
        settings: {
          ...body.settings,
          // Convert boolean values to strings
          ...Object.entries(body.settings || {}).reduce((acc, [key, value]) => ({
            ...acc,
            [key]: typeof value === 'boolean' ? String(value) : value
          }), {})
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create server instance');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Server creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create server instance' },
      { status: 500 }
    );
  }
} 