import React, { useState } from 'react';

interface TrimJob {
  id: number;
  fileName: string;
  startTime: string;
  endTime: string;
  duration: number;
  lossless: boolean;
  status: string;
  progress: number;
  outputFile?: string;
  outputSize?: number;
  fileSize: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export const VideoTrimmer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [currentJob, setCurrentJob] = useState<TrimJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Time inputs
  const [startHours, setStartHours] = useState('00');
  const [startMinutes, setStartMinutes] = useState('00');
  const [startSeconds, setStartSeconds] = useState('00');
  const [endHours, setEndHours] = useState('00');
  const [endMinutes, setEndMinutes] = useState('01');
  const [endSeconds, setEndSeconds] = useState('00');
  const [lossless, setLossless] = useState(true);

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

  const formatTime = (h: string, m: string, s: string): string => {
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
  };

  const handleTrim = async () => {
    if (!fileId) return;

    const startTime = formatTime(startHours, startMinutes, startSeconds);
    const endTime = formatTime(endHours, endMinutes, endSeconds);

    setTrimming(true);
    setError(null);

    try {
      const response = await fetch('http://127.0.0.1:4001/api/trim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          startTime,
          endTime,
          lossless,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Trim failed');
      }

      const data = await response.json();

      // Poll for job status
      pollJobStatus(data.jobId);
    } catch (err: any) {
      console.error('Trim error:', err);
      setError(err.message || 'Failed to start trim job');
      setTrimming(false);
    }
  };

  const pollJobStatus = async (jobId: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:4001/api/trim/jobs/${jobId}`);
        const data = await response.json();

        setCurrentJob(data.job);

        if (data.job.status === 'completed') {
          clearInterval(interval);
          setTrimming(false);
        } else if (data.job.status === 'failed') {
          clearInterval(interval);
          setTrimming(false);
          setError(data.job.error || 'Trim failed');
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
        `http://127.0.0.1:4001/api/trim/jobs/${currentJob.id}/download`
      );

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentJob.fileName.replace(/(\.[^.]+)$/, '_trimmed$1');
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

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleTimeInput = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    max: number
  ) => {
    const num = parseInt(value) || 0;
    if (num >= 0 && num <= max) {
      setter(num.toString().padStart(2, '0'));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="feature-title text-2xl font-bold mb-6">Video Trimmer</h2>
        <p className="text-gray-600 mb-6">
          Cut specific segments from your videos. Choose lossless mode for instant trimming without
          re-encoding.
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

        {/* Time Inputs */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={startHours}
                onChange={(e) => handleTimeInput(e.target.value, setStartHours, 23)}
                className="w-16 px-3 py-2 border border-gray-300 rounded text-center"
                placeholder="HH"
                min="0"
                max="23"
              />
              <span className="text-xl font-bold">:</span>
              <input
                type="number"
                value={startMinutes}
                onChange={(e) => handleTimeInput(e.target.value, setStartMinutes, 59)}
                className="w-16 px-3 py-2 border border-gray-300 rounded text-center"
                placeholder="MM"
                min="0"
                max="59"
              />
              <span className="text-xl font-bold">:</span>
              <input
                type="number"
                value={startSeconds}
                onChange={(e) => handleTimeInput(e.target.value, setStartSeconds, 59)}
                className="w-16 px-3 py-2 border border-gray-300 rounded text-center"
                placeholder="SS"
                min="0"
                max="59"
              />
            </div>
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={endHours}
                onChange={(e) => handleTimeInput(e.target.value, setEndHours, 23)}
                className="w-16 px-3 py-2 border border-gray-300 rounded text-center"
                placeholder="HH"
                min="0"
                max="23"
              />
              <span className="text-xl font-bold">:</span>
              <input
                type="number"
                value={endMinutes}
                onChange={(e) => handleTimeInput(e.target.value, setEndMinutes, 59)}
                className="w-16 px-3 py-2 border border-gray-300 rounded text-center"
                placeholder="MM"
                min="0"
                max="59"
              />
              <span className="text-xl font-bold">:</span>
              <input
                type="number"
                value={endSeconds}
                onChange={(e) => handleTimeInput(e.target.value, setEndSeconds, 59)}
                className="w-16 px-3 py-2 border border-gray-300 rounded text-center"
                placeholder="SS"
                min="0"
                max="59"
              />
            </div>
          </div>
        </div>

        {/* Lossless Option */}
        <div className="mb-6">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={lossless}
              onChange={(e) => setLossless(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              <strong>Lossless mode</strong> (instant, no re-encoding)
            </span>
          </label>
          <p className="ml-6 mt-1 text-xs text-gray-500">
            Lossless mode is ultra-fast but may have minor keyframe inaccuracy. Uncheck for
            frame-accurate trimming (slower).
          </p>
        </div>

        {/* Trim Button */}
        <div className="mb-6">
          <button
            onClick={handleTrim}
            disabled={!fileId || uploading || trimming}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {trimming ? 'Trimming Video...' : 'Trim Video'}
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
                {currentJob.status === 'completed' ? 'Completed' : 'Trimming...'}
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
                <p className="text-sm text-gray-600">Video trimmed successfully!</p>
                <p className="text-sm text-gray-600">
                  Duration: {formatDuration(currentJob.duration)}
                </p>
                <p className="text-sm text-gray-600">
                  Size: {formatFileSize(currentJob.outputSize)}
                </p>
                <button
                  onClick={handleDownload}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded font-semibold hover:bg-green-700 transition-colors"
                >
                  Download Trimmed Video
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
