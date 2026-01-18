import { useState, useEffect } from 'react';

interface ConversionJob {
  id: number;
  fileName: string;
  fromFormat: string;
  toFormat: string;
  preset: string | null;
  status: string;
  progress: number;
  fileSize: number;
  outputSize: number | null;
  createdAt: string;
  completedAt: string | null;
  thumbnailPath: string | null;
}

export default function ConversionHistory() {
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [filter]);

  const fetchJobs = async () => {
    try {
      const url =
        filter === 'all'
          ? 'http://127.0.0.1:4001/api/convert/jobs'
          : `http://127.0.0.1:4001/api/convert/jobs?status=${filter}`;

      const response = await fetch(url);
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Failed to fetch conversion jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (jobId: number) => {
    window.open(`http://127.0.0.1:4001/api/convert/jobs/${jobId}/download`, '_blank');
  };

  const handleDelete = async (jobId: number) => {
    if (!confirm('Are you sure you want to delete this conversion job?')) {
      return;
    }

    try {
      await fetch(`http://127.0.0.1:4001/api/convert/jobs/${jobId}`, {
        method: 'DELETE',
      });
      fetchJobs();
    } catch (error) {
      alert('Failed to delete job');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const calculateReduction = (original: number, compressed: number | null) => {
    if (!compressed) return null;
    const reduction = ((original - compressed) / original) * 100;
    return reduction.toFixed(1);
  };

  if (loading) {
    return <div className="text-center py-8">Loading conversion history...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="feature-title text-2xl font-bold">Conversion History</h2>

        {/* Filter */}
        <div className="flex space-x-2">
          {['all', 'completed', 'processing', 'failed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({jobs.filter((j) => f === 'all' || j.status === f).length})
            </button>
          ))}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No conversion jobs found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Thumbnail */}
                {job.thumbnailPath && (
                  <div className="flex-shrink-0">
                    <img
                      src={`http://127.0.0.1:4001/api/convert/jobs/${job.id}/thumbnail`}
                      alt={`${job.fileName} thumbnail`}
                      className="w-32 h-20 object-cover rounded border border-gray-200"
                      onError={(e) => {
                        // Hide thumbnail if it fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="font-semibold text-lg">{job.fileName}</h3>
                    {getStatusBadge(job.status)}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                    <div>
                      <span className="font-medium">Conversion:</span>{' '}
                      {job.fromFormat.toUpperCase()} → {job.toFormat.toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium">Original:</span> {formatFileSize(job.fileSize)}
                    </div>
                    <div>
                      <span className="font-medium">Converted:</span> {formatFileSize(job.outputSize)}
                    </div>
                    {job.outputSize && (
                      <div>
                        <span className="font-medium">Reduction:</span>{' '}
                        <span
                          className={
                            Number(calculateReduction(job.fileSize, job.outputSize)) > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {calculateReduction(job.fileSize, job.outputSize)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  {job.status === 'processing' && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{job.progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    Created: {new Date(job.createdAt).toLocaleString()}
                    {job.completedAt && ` • Completed: ${new Date(job.completedAt).toLocaleString()}`}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-2 ml-4">
                  {job.status === 'completed' && (
                    <button
                      onClick={() => handleDownload(job.id)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      Download
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(job.id)}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
