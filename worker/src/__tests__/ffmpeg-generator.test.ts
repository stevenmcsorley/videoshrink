import { FFmpegGenerator } from '../ffmpeg-generator';

describe('FFmpegGenerator', () => {
  describe('generate', () => {
    it('should generate single-pass command with default settings', () => {
      const options = {
        inputFile: '/input/video.mp4',
        outputFile: '/output/video.mp4',
      };

      const commands = FFmpegGenerator.generate(options);

      expect(commands).toHaveLength(1);
      expect(commands[0].passType).toBe('single');
      expect(commands[0].command).toContain('ffmpeg');
      expect(commands[0].command).toContain('-i');
      expect(commands[0].command).toContain('/input/video.mp4');
      expect(commands[0].command).toContain('/output/video.mp4');
    });

    it('should generate H.264 codec command', () => {
      const options = {
        inputFile: '/input/video.mp4',
        outputFile: '/output/video.mp4',
        codec: 'h264' as const,
      };

      const commands = FFmpegGenerator.generate(options);

      expect(commands[0].command).toContain('libx264');
    });

    it('should generate H.265 codec command', () => {
      const options = {
        inputFile: '/input/video.mp4',
        outputFile: '/output/video.mp4',
        codec: 'h265' as const,
      };

      const commands = FFmpegGenerator.generate(options);

      expect(commands[0].command).toContain('libx265');
    });

    it('should apply CRF quality setting', () => {
      const options = {
        inputFile: '/input/video.mp4',
        outputFile: '/output/video.mp4',
        crf: 20,
      };

      const commands = FFmpegGenerator.generate(options);

      expect(commands[0].command).toContain('-crf');
      expect(commands[0].command).toContain('20');
    });

    it('should apply bitrate setting', () => {
      const options = {
        inputFile: '/input/video.mp4',
        outputFile: '/output/video.mp4',
        bitrate: '2000k',
      };

      const commands = FFmpegGenerator.generate(options);

      expect(commands[0].command).toContain('-b:v');
      expect(commands[0].command).toContain('2000k');
    });

    it('should apply resolution scaling', () => {
      const options = {
        inputFile: '/input/video.mp4',
        outputFile: '/output/video.mp4',
        resolution: '1920x1080',
      };

      const commands = FFmpegGenerator.generate(options);

      expect(commands[0].command).toContain('-vf');
      expect(commands[0].command).toContain('scale=1920x1080');
    });

    it('should generate two-pass encoding commands', () => {
      const options = {
        inputFile: '/input/video.mp4',
        outputFile: '/output/video.mp4',
        twoPass: true,
      };

      const commands = FFmpegGenerator.generate(options);

      expect(commands).toHaveLength(2);
      expect(commands[0].passType).toBe('first');
      expect(commands[1].passType).toBe('second');
      expect(commands[0].command).toContain('-pass');
      expect(commands[0].command).toContain('1');
      expect(commands[1].command).toContain('-pass');
      expect(commands[1].command).toContain('2');
    });

    it('should include audio codec settings', () => {
      const options = {
        inputFile: '/input/video.mp4',
        outputFile: '/output/video.mp4',
        audioCodec: 'aac',
      };

      const commands = FFmpegGenerator.generate(options);

      expect(commands[0].command).toContain('-c:a');
      expect(commands[0].command).toContain('aac');
    });

    it('should include faststart flag for web playback', () => {
      const options = {
        inputFile: '/input/video.mp4',
        outputFile: '/output/video.mp4',
      };

      const commands = FFmpegGenerator.generate(options);

      expect(commands[0].command).toContain('-movflags');
      expect(commands[0].command).toContain('+faststart');
    });
  });

  describe('getPresetConfig', () => {
    it('should return high quality preset config', () => {
      const config = FFmpegGenerator.getPresetConfig('high');

      expect(config.codec).toBe('h265');
      expect(config.crf).toBe(20);
      expect(config.preset).toBe('high');
      expect(config.twoPass).toBe(true);
    });

    it('should return medium quality preset config', () => {
      const config = FFmpegGenerator.getPresetConfig('medium');

      expect(config.codec).toBe('h264');
      expect(config.crf).toBe(23);
      expect(config.preset).toBe('medium');
      expect(config.twoPass).toBe(false);
    });

    it('should return low quality preset config', () => {
      const config = FFmpegGenerator.getPresetConfig('low');

      expect(config.codec).toBe('h264');
      expect(config.crf).toBe(28);
      expect(config.preset).toBe('low');
      expect(config.twoPass).toBe(false);
    });
  });

  describe('parseResolution', () => {
    it('should parse valid resolution string', () => {
      const result = FFmpegGenerator.parseResolution('1920x1080');

      expect(result).toEqual({ width: 1920, height: 1080 });
    });

    it('should return null for invalid resolution', () => {
      const result = FFmpegGenerator.parseResolution('invalid');

      expect(result).toBeNull();
    });
  });

  describe('estimateOutputSize', () => {
    it('should calculate 50% target size', () => {
      const inputSize = 1000000; // 1MB
      const result = FFmpegGenerator.estimateOutputSize(inputSize, 50);

      expect(result).toBe(500000);
    });

    it('should calculate 25% target size', () => {
      const inputSize = 2000000; // 2MB
      const result = FFmpegGenerator.estimateOutputSize(inputSize, 25);

      expect(result).toBe(500000);
    });
  });

  describe('preset mapping', () => {
    it('should map high preset to slow encoding', () => {
      const options = {
        inputFile: '/input/video.mp4',
        outputFile: '/output/video.mp4',
        preset: 'high' as const,
      };

      const commands = FFmpegGenerator.generate(options);

      expect(commands[0].command).toContain('-preset');
      expect(commands[0].command).toContain('slow');
    });

    it('should map medium preset to medium encoding', () => {
      const options = {
        inputFile: '/input/video.mp4',
        outputFile: '/output/video.mp4',
        preset: 'medium' as const,
      };

      const commands = FFmpegGenerator.generate(options);

      expect(commands[0].command).toContain('-preset');
      expect(commands[0].command).toContain('medium');
    });

    it('should map low preset to fast encoding', () => {
      const options = {
        inputFile: '/input/video.mp4',
        outputFile: '/output/video.mp4',
        preset: 'low' as const,
      };

      const commands = FFmpegGenerator.generate(options);

      expect(commands[0].command).toContain('-preset');
      expect(commands[0].command).toContain('fast');
    });
  });
});
