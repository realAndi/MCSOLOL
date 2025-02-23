import { NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = 'http://localhost:5033';

export async function DELETE(
  request: Request,
  context: { params: { serverId: string } }
) {
  try {
    const { serverId } = context.params;

    // Forward the delete request to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/server/${serverId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete server');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Server deletion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete server' },
      { status: 500 }
    );
  }
} 