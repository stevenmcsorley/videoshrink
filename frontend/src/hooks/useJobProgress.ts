/**
 * Custom hook for real-time job progress via Server-Sent Events (SSE)
 */

import { useEffect, useRef, useState } from 'react';

export interface JobProgress {
  jobId: number;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  phase?: string;
  error?: string;
  outputFile?: string;
  outputSize?: number;
  timestamp: string;
}

interface UseJobProgressOptions {
  jobId: number | null;
  apiUrl?: string;
  onComplete?: (data: JobProgress) => void;
  onError?: (error: string) => void;
}

export function useJobProgress({
  jobId,
  apiUrl = 'http://127.0.0.1:4001',
  onComplete,
  onError,
}: UseJobProgressOptions) {
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) {
      setProgress(null);
      setIsConnected(false);
      return;
    }

    // Create EventSource for SSE
    const url = `${apiUrl}/api/jobs/${jobId}/progress`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log(`[SSE] Connected to job ${jobId} progress stream`);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: JobProgress = JSON.parse(event.data);
        setProgress(data);

        // Handle completion
        if (data.status === 'completed') {
          console.log(`[SSE] Job ${jobId} completed`);
          onComplete?.(data);
          // Delay closing to ensure message is processed
          setTimeout(() => {
            eventSource.close();
            eventSourceRef.current = null;
            setIsConnected(false);
          }, 100);
        }

        // Handle failure
        if (data.status === 'failed') {
          console.error(`[SSE] Job ${jobId} failed:`, data.error);
          onError?.(data.error || 'Job failed');
          setError(data.error || 'Job failed');
          setTimeout(() => {
            eventSource.close();
            eventSourceRef.current = null;
            setIsConnected(false);
          }, 100);
        }
      } catch (err) {
        console.error('[SSE] Error parsing progress data:', err);
      }
    };

    eventSource.onerror = (err) => {
      // Only log error if we haven't already closed the connection
      if (eventSourceRef.current && eventSource.readyState !== EventSource.CLOSED) {
        console.error('[SSE] EventSource error:', err);
        setError('Connection to progress stream failed');
        setIsConnected(false);
        eventSource.close();
        eventSourceRef.current = null;
      }
    };

    // Cleanup on unmount or jobId change
    return () => {
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
        setIsConnected(false);
      }
    };
  }, [jobId, apiUrl, onComplete, onError]);

  // Method to manually close connection
  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsConnected(false);
    }
  };

  return {
    progress,
    isConnected,
    error,
    disconnect,
  };
}
