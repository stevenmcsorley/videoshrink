import { useState } from 'react';
import './App.css';
import UploadZone from './components/UploadZone';
import JobsHistory from './components/JobsHistory';
import Converter from './pages/Converter';
import ConversionHistory from './pages/ConversionHistory';
import { AudioExtractor } from './components/AudioExtractor';
import { VideoTrimmer } from './components/VideoTrimmer';
import { GifCreator } from './components/GifCreator';
import ThumbnailGenerator from './components/ThumbnailGenerator';
import FrameExtractor from './components/FrameExtractor';

type Page = 'upload' | 'history' | 'converter' | 'conversion-history' | 'audio-extractor' | 'trimmer' | 'gif-creator' | 'thumbnail-generator' | 'frame-extractor';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('upload');

  return (
    <div className="app-shell">
      <div className="app-viewport">
        <header className="app-header">
          <div className="app-brand">
            <div>
              <h1 className="app-title">VideoShrink</h1>
              <p className="app-subtitle">Precision video workflows powered by FFmpeg</p>
            </div>
            <div className="app-meta">
              <span className="app-chip">Local Processing</span>
              <span className="app-chip app-chip--accent">FFmpeg Ready</span>
            </div>
          </div>

          <nav className="app-nav">
            <button
              onClick={() => setCurrentPage('upload')}
              className={`nav-button ${
                currentPage === 'upload' ? 'nav-button--active' : ''
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
              className={`nav-button ${
                currentPage === 'converter' ? 'nav-button--active' : ''
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
              onClick={() => setCurrentPage('audio-extractor')}
              className={`nav-button ${
                currentPage === 'audio-extractor' ? 'nav-button--active' : ''
              }`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                Audio Extractor
              </div>
            </button>
            <button
              onClick={() => setCurrentPage('trimmer')}
              className={`nav-button ${
                currentPage === 'trimmer' ? 'nav-button--active' : ''
              }`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                </svg>
                Video Trimmer
              </div>
            </button>
            <button
              onClick={() => setCurrentPage('gif-creator')}
              className={`nav-button ${
                currentPage === 'gif-creator' ? 'nav-button--active' : ''
              }`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                GIF Creator
              </div>
            </button>
            <button
              onClick={() => setCurrentPage('thumbnail-generator')}
              className={`nav-button ${
                currentPage === 'thumbnail-generator' ? 'nav-button--active' : ''
              }`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Thumbnails
              </div>
            </button>
            <button
              onClick={() => setCurrentPage('frame-extractor')}
              className={`nav-button ${
                currentPage === 'frame-extractor' ? 'nav-button--active' : ''
              }`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Frame Extractor
              </div>
            </button>
            <button
              onClick={() => setCurrentPage('history')}
              className={`nav-button ${
                currentPage === 'history' ? 'nav-button--active' : ''
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
              className={`nav-button ${
                currentPage === 'conversion-history' ? 'nav-button--active' : ''
              }`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Convert History
              </div>
            </button>
          </nav>
        </header>

        <main className="app-panel">
          {currentPage === 'upload' && <UploadZone />}
          {currentPage === 'converter' && <Converter />}
          {currentPage === 'audio-extractor' && <AudioExtractor />}
          {currentPage === 'trimmer' && <VideoTrimmer />}
          {currentPage === 'gif-creator' && <GifCreator />}
          {currentPage === 'thumbnail-generator' && <ThumbnailGenerator />}
          {currentPage === 'frame-extractor' && <FrameExtractor />}
          {currentPage === 'history' && <JobsHistory />}
          {currentPage === 'conversion-history' && <ConversionHistory />}
        </main>

        <footer className="app-footer">
          <p>Powered by FFmpeg • Self-Hostable • Open Source</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
