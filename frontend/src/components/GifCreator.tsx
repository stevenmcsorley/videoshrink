import React, { useState } from 'react';

interface GifJob {
  id: number;
  fileName: string;
  startTime: string;
  endTime: string;
  duration: number;
  fps: number;
  width: number;
  optimize: boolean;
  status: string;
  progress: number;
  outputFile?: string;
  outputSize?: number;
  fileSize: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

const SIZE_PRESETS = [
  { label: 'Small (320px)', value: 320 },
  { label: 'Medium (480px)', value: 480 },
  { label: 'Large (640px)', value: 640 },
  { label: 'XL (800px)', value: 800 },
];

export const GifCreator: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [currentJob, setCurrentJob] = useState<GifJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // GIF settings
  const [startTime, setStartTime] = useState('0');
  const [duration, setDuration] = useState('5');
  const [fps, setFps] = useState(10);
  const [width, setWidth] = useState(480);
  const [optimize, setOptimize] = useState(true);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);

    // Upload file immediately
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://127.0.0.1:4001/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setFileId(data.fileId);
      setUploading(false);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload file');
      setUploading(false);
    }
  };

  const handleCreateGif = async () => {
    if (!fileId) return;

    const start = parseFloat(startTime) || 0;
    const dur = parseFloat(duration) || 5;
    const end = start + dur;

    if (dur > 30) {
      setError('GIF duration cannot exceed 30 seconds');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch('http://127.0.0.1:4001/api/gif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          startTime: start.toString(),
          endTime: end.toString(),
          fps,
          width,
          optimize,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'GIF creation failed');
      }

      const data = await response.json();

      // Poll for job status
      pollJobStatus(data.jobId);
    } catch (err: any) {
      console.error('GIF creation error:', err);
      setError(err.message || 'Failed to create GIF');
      setCreating(false);
    }
  };

  const pollJobStatus = async (jobId: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:4001/api/gif/jobs/${jobId}`);
        const data = await response.json();

        setCurrentJob(data.job);

        if (data.job.status === 'completed') {
          clearInterval(interval);
          setCreating(false);
        } else if (data.job.status === 'failed') {
          clearInterval(interval);
          setCreating(false);
          setError(data.job.error || 'GIF creation failed');
        }
      } catch (err) {
        console.error('Failed to fetch job status:', err);
      }
    }, 1000);
  };

  const handleDownload = async () => {
    if (!currentJob) return;

    try {
      const response = await fetch(
        `http://127.0.0.1:4001/api/gif/jobs/${currentJob.id}/download`
      );

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentJob.fileName.replace(/\.[^.]+$/, '.gif');
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">🎬 GIF Creator</h2>
        <p className="text-gray-600 mb-6">
          Convert video clips to high-quality animated GIFs with custom settings
        </p>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Video File
          </label>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 cursor-pointer"
          />
          {uploading && <p className="mt-2 text-sm text-blue-600">Uploading file...</p>}
          {selectedFile && !uploading && (
            <p className="mt-2 text-sm text-green-600">✓ {selectedFile.name} uploaded</p>
          )}
        </div>

        {/* Time Settings */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Time (seconds)
            </label>
            <input
              type="number"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              min="0"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (seconds, max 30)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              min="0.1"
              max="30"
              step="0.1"
            />
          </div>
        </div>

        {/* FPS Slider */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Frame Rate: {fps} FPS
          </label>
          <input
            type="range"
            value={fps}
            onChange={(e) => setFps(parseInt(e.target.value))}
            className="w-full"
            min="5"
            max="30"
            step="1"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>5 FPS (smaller file)</span>
            <span>30 FPS (smoother)</span>
          </div>
        </div>

        {/* Size Presets */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {SIZE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setWidth(preset.value)}
                className={`px-4 py-2 rounded border ${
                  width === preset.value
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Optimization Option */}
        <div className="mb-6">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={optimize}
              onChange={(e) => setOptimize(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              <strong>Optimize quality</strong> (uses palette, slower but better colors)
            </span>
          </label>
        </div>

        {/* Create Button */}
        <div className="mb-6">
          <button
            onClick={handleCreateGif}
            disabled={!fileId || uploading || creating}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? 'Creating GIF...' : 'Create GIF'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">❌ {error}</p>
          </div>
        )}

        {/* Progress Display */}
        {currentJob && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {currentJob.status === 'completed' ? 'Completed' : 'Creating GIF...'}
              </span>
              <span className="text-sm text-gray-600">{currentJob.progress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className={`h-2 rounded-full transition-all ${
                  currentJob.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${currentJob.progress}%` }}
              />
            </div>

            {currentJob.status === 'completed' && currentJob.outputSize && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">GIF created successfully!</p>
                <p className="text-sm text-gray-600">
                  Duration: {currentJob.duration}s • {currentJob.fps} FPS • {currentJob.width}px
                </p>
                <p className="text-sm text-gray-600">
                  Size: {formatFileSize(currentJob.outputSize)}
                </p>
                <button
                  onClick={handleDownload}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded font-semibold hover:bg-green-700 transition-colors"
                >
                  Download GIF
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
