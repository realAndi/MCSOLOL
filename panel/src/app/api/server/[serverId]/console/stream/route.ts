import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: { serverId: string } }
) {
  const serverId = context.params.serverId;
  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since');

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'  // Disable nginx buffering
  });

  let encoder = new TextEncoder();

  // Create a new TransformStream for streaming
  const stream = new TransformStream({
    async transform(chunk, controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
    }
  });

  // Create a ReadableStream that connects to the Python backend
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Connect to Python backend
        const response = await fetch(
          `http://localhost:5033/api/server/${serverId}/console/stream${since ? `?since=${since}` : ''}`,
          {
            headers: {
              'Accept': 'text/event-stream'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Backend responded with ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();

        // Read from the backend stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Forward the chunks to our stream
          const text = new TextDecoder().decode(value);
          const events = text.split('\n\n').filter(Boolean);

          for (const event of events) {
            if (event.startsWith('data: ')) {
              const data = event.slice(6); // Remove 'data: ' prefix
              try {
                // Parse and re-stringify to ensure valid JSON
                const parsed = JSON.parse(data);
                controller.enqueue(parsed);
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      } catch (error) {
        console.error('SSE stream error:', error);
        controller.error(error);
      } finally {
        controller.close();
      }
    }
  });

  // Pipe the readable stream through our transform stream
  return new NextResponse(readable.pipeThrough(stream), { headers });
} 