/**
 * FFmpeg Command Generator Library
 * Generates FFmpeg commands from job parameters
 */

export interface FFmpegOptions {
  inputFile: string;
  outputFile: string;
  codec?: 'h264' | 'h265';
  preset?: 'high' | 'medium' | 'low';
  crf?: number;
  bitrate?: string;
  resolution?: string;
  targetSizePercent?: number; // Target size as percentage (e.g., 50 = 50% of original)
  audioCodec?: string;
  twoPass?: boolean;
}

export interface FFmpegCommand {
  command: string[];
  passType?: 'single' | 'first' | 'second';
}

export class FFmpegGenerator {
  /**
   * Generate FFmpeg command(s) from job options
   */
  static generate(options: FFmpegOptions): FFmpegCommand[] {
    if (options.twoPass) {
      return [
        this.generateFirstPass(options),
        this.generateSecondPass(options),
      ];
    }

    return [this.generateSinglePass(options)];
  }

  /**
   * Generate single-pass encoding command
   */
  private static generateSinglePass(options: FFmpegOptions): FFmpegCommand {
    const command: string[] = ['ffmpeg', '-i', options.inputFile];

    // Video codec
    const codec = options.codec || 'h264';
    const codecMap = {
      h264: 'libx264',
      h265: 'libx265',
    };
    command.push('-c:v', codecMap[codec]);

    // Preset determines encoding speed vs quality
    if (options.preset) {
      const presetMap = {
        high: 'slow',    // Best quality, slowest
        medium: 'medium', // Balanced
        low: 'fast',     // Faster encoding, lower quality
      };
      command.push('-preset', presetMap[options.preset]);
    }

    // Quality settings
    if (options.crf !== undefined) {
      // CRF mode (Constant Rate Factor) - 0-51, lower is better quality
      command.push('-crf', options.crf.toString());
    } else if (options.bitrate) {
      // Bitrate mode
      command.push('-b:v', options.bitrate);
    } else if (options.targetSizePercent) {
      // Calculate target bitrate from target size percentage
      // This is a simplified calculation - real implementation would probe input file
      const estimatedBitrate = this.calculateTargetBitrate(options);
      command.push('-b:v', estimatedBitrate);
    } else {
      // Default to CRF 23 (good quality)
      command.push('-crf', '23');
    }

    // Resolution
    if (options.resolution) {
      command.push('-vf', `scale=${options.resolution}`);
    }

    // Audio codec
    command.push('-c:a', options.audioCodec || 'aac');
    command.push('-b:a', '128k');

    // Output options
    command.push('-movflags', '+faststart'); // Enable fast start for web playback
    command.push('-y'); // Overwrite output file

    command.push(options.outputFile);

    return { command, passType: 'single' };
  }

  /**
   * Generate first pass command for two-pass encoding
   */
  private static generateFirstPass(options: FFmpegOptions): FFmpegCommand {
    const command: string[] = ['ffmpeg', '-i', options.inputFile];

    const codec = options.codec || 'h264';
    const codecMap = {
      h264: 'libx264',
      h265: 'libx265',
    };
    command.push('-c:v', codecMap[codec]);

    if (options.preset) {
      const presetMap = {
        high: 'slow',
        medium: 'medium',
        low: 'fast',
      };
      command.push('-preset', presetMap[options.preset]);
    }

    // Calculate target bitrate
    const bitrate = options.bitrate || this.calculateTargetBitrate(options);
    command.push('-b:v', bitrate);

    if (options.resolution) {
      command.push('-vf', `scale=${options.resolution}`);
    }

    // First pass options
    command.push('-pass', '1');
    command.push('-an'); // No audio on first pass
    command.push('-f', 'null');

    // Platform-specific null output
    command.push(process.platform === 'win32' ? 'NUL' : '/dev/null');

    return { command, passType: 'first' };
  }

  /**
   * Generate second pass command for two-pass encoding
   */
  private static generateSecondPass(options: FFmpegOptions): FFmpegCommand {
    const command: string[] = ['ffmpeg', '-i', options.inputFile];

    const codec = options.codec || 'h264';
    const codecMap = {
      h264: 'libx264',
      h265: 'libx265',
    };
    command.push('-c:v', codecMap[codec]);

    if (options.preset) {
      const presetMap = {
        high: 'slow',
        medium: 'medium',
        low: 'fast',
      };
      command.push('-preset', presetMap[options.preset]);
    }

    // Calculate target bitrate
    const bitrate = options.bitrate || this.calculateTargetBitrate(options);
    command.push('-b:v', bitrate);

    if (options.resolution) {
      command.push('-vf', `scale=${options.resolution}`);
    }

    // Second pass options
    command.push('-pass', '2');

    // Audio codec
    command.push('-c:a', options.audioCodec || 'aac');
    command.push('-b:a', '128k');

    // Output options
    command.push('-movflags', '+faststart');
    command.push('-y');

    command.push(options.outputFile);

    return { command, passType: 'second' };
  }

  /**
   * Calculate target bitrate based on target size percentage
   * This is a simplified calculation - real implementation would probe input file
   */
  private static calculateTargetBitrate(options: FFmpegOptions): string {
    if (options.targetSizePercent) {
      // Simplified: assume average video is 5 Mbps, scale by target percentage
      const baseBitrate = 5000; // 5 Mbps in Kbps
      const targetBitrate = Math.round(baseBitrate * (options.targetSizePercent / 100));
      return `${targetBitrate}k`;
    }

    // Default to 2 Mbps
    return '2000k';
  }

  /**
   * Get preset configuration
   */
  static getPresetConfig(preset: 'high' | 'medium' | 'low'): Partial<FFmpegOptions> {
    const presets = {
      high: {
        codec: 'h265' as const,
        crf: 20,
        preset: 'high' as const,
        twoPass: true,
      },
      medium: {
        codec: 'h264' as const,
        crf: 23,
        preset: 'medium' as const,
        twoPass: false,
      },
      low: {
        codec: 'h264' as const,
        crf: 28,
        preset: 'low' as const,
        twoPass: false,
      },
    };

    return presets[preset];
  }

  /**
   * Parse resolution string to width and height
   */
  static parseResolution(resolution: string): { width: number; height: number } | null {
    const match = resolution.match(/^(\d+)x(\d+)$/);
    if (!match) return null;

    return {
      width: parseInt(match[1]),
      height: parseInt(match[2]),
    };
  }

  /**
   * Calculate estimated output size
   * Note: This is a rough estimation
   */
  static estimateOutputSize(
    inputSize: number,
    targetSizePercent: number
  ): number {
    return Math.round(inputSize * (targetSizePercent / 100));
  }
}
