/**
 * FFmpeg Format Conversion Generator
 * Generates FFmpeg commands for format conversion
 */

export interface ConversionOptions {
  inputFile: string;
  outputFile: string;
  fromFormat: string;
  toFormat: string;
  preset?: 'fast' | 'balanced' | 'high-quality' | 'web-optimized' | 'audio-lossless' | 'audio-compressed';
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  crf?: number;
  resolution?: string;
  copyStreams?: boolean; // Just remux container without re-encoding
}

export interface ConversionCommand {
  command: string[];
  type: 'remux' | 'transcode';
}

export class ConversionGenerator {
  /**
   * Generate FFmpeg command for format conversion
   */
  static generate(options: ConversionOptions): ConversionCommand {
    const {
      inputFile,
      outputFile,
      fromFormat,
      toFormat,
      preset,
      copyStreams,
    } = options;

    // Check if we can just remux (change container without re-encoding)
    if (copyStreams || this.canRemux(fromFormat, toFormat)) {
      return this.generateRemux(options);
    }

    // Need to transcode
    return this.generateTranscode(options);
  }

  /**
   * Check if we can remux without transcoding
   * Remuxing is faster and lossless, only changes the container format
   */
  private static canRemux(from: string, to: string): boolean {
    const remuxPairs = [
      ['mkv', 'mp4'],
      ['mp4', 'mkv'],
      ['mov', 'mp4'],
      ['m4v', 'mp4'],
    ];

    const fromExt = from.toLowerCase().replace('.', '');
    const toExt = to.toLowerCase().replace('.', '');

    return remuxPairs.some(
      ([f, t]) =>
        (f === fromExt && t === toExt) || (f === toExt && t === fromExt)
    );
  }

  /**
   * Generate remux command (container change only, no re-encoding)
   */
  private static generateRemux(options: ConversionOptions): ConversionCommand {
    const { inputFile, outputFile } = options;

    const command: string[] = [
      'ffmpeg',
      '-i', inputFile,
      '-c', 'copy', // Copy all streams without re-encoding
      '-movflags', '+faststart', // Enable fast start for web playback
      '-y',
      outputFile,
    ];

    return { command, type: 'remux' };
  }

  /**
   * Generate transcode command (re-encode video/audio)
   */
  private static generateTranscode(options: ConversionOptions): ConversionCommand {
    const {
      inputFile,
      outputFile,
      toFormat,
      preset,
      videoCodec,
      audioCodec,
      videoBitrate,
      audioBitrate,
      crf,
      resolution,
    } = options;

    const command: string[] = ['ffmpeg', '-i', inputFile];

    // Get preset configuration
    const presetConfig = preset ? this.getPresetParams(preset, toFormat) : {};

    // Video codec
    const vCodec = videoCodec || presetConfig.videoCodec || this.getDefaultVideoCodec(toFormat);
    if (vCodec) {
      command.push('-c:v', vCodec);

      // Video quality settings
      if (crf !== undefined) {
        command.push('-crf', crf.toString());
      } else if (videoBitrate) {
        command.push('-b:v', videoBitrate);
      } else if (presetConfig.crf) {
        command.push('-crf', presetConfig.crf.toString());
      } else if (presetConfig.videoBitrate) {
        command.push('-b:v', presetConfig.videoBitrate);
      }

      // Encoding preset (speed vs quality)
      if (presetConfig.encodingPreset) {
        command.push('-preset', presetConfig.encodingPreset);
      }

      // Resolution
      if (resolution) {
        command.push('-vf', `scale=${resolution}`);
      }
    }

    // Audio codec
    const aCodec = audioCodec || presetConfig.audioCodec || this.getDefaultAudioCodec(toFormat);
    if (aCodec) {
      command.push('-c:a', aCodec);

      // Audio bitrate
      if (audioBitrate) {
        command.push('-b:a', audioBitrate);
      } else if (presetConfig.audioBitrate) {
        command.push('-b:a', presetConfig.audioBitrate);
      }
    }

    // Output options
    command.push('-movflags', '+faststart');
    command.push('-y'); // Overwrite output

    command.push(outputFile);

    return { command, type: 'transcode' };
  }

