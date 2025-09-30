/**
 * JobsList Component
 * Displays a list of compression jobs with real-time progress
 */

import { useState } from 'react';
import ProgressCard from './ProgressCard';

interface Job {
  id: number;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface JobsListProps {
  jobs: Job[];
  onJobComplete?: (jobId: number, outputFile: string) => void;
}

export default function JobsList({ jobs, onJobComplete }: JobsListProps) {
  const [completedJobs, setCompletedJobs] = useState<Set<number>>(new Set());

  const handleJobComplete = (jobId: number, outputFile: string) => {
    setCompletedJobs(prev => new Set(prev).add(jobId));
    onJobComplete?.(jobId, outputFile);
  };

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 mx-auto text-gray-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-gray-500">No compression jobs yet</p>
        <p className="text-sm text-gray-400 mt-1">Upload videos to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Compression Jobs ({jobs.length})
        </h3>
        <div className="flex items-center text-sm text-gray-500">
          <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
          Processing: {jobs.filter(j => j.status === 'processing').length}
          <span className="mx-3">•</span>
          <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
          Completed: {completedJobs.size}
        </div>
      </div>

      {jobs.map(job => (
        <ProgressCard
          key={job.id}
          jobId={job.id}
          fileName={job.fileName}
          onComplete={(outputFile) => handleJobComplete(job.id, outputFile)}
        />
      ))}
    </div>
  );
}
