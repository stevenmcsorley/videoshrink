import { useState, useCallback, useEffect } from 'react';
import ProgressCard from './ProgressCard';

interface UploadFile {
  file: File;
  id: string;
  progress: number;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  estimatedCompression: string;
}

interface Job {
  id: number;
  fileName: string;
  fileSize: number;
  status: string;
}

export default function UploadZone() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('medium');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch presets on mount
  useEffect(() => {
    fetch('http://0.0.0.0:4001/api/presets')
      .then(res => res.json())
      .then(data => {
        if (data.presets) {
          setPresets(data.presets);
        }
      })
      .catch(err => console.error('Failed to fetch presets:', err));
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const videoFiles = droppedFiles.filter(file => file.type.startsWith('video/'));

    const newFiles: UploadFile[] = videoFiles.map(file => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      progress: 0,
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const videoFiles = selectedFiles.filter(file => file.type.startsWith('video/'));

    const newFiles: UploadFile[] = videoFiles.map(file => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      progress: 0,
    }));

    setFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileType = (file: File): string => {
    const ext = file.name.split('.').pop()?.toUpperCase() || 'VIDEO';
    return ext;
  };

  const handleStartCompression = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    try {
      for (const uploadFile of files) {
        // Upload file
        const formData = new FormData();
        formData.append('file', uploadFile.file);

        const uploadRes = await fetch('http://0.0.0.0:4001/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Upload failed');
        }

        const uploadData = await uploadRes.json();
        const fileId = uploadData.fileId;

        // Create compression job
        const jobRes = await fetch('http://0.0.0.0:4001/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId,
            preset: selectedPreset,
          }),
        });

        if (!jobRes.ok) {
          throw new Error('Job creation failed');
        }

        const jobData = await jobRes.json();

        // Add job to list
        setJobs(prev => [...prev, {
          id: jobData.jobId,
          fileName: uploadFile.file.name,
          fileSize: uploadFile.file.size,
          status: 'pending',
        }]);
      }

      // Clear uploaded files
      setFiles([]);
    } catch (error) {
      console.error('Compression failed:', error);
      alert('Failed to start compression. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center transition-colors
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
          }
        `}
      >
        <div className="flex flex-col items-center justify-center">
          <svg
            className={`w-16 h-16 mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Drop video files here
          </h3>
          <p className="text-gray-500 mb-4">
            or click to browse
          </p>

          <label className="cursor-pointer">
            <span className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Select Files
            </span>
            <input
              type="file"
              multiple
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          <p className="text-xs text-gray-400 mt-4">
            Supported formats: MP4, AVI, MOV, MKV, WebM
          </p>
        </div>
      </div>

      {/* Preset Selector */}
      {files.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-3">
            Compression Settings
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {presets.map(preset => (
              <button
                key={preset.id}
                onClick={() => setSelectedPreset(preset.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedPreset === preset.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-gray-900">{preset.name}</h5>
                  {selectedPreset === preset.id && (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-gray-600 mb-2">{preset.description}</p>
                <p className="text-xs font-medium text-blue-600">{preset.estimatedCompression}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-gray-800 mb-3">
            Selected Files ({files.length})
          </h4>

          {files.map(uploadFile => (
            <div
              key={uploadFile.id}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-center flex-1 min-w-0">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                  <svg
                    className="w-6 h-6 text-blue-600"
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
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {uploadFile.file.name}
                  </p>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatFileSize(uploadFile.file.size)}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {getFileType(uploadFile.file)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => removeFile(uploadFile.id)}
                className="ml-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                aria-label="Remove file"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setFiles([])}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 mr-3"
              disabled={isUploading}
            >
              Clear All
            </button>
            <button
              onClick={handleStartCompression}
              disabled={isUploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                'Start Compression'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Active Jobs */}
      {jobs.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Compression Jobs
          </h3>
          <div className="space-y-4">
            {jobs.map(job => (
              <ProgressCard
                key={job.id}
                jobId={job.id}
                fileName={job.fileName}
                originalSize={job.fileSize}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