  /**
   * Get preset parameters
   */
  private static getPresetParams(
    preset: string,
    toFormat: string
  ): {
    videoCodec?: string;
    audioCodec?: string;
    crf?: number;
    videoBitrate?: string;
    audioBitrate?: string;
    encodingPreset?: string;
  } {
    const isWebM = toFormat.toLowerCase().includes('webm');

    switch (preset) {
      case 'fast':
        return {
          videoCodec: isWebM ? 'libvpx' : 'libx264',
          audioCodec: isWebM ? 'libvorbis' : 'aac',
          crf: 28,
          audioBitrate: '128k',
          encodingPreset: 'veryfast',
        };

      case 'balanced':
        return {
          videoCodec: isWebM ? 'libvpx-vp9' : 'libx264',
          audioCodec: isWebM ? 'libopus' : 'aac',
          crf: 23,
          audioBitrate: '192k',
          encodingPreset: 'medium',
        };

      case 'high-quality':
        return {
          videoCodec: isWebM ? 'libvpx-vp9' : 'libx264',
          audioCodec: isWebM ? 'libopus' : 'aac',
          crf: 18,
          audioBitrate: '256k',
          encodingPreset: 'slow',
        };

      case 'web-optimized':
        return {
          videoCodec: 'libvpx-vp9',
          audioCodec: 'libopus',
          videoBitrate: '1M',
          audioBitrate: '128k',
          encodingPreset: 'medium',
        };

      case 'audio-lossless':
        return {
          audioCodec: 'flac',
        };

      case 'audio-compressed':
        return {
          audioCodec: 'libmp3lame',
          audioBitrate: '320k',
        };

      default:
        return {};
    }
  }

  /**
   * Get default video codec for output format
   */
  private static getDefaultVideoCodec(format: string): string | undefined {
    const ext = format.toLowerCase().replace('.', '');

    const codecMap: { [key: string]: string } = {
      mp4: 'libx264',
      mkv: 'libx264',
      webm: 'libvpx-vp9',
      avi: 'mpeg4',
      mov: 'libx264',
      flv: 'libx264',
      wmv: 'wmv2',
      m4v: 'libx264',
      mpg: 'mpeg2video',
      mpeg: 'mpeg2video',
    };

    return codecMap[ext];
  }

  /**
   * Get default audio codec for output format
   */
  private static getDefaultAudioCodec(format: string): string | undefined {
    const ext = format.toLowerCase().replace('.', '');

    const codecMap: { [key: string]: string } = {
      mp4: 'aac',
      mkv: 'aac',
      webm: 'libopus',
      avi: 'mp3',
      mov: 'aac',
      flv: 'aac',
      wmv: 'wmav2',
      m4v: 'aac',
      mp3: 'libmp3lame',
      aac: 'aac',
      m4a: 'aac',
      flac: 'flac',
      ogg: 'libvorbis',
      wav: 'pcm_s16le',
      wma: 'wmav2',
      opus: 'libopus',
    };

    return codecMap[ext];
  }

  /**
   * Check if format is audio-only
   */
  static isAudioFormat(format: string): boolean {
    const audioFormats = ['mp3', 'aac', 'm4a', 'flac', 'ogg', 'wav', 'wma', 'opus'];
    const ext = format.toLowerCase().replace('.', '');
    return audioFormats.includes(ext);
  }

  /**
   * Extract audio from video
   */
  static generateAudioExtract(options: ConversionOptions): ConversionCommand {
    const { inputFile, outputFile, audioCodec, audioBitrate } = options;

    const command: string[] = [
      'ffmpeg',
      '-i', inputFile,
      '-vn', // No video
      '-c:a', audioCodec || 'libmp3lame',
    ];

    if (audioBitrate) {
      command.push('-b:a', audioBitrate);
    }

    command.push('-y', outputFile);

    return { command, type: 'transcode' };
  }
}
