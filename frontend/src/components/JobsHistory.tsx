/**
 * Jobs History Component
 * Displays all completed jobs with download and delete options
 */

import { useState, useEffect } from 'react';

interface Job {
  id: number;
  fileName: string;
  fileSize: number;
  outputSize: number | null;
  status: string;
  progress: number;
  preset: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  outputFile: string | null;
  thumbnailPath: string | null;
}

export default function JobsHistory() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed'>('all');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('http://127.0.0.1:4001/api/jobs?limit=100');
      const data = await res.json();
      setJobs(data.jobs);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (jobId: number) => {
    if (!confirm('Are you sure you want to delete this job?')) {
      return;
    }

    try {
      const res = await fetch(`http://127.0.0.1:4001/api/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setJobs(jobs.filter(job => job.id !== jobId));
      } else {
        alert('Failed to delete job');
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('Failed to delete job');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getCompressionRatio = (original: number, compressed: number | null): string => {
    if (!compressed) return 'N/A';
    const ratio = ((original - compressed) / original * 100);
    return `${ratio.toFixed(1)}%`;
  };

  const filteredJobs = jobs.filter(job => {
    if (filter === 'completed') return job.status === 'completed';
    if (filter === 'failed') return job.status === 'failed';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="feature-title text-2xl font-bold mb-4">Compression History</h2>

        {/* Filter Tabs */}
        <div className="flex space-x-2 border-b border-gray-200">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              filter === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            All ({jobs.length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              filter === 'completed'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Completed ({jobs.filter(j => j.status === 'completed').length})
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              filter === 'failed'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Failed ({jobs.filter(j => j.status === 'failed').length})
          </button>
        </div>
      </div>

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500">No jobs found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map(job => (
            <div key={job.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                {/* Thumbnail */}
                {job.thumbnailPath && (
                  <div className="flex-shrink-0">
                    <img
                      src={`http://127.0.0.1:4001/api/jobs/${job.id}/thumbnail`}
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
                  {/* File Name and Status */}
                  <div className="flex items-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 mr-3">{job.fileName}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      job.status === 'completed' ? 'bg-green-100 text-green-800' :
                      job.status === 'failed' ? 'bg-red-100 text-red-800' :
                      job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.status}
                    </span>
                  </div>

                  {/* Job Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-gray-500">Original Size</p>
                      <p className="font-medium text-gray-900">{formatFileSize(job.fileSize)}</p>
                    </div>
                    {job.outputSize && (
                      <div>
                        <p className="text-gray-500">Compressed Size</p>
                        <p className="font-medium text-gray-900">{formatFileSize(job.outputSize)}</p>
                      </div>
                    )}
                    {job.outputSize && (
                      <div>
                        <p className="text-gray-500">Reduction</p>
                        <p className="font-medium text-green-600">{getCompressionRatio(job.fileSize, job.outputSize)}</p>
                      </div>
                    )}
                    {job.preset && (
                      <div>
                        <p className="text-gray-500">Preset</p>
                        <p className="font-medium text-gray-900 capitalize">{job.preset}</p>
                      </div>
                    )}
                  </div>

                  {/* Timestamps */}
                  <div className="text-xs text-gray-500">
                    <span>Created: {formatDate(job.createdAt)}</span>
                    {job.completedAt && (
                      <span className="ml-4">Completed: {formatDate(job.completedAt)}</span>
                    )}
                  </div>

                  {/* Error Message */}
                  {job.error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{job.error}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col space-y-2 ml-4">
                  {job.status === 'completed' && job.outputFile && (
                    <a
                      href={`http://127.0.0.1:4001/api/jobs/${job.id}/download`}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(job.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
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
