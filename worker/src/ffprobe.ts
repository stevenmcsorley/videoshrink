/**
 * FFprobe Utility - Probe video file metadata
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VideoMetadata {
  duration: number; // in seconds
  bitrate: number; // in kbps
  width: number;
  height: number;
  codec: string;
  fileSize: number; // in bytes
}

/**
 * Probe video file to extract metadata
 */
export async function probeVideo(filePath: string): Promise<VideoMetadata> {
  try {
    // Use ffprobe to get video metadata in JSON format
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
    );

    const data = JSON.parse(stdout);

    // Find video stream
    const videoStream = data.streams?.find(
      (s: any) => s.codec_type === 'video'
    );

    if (!videoStream) {
      throw new Error('No video stream found in file');
    }

    // Extract metadata
    const duration = parseFloat(data.format?.duration || '0');
    const fileSize = parseInt(data.format?.size || '0');
    const formatBitrate = parseInt(data.format?.bit_rate || '0');

    // Calculate bitrate in kbps
    // Prefer format bitrate, fallback to calculation from file size and duration
    let bitrate: number;
    if (formatBitrate > 0) {
      bitrate = Math.round(formatBitrate / 1000); // Convert to kbps
    } else if (duration > 0 && fileSize > 0) {
      // Calculate: (fileSize in bytes * 8 bits/byte) / duration / 1000 = kbps
      bitrate = Math.round((fileSize * 8) / duration / 1000);
    } else {
      throw new Error('Could not determine video bitrate');
    }

    return {
      duration,
      bitrate,
      width: parseInt(videoStream.width || '0'),
      height: parseInt(videoStream.height || '0'),
      codec: videoStream.codec_name || 'unknown',
      fileSize,
    };
  } catch (error: any) {
    throw new Error(`Failed to probe video: ${error.message}`);
  }
}

/**
 * Calculate target bitrate based on input bitrate and target size percentage
 */
export function calculateTargetBitrate(
  inputBitrate: number,
  targetSizePercent: number
): number {
  // Target bitrate should be proportional to target size percentage
  // Add a safety margin to account for container overhead
  const targetBitrate = Math.round(inputBitrate * (targetSizePercent / 100) * 0.95);

  // Ensure minimum quality - don't go below 500 kbps
  return Math.max(targetBitrate, 500);
}
