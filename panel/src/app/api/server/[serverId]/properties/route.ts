import { NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = 'http://localhost:5033';

export async function POST(
  request: Request,
  context: { params: { serverId: string } }
) {
  try {
    const { serverId } = context.params;
    const body = await request.json();

    // Forward the request to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/server/${serverId}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update server properties');
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Server properties update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update server properties' },
      { status: 500 }
    );
  }
} 