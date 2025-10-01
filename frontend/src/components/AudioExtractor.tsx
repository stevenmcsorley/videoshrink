import React, { useState, useEffect } from 'react';

interface AudioFormat {
  extension: string;
  name: string;
  codec: string;
  bitrates: string[];
  description: string;
}

interface AudioExtractionJob {
  id: number;
  fileName: string;
  outputFormat: string;
  status: string;
  progress: number;
  outputFile?: string;
  outputSize?: number;
  fileSize: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export const AudioExtractor: React.FC = () => {
  const [formats, setFormats] = useState<AudioFormat[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<AudioFormat | null>(null);
  const [selectedBitrate, setSelectedBitrate] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [currentJob, setCurrentJob] = useState<AudioExtractionJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch available audio formats
  useEffect(() => {
    fetch('http://0.0.0.0:4001/api/audio/formats')
      .then((res) => res.json())
      .then((data) => {
        setFormats(data.formats);
        if (data.formats.length > 0) {
          setSelectedFormat(data.formats[0]);
          setSelectedBitrate(data.formats[0].bitrates[0]);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch audio formats:', err);
        setError('Failed to load audio formats');
      });
  }, []);

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
      const response = await fetch('http://0.0.0.0:4001/api/upload', {
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

  const handleExtractAudio = async () => {
    if (!fileId || !selectedFormat) return;

    setExtracting(true);
    setError(null);

    try {
      const response = await fetch('http://0.0.0.0:4001/api/audio/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          format: selectedFormat.extension,
          bitrate: selectedBitrate !== 'lossless' ? selectedBitrate : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Extraction failed');
      }

      const data = await response.json();

      // Poll for job status
      pollJobStatus(data.jobId);
    } catch (err: any) {
      console.error('Extraction error:', err);
      setError(err.message || 'Failed to start audio extraction');
      setExtracting(false);
    }
  };

  const pollJobStatus = async (jobId: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://0.0.0.0:4001/api/audio/jobs/${jobId}`);
        const data = await response.json();

        setCurrentJob(data.job);

        if (data.job.status === 'completed') {
          clearInterval(interval);
          setExtracting(false);
        } else if (data.job.status === 'failed') {
          clearInterval(interval);
          setExtracting(false);
          setError(data.job.error || 'Extraction failed');
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
        `http://0.0.0.0:4001/api/audio/jobs/${currentJob.id}/download`
      );

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentJob.fileName.replace(/\.[^.]+$/, `.${currentJob.outputFormat}`);
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
        <h2 className="text-2xl font-bold mb-6 text-gray-800">🎵 Audio Extraction</h2>
        <p className="text-gray-600 mb-6">
          Extract audio from video files and convert to your preferred format
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
          {uploading && (
            <p className="mt-2 text-sm text-blue-600">Uploading file...</p>
          )}
          {selectedFile && !uploading && (
            <p className="mt-2 text-sm text-green-600">
              ✓ {selectedFile.name} uploaded
            </p>
          )}
        </div>

        {/* Format Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Output Format
          </label>
          <select
            value={selectedFormat?.extension || ''}
            onChange={(e) => {
              const format = formats.find((f) => f.extension === e.target.value);
              setSelectedFormat(format || null);
              if (format) {
                setSelectedBitrate(format.bitrates[0]);
              }
            }}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {formats.map((format) => (
              <option key={format.extension} value={format.extension}>
                {format.name} - {format.description}
              </option>
            ))}
          </select>
        </div>

        {/* Bitrate Selection */}
        {selectedFormat && selectedFormat.bitrates.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio Quality
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {selectedFormat.bitrates.map((bitrate) => (
                <button
                  key={bitrate}
                  onClick={() => setSelectedBitrate(bitrate)}
                  className={`px-4 py-2 rounded border ${
                    selectedBitrate === bitrate
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {bitrate}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Extract Button */}
        <div className="mb-6">
          <button
            onClick={handleExtractAudio}
            disabled={!fileId || uploading || extracting}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {extracting ? 'Extracting Audio...' : 'Extract Audio'}
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
                {currentJob.status === 'completed' ? 'Completed' : 'Extracting...'}
              </span>
              <span className="text-sm text-gray-600">
                {currentJob.progress.toFixed(0)}%
              </span>
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
                <p className="text-sm text-gray-600">
                  Audio extracted successfully!
                </p>
                <p className="text-sm text-gray-600">
                  Size: {formatFileSize(currentJob.outputSize)}
                </p>
                <button
                  onClick={handleDownload}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded font-semibold hover:bg-green-700 transition-colors"
                >
                  Download Audio File
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
