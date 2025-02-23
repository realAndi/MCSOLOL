import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper to convert server name to folder name
function sanitizeFolderName(name: string): string {
  return name
    .toLowerCase()
    // Replace spaces and special characters with dashes
    .replace(/\s+/g, '-')
    // Remove invalid filesystem characters (including /, \, :, *, ?, ", <, >, |)
    .replace(/[/\\:*?"<>|]+/g, '')
    // Replace multiple dashes with single dash
    .replace(/-+/g, '-')
    // Remove any non-alphanumeric characters (except dashes)
    .replace(/[^a-z0-9-]/g, '')
    // Remove leading/trailing dashes
    .replace(/^-+|-+$/g, '')
    // If empty (all characters were invalid), provide a default name
    .replace(/^$/, 'minecraft-server');
}

export async function POST(req: Request) {
  try {
    const { url, version, serverName } = await req.json();

    if (!url || !version || !serverName) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const folderName = sanitizeFolderName(serverName);

    // Create base servers directory
    const serversDir = path.join(process.cwd(), 'tests', 'dashboard', 'servers');
    if (!fs.existsSync(serversDir)) {
      fs.mkdirSync(serversDir, { recursive: true });
    }

    // Create temporary version directory for download
    const tempDir = path.join(serversDir, `vanilla-${version}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempJarPath = path.join(tempDir, `server.jar`);

    // Download the server jar
    await execAsync(`curl -L "${url}" -o "${tempJarPath}"`);

    // Verify the download
    if (!fs.existsSync(tempJarPath) || fs.statSync(tempJarPath).size === 0) {
      throw new Error('Failed to download server jar');
    }

    // Create final server directory
    const serverDir = path.join(serversDir, folderName);
    if (fs.existsSync(serverDir)) {
      throw new Error('Server with this name already exists');
    }

    // Move the jar to the final location
    fs.renameSync(tempDir, serverDir);

    return NextResponse.json({
      success: true,
      path: serverDir,
      name: folderName
    });
  } catch (error) {
    console.error('Server download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download server' },
      { status: 500 }
    );
  }
} 