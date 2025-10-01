/**
 * Thumbnail generation utility functions
 * Used by compression and conversion workers to auto-generate thumbnails
 */
import { FFmpegExecutor } from './ffmpeg-executor.js';
import path from 'path';

export interface ThumbnailOptions {
  inputFile: string;
  outputDir?: string;
  timestamp?: string;
  width?: number;
}

/**
 * Generate a single thumbnail from a video file
 * Returns the path to the generated thumbnail
 */
export async function generateSingleThumbnail(options: ThumbnailOptions): Promise<string> {
  const {
    inputFile,
    outputDir = path.dirname(inputFile),
    timestamp = '1', // 1 second into the video by default
    width = 320,
  } = options;

  const baseFileName = path.basename(inputFile, path.extname(inputFile));
  const outputFile = path.join(outputDir, `${baseFileName}_thumb.jpg`);

  const command = [
    'ffmpeg',
    '-ss', timestamp,              // Seek to timestamp
    '-i', inputFile,
    '-vframes', '1',               // Extract 1 frame
    '-vf', `scale=${width}:-1`,    // Scale to width, maintain aspect ratio
    '-q:v', '2',                   // High quality JPEG
    '-y',
    outputFile,
  ];

  const executor = new FFmpegExecutor();

  console.log(`[Thumbnail Utils] Generating thumbnail for ${baseFileName} at ${timestamp}s...`);

  const result = await executor.execute({
    command,
    timeout: 30000, // 30 second timeout for thumbnail
  });

  if (!result.success) {
    throw new Error(`Thumbnail generation failed: ${result.error}`);
  }

  console.log(`[Thumbnail Utils] Thumbnail generated: ${outputFile}`);
  return outputFile;
}

/**
 * Try to generate a thumbnail, but don't fail the job if it errors
 * Returns the thumbnail path or null if generation failed
 */
export async function tryGenerateThumbnail(options: ThumbnailOptions): Promise<string | null> {
  try {
    return await generateSingleThumbnail(options);
  } catch (error: any) {
    console.error('[Thumbnail Utils] Failed to generate thumbnail:', error.message);
    return null;
  }
}
