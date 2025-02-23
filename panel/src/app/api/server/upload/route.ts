import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { mkdir } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';
import { sanitizeFolderName } from '@/lib/utils';

const execAsync = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const type = formData.get('type') as string;

    if (!file || !name || !type) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const folderName = sanitizeFolderName(name);
    const serversDir = path.join(process.cwd(), 'tests', 'dashboard', 'servers');
    const serverDir = path.join(serversDir, folderName);

    // Create server directory
    await mkdir(serverDir, { recursive: true });

    // Convert the file to a Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (type === 'jar') {
      // Save the JAR file
      const jarPath = path.join(serverDir, 'server.jar');
      await writeFile(jarPath, buffer);
    } else if (type === 'zip') {
      // Save the ZIP file temporarily
      const zipPath = path.join(serverDir, 'temp.zip');
      await writeFile(zipPath, buffer);

      // Extract the ZIP file
      await execAsync(`unzip -o "${zipPath}" -d "${serverDir}"`);

      // Delete the temporary ZIP file
      fs.unlinkSync(zipPath);

      // Check if server.jar exists in the extracted files
      if (!fs.existsSync(path.join(serverDir, 'server.jar'))) {
        throw new Error('No server.jar found in the uploaded ZIP file');
      }
    }

    return NextResponse.json({
      success: true,
      path: serverDir,
      name: folderName
    });
  } catch (error) {
    console.error('Server upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process server files' },
      { status: 500 }
    );
  }
} 