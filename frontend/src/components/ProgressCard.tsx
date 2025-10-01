/**
 * ProgressCard Component
 * Displays real-time job progress with SSE updates
 */

import { useJobProgress } from '../hooks/useJobProgress';

interface ProgressCardProps {
  jobId: number;
  fileName: string;
  originalSize?: number;
  onComplete?: (outputFile: string) => void;
}

export default function ProgressCard({ jobId, fileName, originalSize, onComplete }: ProgressCardProps) {
  const { progress, isConnected, error } = useJobProgress({
    jobId,
    onComplete: (data) => {
      if (data.outputFile) {
        onComplete?.(data.outputFile);
      }
    },
  });

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const calculateSavings = () => {
    if (!originalSize || !progress?.outputSize) return null;
    const saved = originalSize - progress.outputSize;
    const percent = ((saved / originalSize) * 100).toFixed(1);
    return {
      bytes: saved,
      percent,
      formatted: formatFileSize(saved),
    };
  };

  const savings = calculateSavings();

  const getStatusColor = () => {
    if (error || progress?.status === 'failed') return 'text-red-600';
    if (progress?.status === 'completed') return 'text-green-600';
    if (progress?.status === 'processing') return 'text-blue-600';
    return 'text-gray-600';
  };

  const getStatusText = () => {
    if (error) return 'Failed';
    if (!progress) return 'Initializing...';
    if (progress.status === 'pending') return 'Pending';
    if (progress.status === 'processing') return 'Processing';
    if (progress.status === 'completed') return 'Completed';
    if (progress.status === 'failed') return 'Failed';
    return 'Unknown';
  };

  const getPhaseText = () => {
    if (!progress?.phase) return '';
    if (progress.phase === 'encoding') return 'Encoding video';
    if (progress.phase === 'pass_1') return 'Pass 1 of 2';
    if (progress.phase === 'pass_2') return 'Pass 2 of 2';
    return progress.phase;
  };

  const progressPercent = progress?.progress || 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center flex-1 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
            <p className="text-xs text-gray-500">Job #{jobId}</p>
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center ml-4">
          {isConnected && (
            <span className="flex items-center text-xs text-green-600">
              <span className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse"></span>
              Live
            </span>
          )}
        </div>
      </div>

      {/* Status and Phase */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className={`font-medium ${getStatusColor()}`}>{getStatusText()}</span>
          <span className="text-gray-500">{progressPercent.toFixed(1)}%</span>
        </div>
        {progress?.phase && (
          <p className="text-xs text-gray-500 mb-2">{getPhaseText()}</p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${
            error || progress?.status === 'failed'
              ? 'bg-red-600'
              : progress?.status === 'completed'
              ? 'bg-green-600'
              : 'bg-blue-600'
          }`}
          style={{ width: `${progressPercent}%` }}
        >
          {progress?.status === 'processing' && (
            <div className="w-full h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {(error || progress?.error) && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error || progress?.error}</p>
        </div>
      )}

      {/* File Size Savings */}
      {progress?.status === 'completed' && savings && savings.bytes > 0 && (
        <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">File Size Reduced</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {formatFileSize(originalSize!)} → {formatFileSize(progress.outputSize!)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">{savings.percent}%</p>
              <p className="text-xs text-gray-600">Saved {savings.formatted}</p>
            </div>
          </div>
        </div>
      )}

      {/* Download Button */}
      {progress?.status === 'completed' && progress?.outputFile && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              window.location.href = `http://127.0.0.1:4001/api/jobs/${jobId}/download`;
            }}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download
          </button>
        </div>
      )}
    </div>
  );
}
