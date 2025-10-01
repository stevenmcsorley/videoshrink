/**
 * Supported video and audio formats configuration
 */

export interface FormatInfo {
  name: string;
  extension: string;
  mimeType: string;
  category: 'video' | 'audio';
  description: string;
  codecs?: string[];
}

export interface ConversionRule {
  from: string;
  to: string;
  recommended: boolean;
  notes?: string;
}

// Supported video formats
export const VIDEO_FORMATS: FormatInfo[] = [
  {
    name: 'MP4',
    extension: 'mp4',
    mimeType: 'video/mp4',
    category: 'video',
    description: 'MPEG-4 Part 14 (most compatible)',
    codecs: ['h264', 'h265', 'mpeg4'],
  },
  {
    name: 'MKV',
    extension: 'mkv',
    mimeType: 'video/x-matroska',
    category: 'video',
    description: 'Matroska Video (open source)',
    codecs: ['h264', 'h265', 'vp9'],
  },
  {
    name: 'AVI',
    extension: 'avi',
    mimeType: 'video/x-msvideo',
    category: 'video',
    description: 'Audio Video Interleave (legacy)',
    codecs: ['mpeg4', 'h264'],
  },
  {
    name: 'MOV',
    extension: 'mov',
    mimeType: 'video/quicktime',
    category: 'video',
    description: 'QuickTime Movie (Apple)',
    codecs: ['h264', 'h265', 'prores'],
  },
  {
    name: 'WebM',
    extension: 'webm',
    mimeType: 'video/webm',
    category: 'video',
    description: 'WebM Video (web optimized)',
    codecs: ['vp8', 'vp9', 'av1'],
  },
  {
    name: 'FLV',
    extension: 'flv',
    mimeType: 'video/x-flv',
    category: 'video',
    description: 'Flash Video (legacy)',
    codecs: ['h264', 'flv1'],
  },
  {
    name: 'WMV',
    extension: 'wmv',
    mimeType: 'video/x-ms-wmv',
    category: 'video',
    description: 'Windows Media Video',
    codecs: ['wmv2', 'wmv3'],
  },
  {
    name: 'M4V',
    extension: 'm4v',
    mimeType: 'video/x-m4v',
    category: 'video',
    description: 'iTunes Video',
    codecs: ['h264'],
  },
  {
    name: 'MPG',
    extension: 'mpg',
    mimeType: 'video/mpeg',
    category: 'video',
    description: 'MPEG-1/MPEG-2 Video (legacy)',
    codecs: ['mpeg1video', 'mpeg2video'],
  },
  {
    name: 'MPEG',
    extension: 'mpeg',
    mimeType: 'video/mpeg',
    category: 'video',
    description: 'MPEG Video',
    codecs: ['mpeg1video', 'mpeg2video'],
  },
];

// Supported audio formats
export const AUDIO_FORMATS: FormatInfo[] = [
  {
    name: 'MP3',
    extension: 'mp3',
    mimeType: 'audio/mpeg',
    category: 'audio',
    description: 'MPEG Audio Layer 3 (most compatible)',
  },
  {
    name: 'AAC',
    extension: 'aac',
    mimeType: 'audio/aac',
    category: 'audio',
    description: 'Advanced Audio Coding (high quality)',
  },
  {
    name: 'M4A',
    extension: 'm4a',
    mimeType: 'audio/mp4',
    category: 'audio',
    description: 'MPEG-4 Audio (Apple)',
  },
  {
    name: 'FLAC',
    extension: 'flac',
    mimeType: 'audio/flac',
    category: 'audio',
    description: 'Free Lossless Audio Codec',
  },
  {
    name: 'OGG',
    extension: 'ogg',
    mimeType: 'audio/ogg',
    category: 'audio',
    description: 'Ogg Vorbis (open source)',
  },
  {
    name: 'WAV',
    extension: 'wav',
    mimeType: 'audio/wav',
    category: 'audio',
    description: 'Waveform Audio (uncompressed)',
  },
  {
    name: 'WMA',
    extension: 'wma',
    mimeType: 'audio/x-ms-wma',
    category: 'audio',
    description: 'Windows Media Audio',
  },
  {
    name: 'OPUS',
    extension: 'opus',
    mimeType: 'audio/opus',
    category: 'audio',
    description: 'Opus Audio (low latency)',
  },
];

// Common conversion rules
export const CONVERSION_RULES: ConversionRule[] = [
  // Video conversions
  { from: 'mkv', to: 'mp4', recommended: true, notes: 'Most compatible conversion' },
  { from: 'avi', to: 'mp4', recommended: true, notes: 'Legacy to modern format' },
  { from: 'flv', to: 'mp4', recommended: true, notes: 'Flash to modern format' },
  { from: 'mov', to: 'mp4', recommended: true, notes: 'Apple to universal format' },
  { from: 'wmv', to: 'mp4', recommended: true, notes: 'Windows to universal format' },
  { from: 'mpg', to: 'mp4', recommended: true, notes: 'MPEG to modern format' },
  { from: 'mpeg', to: 'mp4', recommended: true, notes: 'MPEG to modern format' },
  { from: 'mp4', to: 'webm', recommended: true, notes: 'Web optimization' },
  { from: 'mkv', to: 'webm', recommended: false },
  { from: 'avi', to: 'mkv', recommended: false },

  // Audio conversions
  { from: 'flac', to: 'mp3', recommended: true, notes: 'Lossless to compressed' },
  { from: 'wav', to: 'mp3', recommended: true, notes: 'Uncompressed to compressed' },
  { from: 'flac', to: 'aac', recommended: true, notes: 'Lossless to high quality' },
  { from: 'mp3', to: 'aac', recommended: false },
  { from: 'wma', to: 'mp3', recommended: true },
  { from: 'ogg', to: 'mp3', recommended: true },
  { from: 'wav', to: 'flac', recommended: true, notes: 'Uncompressed to lossless' },
];

// Get all supported formats
export function getAllFormats(): FormatInfo[] {
  return [...VIDEO_FORMATS, ...AUDIO_FORMATS];
}

// Get formats by category
export function getFormatsByCategory(category: 'video' | 'audio'): FormatInfo[] {
  return getAllFormats().filter((f) => f.category === category);
}

// Get format by extension
export function getFormatByExtension(extension: string): FormatInfo | undefined {
  const ext = extension.toLowerCase().replace('.', '');
  return getAllFormats().find((f) => f.extension === ext);
}

// Check if conversion is supported
export function isConversionSupported(from: string, to: string): boolean {
  const fromFormat = getFormatByExtension(from);
  const toFormat = getFormatByExtension(to);

  if (!fromFormat || !toFormat) return false;

  // Can't convert between different categories
  if (fromFormat.category !== toFormat.category) return false;

  return true;
}

// Get conversion recommendation
export function getConversionRecommendation(
  from: string,
  to: string
): ConversionRule | undefined {
  const fromExt = from.toLowerCase().replace('.', '');
  const toExt = to.toLowerCase().replace('.', '');

  return CONVERSION_RULES.find((r) => r.from === fromExt && r.to === toExt);
}

// Get recommended target formats for a source format
export function getRecommendedTargets(from: string): FormatInfo[] {
  const fromExt = from.toLowerCase().replace('.', '');
  const recommendedRules = CONVERSION_RULES.filter(
    (r) => r.from === fromExt && r.recommended
  );

  return recommendedRules
    .map((rule) => getFormatByExtension(rule.to))
    .filter((f): f is FormatInfo => f !== undefined);
}
