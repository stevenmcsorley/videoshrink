/**
 * Frame Extractor Component
 * Extract frame sequences from video files
 */
import React, { useMemo, useRef, useState } from 'react';

interface FrameJob {
  id: number;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  outputFiles?: string[];
  estimatedFrames?: number;
  frameCount?: number | null;
  fps?: number;
  outputFormat?: 'jpg' | 'png';
  startTime?: string;
  endTime?: string;
  createdAt: string;
}

const API_BASE = 'http://127.0.0.1:4001';

const FrameExtractor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<'jpg' | 'png'>('jpg');
  const [fps, setFps] = useState<string>('1');
  const [startHours, setStartHours] = useState<string>('00');
  const [startMinutes, setStartMinutes] = useState<string>('00');
  const [startSecondsPart, setStartSecondsPart] = useState<string>('00');
  const [endHours, setEndHours] = useState<string>('');
  const [endMinutes, setEndMinutes] = useState<string>('');
  const [endSecondsPart, setEndSecondsPart] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [jobs, setJobs] = useState<FrameJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setVideoDuration(null);
      setError(null);
      const url = URL.createObjectURL(selectedFile);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration || null);
        URL.revokeObjectURL(url);
      };
      video.onerror = () => {
        setVideoDuration(null);
        URL.revokeObjectURL(url);
      };
      video.src = url;
    }
  };

  const parseTimePartsToSeconds = (hours: string, minutes: string, seconds: string): number | null => {
    if (!hours && !minutes && !seconds) return null;
    const h = parseInt(hours || '0', 10);
    const m = parseInt(minutes || '0', 10);
    const s = parseInt(seconds || '0', 10);
    if ([h, m, s].some((value) => Number.isNaN(value))) return null;
    return h * 3600 + m * 60 + s;
  };

  const formatTimeParts = (hours: string, minutes: string, seconds: string): string | null => {
    if (!hours && !minutes && !seconds) return null;
    const h = (hours || '0').padStart(2, '0');
    const m = (minutes || '0').padStart(2, '0');
    const s = (seconds || '0').padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleTimeInput = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    max: number
  ) => {
    if (value === '') {
      setter('');
      return;
    }
    const num = parseInt(value, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= max) {
      setter(num.toString().padStart(2, '0'));
    }
  };

  const estimatedFrames = useMemo(() => {
    if (!videoDuration) return null;
    const fpsValue = fps ? parseFloat(fps) : NaN;
    if (!fpsValue || Number.isNaN(fpsValue) || fpsValue <= 0) return null;
    const startSecondsValue =
      parseTimePartsToSeconds(startHours, startMinutes, startSecondsPart) ?? 0;
    const endSecondsValue =
      parseTimePartsToSeconds(endHours, endMinutes, endSecondsPart) ?? videoDuration;
    if (Number.isNaN(startSecondsValue) || Number.isNaN(endSecondsValue)) return null;
    const clampedStart = Math.max(0, Math.min(startSecondsValue, videoDuration));
    const clampedEnd = Math.max(clampedStart, Math.min(endSecondsValue, videoDuration));
    const duration = clampedEnd - clampedStart;
    return Math.max(1, Math.ceil(duration * fpsValue));
  }, [videoDuration, fps, startHours, startMinutes, startSecondsPart, endHours, endMinutes, endSecondsPart]);

  const handleExtract = async () => {
    if (!file) {
      setError('Please select a video file');
      return;
    }

    const fpsValue = fps ? parseFloat(fps) : NaN;
    if (fps && (Number.isNaN(fpsValue) || fpsValue < 0.1 || fpsValue > 60)) {
      setError('FPS must be between 0.1 and 60');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('format', format);
      if (fps) formData.append('fps', fps);
      const startTime = formatTimeParts(startHours, startMinutes, startSecondsPart);
      const endTime = formatTimeParts(endHours, endMinutes, endSecondsPart);
      if (startTime) formData.append('startTime', startTime);
      if (endTime) formData.append('endTime', endTime);

      const response = await fetch(`${API_BASE}/api/frames`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create frame job');
      }

      const data = await response.json();
      const newJob: FrameJob = {
        id: data.jobId,
        fileName: file.name,
        status: 'pending',
        progress: 0,
        estimatedFrames: data.estimatedFrames,
        fps: data.fps,
        outputFormat: data.format,
        startTime: data.startTime,
        endTime: data.endTime,
        createdAt: new Date().toISOString(),
      };

      setJobs([newJob, ...jobs]);
      pollJobProgress(data.jobId);

      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Error extracting frames:', err);
      setError(err.message || 'Failed to extract frames');
    } finally {
      setLoading(false);
    }
  };

  const pollJobProgress = async (jobId: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/frames/jobs/${jobId}`);
        if (!response.ok) {
          clearInterval(interval);
          return;
        }

        const data = await response.json();
        const job = data.job;

        setJobs((prevJobs) =>
          prevJobs.map((item) =>
                item.id === jobId
                  ? {
                      ...item,
                      status: job.status,
                      progress: job.progress,
                      error: job.error,
                      outputFiles: job.outputFiles ? JSON.parse(job.outputFiles) : undefined,
                      estimatedFrames: job.estimatedFrames,
                      frameCount: job.frameCount,
                      startTime: job.startTime,
                      endTime: job.endTime,
                      outputFormat: job.outputFormat,
                      fps: job.fps,
                    }
                  : item
              )
            );

        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling job progress:', err);
        clearInterval(interval);
      }
    }, 2000);
  };

  const handleDownloadZip = async (jobId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/frames/jobs/${jobId}/download`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `frames_${jobId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading ZIP:', err);
      alert('Failed to download ZIP');
    }
  };

  const handleDelete = async (jobId: number) => {
    if (!confirm('Delete this frame extraction job?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/frames/jobs/${jobId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Delete failed');
      setJobs(jobs.filter((job) => job.id !== jobId));
    } catch (err) {
      console.error('Error deleting job:', err);
      alert('Failed to delete job');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'processing':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'processing':
        return '⏳';
      case 'failed':
        return '❌';
      default:
        return '⏸️';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="feature-title text-3xl font-bold mb-6">Frame Extractor</h2>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Video File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              cursor-pointer"
          />
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: <span className="font-medium">{file.name}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Output Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'jpg' | 'png')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Frame Rate (FPS)
            </label>
            <input
              type="number"
              min="0.1"
              max="60"
              step="0.1"
              value={fps}
              onChange={(e) => setFps(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Lower FPS produces fewer frames and smaller ZIPs
            </p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Time (optional)
            </label>
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
              value={startSecondsPart}
              onChange={(e) => handleTimeInput(e.target.value, setStartSecondsPart, 59)}
                className="w-16 px-3 py-2 border border-gray-300 rounded text-center"
                placeholder="SS"
                min="0"
                max="59"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Start at 00:00:00 if left empty
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Time (optional)
            </label>
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
              value={endSecondsPart}
              onChange={(e) => handleTimeInput(e.target.value, setEndSecondsPart, 59)}
                className="w-16 px-3 py-2 border border-gray-300 rounded text-center"
                placeholder="SS"
                min="0"
                max="59"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              If blank, uses full video duration
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span>
            Duration: {videoDuration ? `${videoDuration.toFixed(1)}s` : '...'}
          </span>
          <span>
            Estimated Frames: {estimatedFrames ? estimatedFrames.toLocaleString() : '...'}
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleExtract}
          disabled={!file || loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? '⏳ Creating Job...' : '🎞️ Extract Frames'}
        </button>
      </div>

      {jobs.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Frame Extraction Jobs</h3>

          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getStatusIcon(job.status)}</span>
                      <span className="font-medium text-gray-900">{job.fileName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className={`font-medium ${getStatusColor(job.status)}`}>
                        Status: {job.status.toUpperCase()}
                      </span>
                      <span>Job ID: {job.id}</span>
                      <span>{new Date(job.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-4">
                      <span>FPS: {job.fps ?? '-'}</span>
                      <span>Format: {job.outputFormat?.toUpperCase()}</span>
                      <span>
                        Range: {job.startTime ?? '0'} - {job.endTime ?? 'end'}
                      </span>
                      <span>
                        Estimated Frames: {job.estimatedFrames ?? '...'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(job.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium ml-4"
                  >
                    🗑️ Delete
                  </button>
                </div>

                {job.status === 'processing' && (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Extracting frames...</span>
                      <span className="font-medium text-blue-600">
                        {job.progress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {job.error && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <strong>Error:</strong> {job.error}
                  </div>
                )}

                {job.status === 'completed' && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Extracted <strong>{job.frameCount ?? job.outputFiles?.length ?? 0}</strong> frames
                    </p>
                    <button
                      onClick={() => handleDownloadZip(job.id)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      ⬇️ Download ZIP
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FrameExtractor;
