import { useState } from 'react';
import UploadZone from './components/UploadZone';
import JobsHistory from './components/JobsHistory';
import Converter from './pages/Converter';
import ConversionHistory from './pages/ConversionHistory';

type Page = 'upload' | 'history' | 'converter' | 'conversion-history';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('upload');

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                VideoShrink
              </h1>
              <p className="text-gray-600">
                Compress your videos with ease using FFmpeg
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-4 border-b border-gray-200">
            <button
              onClick={() => setCurrentPage('upload')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                currentPage === 'upload'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload
              </div>
            </button>
            <button
              onClick={() => setCurrentPage('converter')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                currentPage === 'converter'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Converter
              </div>
            </button>
            <button
              onClick={() => setCurrentPage('history')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                currentPage === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Compress History
              </div>
            </button>
            <button
              onClick={() => setCurrentPage('conversion-history')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                currentPage === 'conversion-history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Convert History
              </div>
            </button>
          </div>
        </header>

        <main className="bg-white rounded-lg shadow-lg p-8">
          {currentPage === 'upload' && <UploadZone />}
          {currentPage === 'converter' && <Converter />}
          {currentPage === 'history' && <JobsHistory />}
          {currentPage === 'conversion-history' && <ConversionHistory />}
        </main>

        <footer className="mt-6 text-center text-sm text-gray-500">
          <p>Powered by FFmpeg • Self-Hostable • Open Source</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
