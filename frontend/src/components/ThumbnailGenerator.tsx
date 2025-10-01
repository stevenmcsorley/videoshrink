/**
 * Thumbnail Generator Component
 * Generate multiple thumbnails from video files
 */
import React, { useState, useRef } from 'react';

interface ThumbnailJob {
  id: number;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  outputFiles?: string[];
  createdAt: string;
}

const ThumbnailGenerator: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [count, setCount] = useState<number>(4);
  const [width, setWidth] = useState<number>(320);
  const [jobs, setJobs] = useState<ThumbnailJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Size presets
  const sizePresets = [
    { label: 'Small', value: 240 },
    { label: 'Medium', value: 320 },
    { label: 'Large', value: 480 },
    { label: 'Extra Large', value: 640 },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleGenerate = async () => {
    if (!file) {
      setError('Please select a video file');
      return;
    }

    if (count < 1 || count > 50) {
      setError('Thumbnail count must be between 1 and 50');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('count', count.toString());
      formData.append('width', width.toString());

      const response = await fetch('http://localhost:4001/api/thumbnail', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create thumbnail job');
      }

      const data = await response.json();
      const newJob: ThumbnailJob = {
        id: data.jobId,
        fileName: file.name,
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString(),
      };

      setJobs([newJob, ...jobs]);

      // Start polling for progress
      pollJobProgress(data.jobId);

      // Reset form
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Error generating thumbnails:', err);
      setError(err.message || 'Failed to generate thumbnails');
    } finally {
      setLoading(false);
    }
  };

  const pollJobProgress = async (jobId: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:4001/api/thumbnail/jobs/${jobId}`);
        if (!response.ok) {
          clearInterval(interval);
          return;
        }

        const data = await response.json();

        setJobs((prevJobs) =>
          prevJobs.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status: data.status,
                  progress: data.progress,
                  error: data.error,
                  outputFiles: data.outputFiles ? JSON.parse(data.outputFiles) : undefined,
                }
              : job
          )
        );

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling job progress:', err);
        clearInterval(interval);
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleDownload = async (jobId: number, index: number) => {
    try {
      const response = await fetch(
        `http://localhost:4001/api/thumbnail/jobs/${jobId}/download/${index}`
      );
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thumbnail_${index + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading thumbnail:', err);
      alert('Failed to download thumbnail');
    }
  };

  const handleDownloadAll = async (jobId: number) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || !job.outputFiles) return;

    for (let i = 0; i < job.outputFiles.length; i++) {
      await handleDownload(jobId, i);
      // Small delay between downloads
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };

  const handleDelete = async (jobId: number) => {
    if (!confirm('Delete this thumbnail job?')) return;

    try {
      const response = await fetch(`http://localhost:4001/api/thumbnail/jobs/${jobId}`, {
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
      <h2 className="text-3xl font-bold mb-6">📸 Thumbnail Generator</h2>

      {/* Upload Form */}
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
          {/* Thumbnail Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Thumbnails (1-50)
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Thumbnails will be evenly distributed across the video duration
            </p>
          </div>

          {/* Thumbnail Width */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Thumbnail Size
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {sizePresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setWidth(preset.value)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    width === preset.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {preset.label} ({preset.value}px)
                </button>
              ))}
            </div>
            <input
              type="number"
              min="240"
              max="1920"
              value={width}
              onChange={(e) => setWidth(parseInt(e.target.value) || 320)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!file || loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? '⏳ Creating Job...' : '📸 Generate Thumbnails'}
        </button>
      </div>

      {/* Jobs List */}
      {jobs.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Thumbnail Jobs</h3>

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
                  </div>

                  <button
                    onClick={() => handleDelete(job.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium ml-4"
                  >
                    🗑️ Delete
                  </button>
                </div>

                {/* Progress Bar */}
                {job.status === 'processing' && (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Generating thumbnails...</span>
                      <span className="font-medium text-blue-600">{job.progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {job.error && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <strong>Error:</strong> {job.error}
                  </div>
                )}

                {/* Thumbnail Grid */}
                {job.status === 'completed' && job.outputFiles && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-gray-600">
                        Generated <strong>{job.outputFiles.length}</strong> thumbnails
                      </p>
                      <button
                        onClick={() => handleDownloadAll(job.id)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        ⬇️ Download All
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      {job.outputFiles.map((_, index) => (
                        <div
                          key={index}
                          className="relative group border border-gray-200 rounded-lg overflow-hidden hover:border-blue-400 transition-colors"
                        >
                          {/* Placeholder for thumbnail preview */}
                          <div className="aspect-video bg-gray-100 flex items-center justify-center">
                            <span className="text-2xl">🖼️</span>
                          </div>

                          {/* Download overlay */}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => handleDownload(job.id, index)}
                              className="opacity-0 group-hover:opacity-100 bg-white text-gray-900 px-3 py-1 rounded-md text-sm font-medium transition-opacity"
                            >
                              ⬇️ Download
                            </button>
                          </div>

                          {/* Thumbnail number */}
                          <div className="absolute top-1 left-1 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                            #{index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
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

export default ThumbnailGenerator;
