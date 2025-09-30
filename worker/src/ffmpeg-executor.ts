/**
 * FFmpeg Executor
 * Spawns FFmpeg child processes and handles execution, progress parsing, and errors
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ExecutionOptions {
  command: string[];
  timeout?: number; // Timeout in milliseconds (default: 1 hour)
  onProgress?: (progress: number) => void;
  onLog?: (log: string) => void;
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  duration: number; // Execution time in milliseconds
}

export class FFmpegExecutor extends EventEmitter {
  private process: ChildProcess | null = null;
  private killed = false;
  private timeoutHandle: NodeJS.Timeout | null = null;

  /**
   * Execute FFmpeg command
   */
  async execute(options: ExecutionOptions): Promise<ExecutionResult> {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    return new Promise((resolve, reject) => {
      const [command, ...args] = options.command;

      // Spawn FFmpeg process
      this.process = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Set timeout (default: 1 hour)
      const timeout = options.timeout || 60 * 60 * 1000;
      this.timeoutHandle = setTimeout(() => {
        this.kill();
        reject(new Error(`FFmpeg process timed out after ${timeout}ms`));
      }, timeout);

      // Capture stdout
      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        stdout += output;

        if (options.onLog) {
          options.onLog(output);
        }
      });

      // Capture stderr (FFmpeg outputs progress to stderr)
      this.process.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        stderr += output;

        // Parse progress from FFmpeg output
        const progress = this.parseProgress(output);
        if (progress !== null && options.onProgress) {
          options.onProgress(progress);
        }

        if (options.onLog) {
          options.onLog(output);
        }
      });

      // Handle process exit
      this.process.on('close', (code: number | null) => {
        if (this.timeoutHandle) {
          clearTimeout(this.timeoutHandle);
        }

        const duration = Date.now() - startTime;

        if (this.killed) {
          resolve({
            success: false,
            stdout,
            stderr,
            error: 'Process was killed',
            duration,
          });
          return;
        }

        if (code === 0) {
          resolve({
            success: true,
            stdout,
            stderr,
            duration,
          });
        } else {
          const error = this.extractError(stderr);
          resolve({
            success: false,
            stdout,
            stderr,
            error: error || `FFmpeg exited with code ${code}`,
            duration,
          });
        }
      });

      // Handle process errors
      this.process.on('error', (err: Error) => {
        if (this.timeoutHandle) {
          clearTimeout(this.timeoutHandle);
        }

        const duration = Date.now() - startTime;

        reject({
          success: false,
          stdout,
          stderr,
          error: err.message,
          duration,
        });
      });
    });
  }

  /**
   * Kill the running FFmpeg process
   */
  kill(): void {
    if (this.process && !this.killed) {
      this.killed = true;
      this.process.kill('SIGKILL');
      this.emit('killed');
    }
  }

  /**
   * Parse progress percentage from FFmpeg output
   * FFmpeg outputs progress like: "time=00:01:23.45" or "frame=123"
   */
  private parseProgress(output: string): number | null {
    // Look for time progress
    const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const seconds = parseFloat(timeMatch[3]);
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;

      // Extract duration if available
      const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (durationMatch) {
        const dHours = parseInt(durationMatch[1]);
        const dMinutes = parseInt(durationMatch[2]);
        const dSeconds = parseFloat(durationMatch[3]);
        const totalDuration = dHours * 3600 + dMinutes * 60 + dSeconds;

        if (totalDuration > 0) {
          const progress = Math.min((totalSeconds / totalDuration) * 100, 100);
          return Math.round(progress * 10) / 10; // Round to 1 decimal place
        }
      }
    }

    // Look for progress percentage (used in two-pass encoding)
    const progressMatch = output.match(/progress=(\d+\.?\d*)%/);
    if (progressMatch) {
      return parseFloat(progressMatch[1]);
    }

    return null;
  }

  /**
   * Extract error message from FFmpeg stderr
   */
  private extractError(stderr: string): string | null {
    // Look for common FFmpeg error patterns
    const errorPatterns = [
      /Error: (.+)/i,
      /Invalid (.+)/i,
      /Cannot (.+)/i,
      /Failed (.+)/i,
      /(.+): No such file or directory/i,
    ];

    for (const pattern of errorPatterns) {
      const match = stderr.match(pattern);
      if (match) {
        return match[0];
      }
    }

    // Return last non-empty line as error
    const lines = stderr.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      return lines[lines.length - 1];
    }

    return null;
  }

  /**
   * Check if FFmpeg is installed and available
   */
  static async checkFFmpeg(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn('ffmpeg', ['-version']);

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Get FFmpeg version
   */
  static async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      let output = '';
      const process = spawn('ffmpeg', ['-version']);

      process.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          const match = output.match(/ffmpeg version (.+?) /);
          resolve(match ? match[1] : null);
        } else {
          resolve(null);
        }
      });

      process.on('error', () => {
        resolve(null);
      });
    });
  }
}
