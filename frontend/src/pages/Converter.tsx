import { useState, useEffect } from 'react';
import FormatSelector from '../components/FormatSelector';

interface Preset {
  id: string;
  name: string;
  description: string;
}

export default function Converter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fromFormat, setFromFormat] = useState<string>('');
  const [toFormat, setToFormat] = useState<string>('');
  const [preset, setPreset] = useState<string>('balanced');
  const [isDragging, setIsDragging] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const response = await fetch('http://192.168.1.198:4001/api/convert/presets');
      const data = await response.json();
      setPresets(data.presets || []);
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    // Auto-detect format from file extension
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    setFromFormat(ext);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleConvert = async () => {
    if (!selectedFile || !fromFormat || !toFormat) {
      alert('Please select a file and target format');
      return;
    }

    try {
      setUploading(true);

      // Step 1: Upload the file
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadResponse = await fetch('http://192.168.1.198:4001/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('File upload failed');
      }

      const uploadData = await uploadResponse.json();
      const fileId = uploadData.fileId;

      setUploading(false);
      setConverting(true);

      // Step 2: Create conversion job
      const jobResponse = await fetch('http://192.168.1.198:4001/api/convert/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          fromFormat,
          toFormat,
          preset,
        }),
      });

      if (!jobResponse.ok) {
        throw new Error('Failed to create conversion job');
      }

      const jobData = await jobResponse.json();
      setJobId(jobData.jobId);

      alert(`Conversion started! Job ID: ${jobData.jobId}`);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      setUploading(false);
      setConverting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">File Format Converter</h1>

      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {selectedFile ? (
          <div className="space-y-2">
            <p className="text-lg font-semibold">{selectedFile.name}</p>
            <p className="text-sm text-gray-600">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </p>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-sm text-blue-600 hover:underline"
            >
              Remove file
            </button>
          </div>
        ) : (
          <div>
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              Drag and drop a file here, or{' '}
              <label className="text-blue-600 hover:underline cursor-pointer">
                browse
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  accept="video/*,audio/*"
                />
              </label>
            </p>
          </div>
        )}
      </div>

      {/* Format Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From Format
          </label>
          <input
            type="text"
            value={fromFormat.toUpperCase()}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
            placeholder="Auto-detected from file"
          />
        </div>

        <FormatSelector
          value={toFormat}
          onChange={setToFormat}
          label="To Format"
          placeholder="Select target format..."
        />
      </div>

      {/* Preset Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Conversion Preset
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`p-3 rounded-lg border-2 transition-colors ${
                preset === p.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-sm">{p.name}</div>
              <div className="text-xs text-gray-600 mt-1">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Convert Button */}
      <button
        onClick={handleConvert}
        disabled={!selectedFile || !toFormat || uploading || converting}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? 'Uploading...' : converting ? 'Converting...' : 'Convert File'}
      </button>

      {/* Job Status */}
      {jobId && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Conversion Job #{jobId}</span> has been created and is processing...
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Check the History tab to view progress and download the converted file.
          </p>
        </div>
      )}
    </div>
  );
}
