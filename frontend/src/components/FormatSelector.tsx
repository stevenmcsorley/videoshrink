import { useState, useEffect } from 'react';

interface Format {
  name: string;
  extension: string;
  mimeType: string;
  category: 'video' | 'audio';
  description: string;
}

interface FormatSelectorProps {
  value: string;
  onChange: (format: string) => void;
  category?: 'video' | 'audio';
  label: string;
  disabled?: boolean;
  placeholder?: string;
}

export default function FormatSelector({
  value,
  onChange,
  category,
  label,
  disabled = false,
  placeholder = 'Select format...',
}: FormatSelectorProps) {
  const [formats, setFormats] = useState<Format[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFormats();
  }, [category]);

  const fetchFormats = async () => {
    try {
      setLoading(true);
      const url = category
        ? `http://192.168.1.198:4001/api/convert/formats?category=${category}`
        : 'http://192.168.1.198:4001/api/convert/formats';

      const response = await fetch(url);
      const data = await response.json();

      setFormats(data.formats || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to fetch formats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get icon for format category
  const getFormatIcon = (format: Format) => {
    if (format.category === 'video') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      );
    } else {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
      );
    }
  };

  // Group formats by category
  const videoFormats = formats.filter((f) => f.category === 'video');
  const audioFormats = formats.filter((f) => f.category === 'audio');

  if (loading) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
        <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
          Loading formats...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
        <div className="w-full px-4 py-2 border border-red-300 rounded-lg bg-red-50 text-red-600 text-sm">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none"
        >
          <option value="">{placeholder}</option>

          {!category && videoFormats.length > 0 && (
            <optgroup label="Video Formats">
              {videoFormats.map((format) => (
                <option key={format.extension} value={format.extension}>
                  {format.name} (.{format.extension}) - {format.description}
                </option>
              ))}
            </optgroup>
          )}

          {!category && audioFormats.length > 0 && (
            <optgroup label="Audio Formats">
              {audioFormats.map((format) => (
                <option key={format.extension} value={format.extension}>
                  {format.name} (.{format.extension}) - {format.description}
                </option>
              ))}
            </optgroup>
          )}

          {category && formats.map((format) => (
            <option key={format.extension} value={format.extension}>
              {format.name} (.{format.extension}) - {format.description}
            </option>
          ))}
        </select>

        {/* Dropdown icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Format info display */}
      {value && (
        <div className="mt-2 flex items-center text-sm text-gray-600">
          {(() => {
            const selectedFormat = formats.find((f) => f.extension === value);
            if (!selectedFormat) return null;

            return (
              <>
                <span className="mr-2">{getFormatIcon(selectedFormat)}</span>
                <span className="font-medium">{selectedFormat.name}</span>
                <span className="mx-2">•</span>
                <span className="text-gray-500">{selectedFormat.description}</span>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
