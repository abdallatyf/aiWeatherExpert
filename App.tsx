


import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ImageFile } from './types';
import { explainWeatherFromImage, WeatherAnalysis, StormTrackPoint, AnomalyStreak, generateVisualSummaryImage, StormSurgeForecast, fetchLiveWeatherData, LiveWeatherData, Isobar, WindFieldPoint } from './services/geminiService';
import { HISTORICAL_IMAGE_URL } from './historicalImage';

const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
};

// Helper to get a color based on wind speed (km/h)
const getWindColor = (speed: number): string => {
    if (speed < 10) return '#60a5fa'; // blue-400
    if (speed < 30) return '#22d3ee'; // cyan-400
    if (speed < 50) return '#34d399'; // emerald-400
    if (speed < 70) return '#facc15'; // yellow-400
    if (speed < 90) return '#f97316'; // orange-500
    return '#ef4444'; // red-500
};

// Helper to draw a single wind arrow on a canvas context
const drawWindArrowOnCanvas = (ctx: CanvasRenderingContext2D, x: number, y: number, speed: number, direction: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(direction * Math.PI / 180); // Convert degrees to radians
    ctx.fillStyle = getWindColor(speed);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;

    // Simple arrow path
    const arrowLength = 12;
    const arrowWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, -arrowLength / 2);
    ctx.lineTo(arrowWidth / 2, arrowLength / 2);
    ctx.lineTo(-arrowWidth / 2, arrowLength / 2);
    ctx.closePath();
    
    ctx.fill();
    ctx.stroke();

    ctx.restore();
};


const ThemeToggle = ({ theme, toggleTheme }: { theme: 'light' | 'dark', toggleTheme: () => void }) => (
  <button
    onClick={toggleTheme}
    className="p-2 rounded-full text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 focus:ring-cyan-500 transition-colors"
    aria-label="Toggle theme"
  >
    {theme === 'dark' ? (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    )}
  </button>
);

const MapModal = ({ 
  isOpen, 
  onClose, 
  analysis 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  analysis: WeatherAnalysis | null
}) => {
  if (!isOpen || !analysis?.centerCoordinates) return null;

  const { lat, lon } = analysis.centerCoordinates;
  const zoom = analysis.zoomLevel || 5;
  // Use 'k' for satellite map type
  const mapSrc = `https://maps.google.com/maps?q=${lat},${lon}&z=${zoom}&output=embed&t=k`;
  const earthLink = `https://earth.google.com/web/@${lat},${lon},635a,22248d,35y,0h,0t,0r`;

  return (
    <div 
      className="fixed inset-0 bg-gray-800 bg-opacity-50 dark:bg-black dark:bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-modal-title"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl relative transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
          aria-label="Close map dialog"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h3 id="map-modal-title" className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mb-4">
          Map View: {analysis.location}
        </h3>
        <div className="aspect-video w-full bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
          <iframe
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={mapSrc}
            title={`Interactive map of ${analysis.location}`}
          ></iframe>
        </div>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
          Note: Analysis overlays (storm tracks, etc.) are only visible on the main satellite view.
        </p>
         <div className="mt-4 flex justify-end items-center gap-4">
          <a 
            href={earthLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-gray-600 hover:bg-gray-700 text-white"
          >
            View in Google Earth (3D)
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const LookerStepsModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-gray-800 bg-opacity-50 dark:bg-black dark:bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="looker-modal-title"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg relative transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
          aria-label="Close dialog"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h3 id="looker-modal-title" className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mb-4">
          Connect to Looker Studio
        </h3>
        <p className="mb-4 text-gray-600 dark:text-gray-300">
          Your weather analysis data has been downloaded as a CSV file. Follow these steps to visualize it in Google Looker Studio:
        </p>
        <ol className="list-decimal list-inside space-y-3 text-gray-700 dark:text-gray-200">
          <li>
            Go to <a href="https://lookerstudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline font-semibold">Looker Studio</a> and sign in.
          </li>
          <li>
            Click on <strong>+ Create</strong> in the top left and select <strong>Data Source</strong>.
          </li>
          <li>
            In the connectors list, find and select the <strong>File Upload</strong> connector.
          </li>
          <li>
            Click the upload button and select the <code>weather_analysis_... .csv</code> file that was just downloaded to your computer.
          </li>
          <li>
            Once the file is processed and you see your data fields, click the blue <strong>Connect</strong> button in the top right corner.
          </li>
          <li>
            You're all set! Click <strong>Create Report</strong> or <strong>Explore</strong> to start building charts and graphs with your weather data.
          </li>
        </ol>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};


const ShareModal = ({ 
  isOpen, 
  onClose, 
  analysisData, 
  visualSummaryImage, 
  composedOverlayImage,
  unifiedAnalysisImage,
  selectedImage,
  theme,
  genericDownloadHandler,
  genericShareHandler
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  analysisData: WeatherAnalysis | null, 
  visualSummaryImage: { base64: string, mimeType: string } | null,
  composedOverlayImage: { base64: string, mimeType: string } | null,
  unifiedAnalysisImage: { base64: string, mimeType: string } | null,
  selectedImage: ImageFile | null,
  theme: 'light' | 'dark',
  genericDownloadHandler: (image: { base64: string; mimeType: string; } | null, prefix: string) => void,
  genericShareHandler: (image: { base64: string; mimeType: string; } | null, prefix: string, titleText: string, bodyText: string) => Promise<void>
}) => {
  const [copyButtonText, setCopyButtonText] = useState('Copy');
  const [shareMode, setShareMode] = useState<'analysis' | 'original' | 'overlay' | 'visual' | 'unified'>('analysis');
  
  useEffect(() => {
    if (isOpen) {
      setCopyButtonText('Copy');
      // Set a smart default share mode
      if (unifiedAnalysisImage) {
        setShareMode('unified');
      } else if (visualSummaryImage) {
        setShareMode('visual');
      } else if (composedOverlayImage) {
        setShareMode('overlay');
      } else {
        setShareMode('analysis');
      }
    }
  }, [isOpen, visualSummaryImage, composedOverlayImage, unifiedAnalysisImage]);

  if (!isOpen || !analysisData) return null;

  const { location, temperature, windDirection, windSpeed, explanation, chanceOfPrecipitation, humidity, uvIndex } = analysisData;

  const summaryText = `Weather for ${location}: Temp: ${Math.round(temperature)}°C, Wind: ${Math.round(windSpeed)} km/h ${windDirection}, Precip: ${chanceOfPrecipitation}%, Humidity: ${humidity}%, UV: ${uvIndex}. Analysis: ${explanation.substring(0, 100)}...`;
  const encodedSummary = encodeURIComponent(summaryText);
  const shareLink = `https://www.google.com/search?q=${encodedSummary}`;
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopyButtonText('Copied!');
      setTimeout(() => setCopyButtonText('Copy'), 2000);
    }).catch(err => {
      console.error('Failed to copy link: ', err);
    });
  };

  const getTabClass = (mode: typeof shareMode) => {
    return shareMode === mode
      ? 'border-cyan-500 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400'
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-400 dark:text-gray-400 dark:hover:text-white dark:hover:border-gray-500';
  };
  
  const qrBgColor = theme === 'dark' ? '374151' : 'f3f4f6';
  const qrColor = theme === 'dark' ? 'e5e7eb' : '111827';
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodedSummary}&bgcolor=${qrBgColor}&color=${qrColor}&qzone=1`;

  return (
    <div 
      className="fixed inset-0 bg-gray-800 bg-opacity-50 dark:bg-black dark:bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm relative transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
          aria-label="Close share dialog"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h3 id="share-modal-title" className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mb-4 text-center">
          Share
        </h3>
        
        <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
            <nav className="-mb-px flex justify-center space-x-2 sm:space-x-4 text-xs sm:text-sm" aria-label="Tabs">
                 <button
                    onClick={() => setShareMode('unified')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium transition-colors ${getTabClass('unified')} disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-transparent`}
                    disabled={!unifiedAnalysisImage}
                >
                    Summary Card
                </button>
                <button
                    onClick={() => setShareMode('analysis')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium transition-colors ${getTabClass('analysis')}`}
                >
                    Analysis
                </button>
                 <button
                    onClick={() => setShareMode('overlay')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium transition-colors ${getTabClass('overlay')} disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-transparent`}
                    disabled={!composedOverlayImage}
                >
                    Overlay
                </button>
                <button
                    onClick={() => setShareMode('visual')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium transition-colors ${getTabClass('visual')} disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-transparent`}
                    disabled={!visualSummaryImage}
                >
                    AI Image
                </button>
                 <button
                    onClick={() => setShareMode('original')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium transition-colors ${getTabClass('original')}`}
                    disabled={!selectedImage}
                >
                    Original
                </button>
            </nav>
        </div>
        
        {shareMode === 'unified' && unifiedAnalysisImage && (
          <div className="space-y-4 text-center animate-fade-in">
            <img 
              src={`data:${unifiedAnalysisImage.mimeType};base64,${unifiedAnalysisImage.base64}`} 
              alt="Unified analysis summary card" 
              className="rounded-lg border-2 border-gray-200 dark:border-gray-600 max-h-64 w-auto mx-auto"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400">Share this comprehensive summary card.</p>
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => genericShareHandler(unifiedAnalysisImage, 'summary_card', `Weather Summary for ${location}`, summaryText)}
                disabled={!navigator.share}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
                title={!navigator.share ? 'Web Share API not supported' : 'Share image using native dialog'}
              >
                Share Card
              </button>
              <button
                onClick={() => genericDownloadHandler(unifiedAnalysisImage, 'summary_card')}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-gray-600 hover:bg-gray-700 text-white"
              >
                Download Card
              </button>
            </div>
          </div>
        )}

        {shareMode === 'analysis' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
              <img src={qrApiUrl} alt="QR Code for weather analysis" className="rounded-md" />
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Scan QR code to share analysis</p>
            </div>
            <div>
              <label htmlFor="share-link" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">Or Copy Link</label>
              <div className="flex gap-2">
                <input
                  id="share-link"
                  type="text"
                  readOnly
                  value={shareLink}
                  className="w-full bg-gray-100 text-gray-900 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-cyan-500 focus:border-cyan-500 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-1.5 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-cyan-600 hover:bg-cyan-700 text-white w-24 text-center"
                >
                  {copyButtonText}
                </button>
              </div>
            </div>
            <hr className="border-gray-200 dark:border-gray-600" />
            <div className="flex justify-center items-center gap-6">
              <a href={`mailto:?subject=Weather Analysis for ${location}&body=${encodedSummary}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors" title="Share via Email">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
              </a>
              <a href={`https://twitter.com/intent/tweet?text=${encodedSummary}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors" title="Share on Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
            </div>
          </div>
        )}
        
        {shareMode === 'overlay' && composedOverlayImage && (
          <div className="space-y-4 text-center animate-fade-in">
            <img 
              src={`data:${composedOverlayImage.mimeType};base64,${composedOverlayImage.base64}`} 
              alt="Image with analysis overlays" 
              className="rounded-lg border-2 border-gray-200 dark:border-gray-600 max-h-64 w-auto mx-auto"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400">Share this image with analysis overlays.</p>
            <div className="flex flex-col gap-3 pt-2">
               <button
                onClick={() => genericShareHandler(composedOverlayImage, 'overlay', `Weather Overlay for ${location}`, summaryText)}
                disabled={!navigator.share}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
                title={!navigator.share ? 'Web Share API not supported' : 'Share image using native dialog'}
              >
                Share Image
              </button>
              <button
                onClick={() => genericDownloadHandler(composedOverlayImage, 'overlay')}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-gray-600 hover:bg-gray-700 text-white"
              >
                Download Image
              </button>
            </div>
          </div>
        )}

        {shareMode === 'visual' && visualSummaryImage && (
          <div className="space-y-4 text-center animate-fade-in">
            <img 
              src={`data:${visualSummaryImage.mimeType};base64,${visualSummaryImage.base64}`} 
              alt="AI-generated visual summary" 
              className="rounded-lg border-2 border-gray-200 dark:border-gray-600 max-h-64 w-auto mx-auto"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400">Share this AI-enhanced image with your analysis baked in.</p>
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => genericShareHandler(visualSummaryImage, 'visual_summary', `Weather Analysis for ${location}`, summaryText)}
                disabled={!navigator.share}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
                title={!navigator.share ? 'Web Share API not supported in your browser' : 'Share image using native dialog'}
              >
                Share Image
              </button>
              <button
                onClick={() => genericDownloadHandler(visualSummaryImage, 'visual_summary')}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-gray-600 hover:bg-gray-700 text-white"
              >
                Download Image
              </button>
            </div>
          </div>
        )}

        {shareMode === 'original' && selectedImage && (
          <div className="space-y-4 text-center animate-fade-in">
            <img 
              src={`data:${selectedImage.mimeType};base64,${selectedImage.base64}`} 
              alt="Original satellite image" 
              className="rounded-lg border-2 border-gray-200 dark:border-gray-600 max-h-64 w-auto mx-auto"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400">Share the original unprocessed satellite image.</p>
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={async () => {
                  if (!selectedImage || !navigator.share) return;
                  try {
                    await navigator.share({
                      files: [selectedImage.file],
                      title: `Weather Image: ${selectedImage.file.name}`,
                      text: `Original weather satellite image for ${location}.`,
                    });
                  } catch (error) {
                    console.error('Error sharing the original image:', error);
                  }
                }}
                disabled={!navigator.share}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
                title={!navigator.share ? 'Web Share API not supported in your browser' : 'Share image using native dialog'}
              >
                Share Image
              </button>
              <button
                onClick={() => genericDownloadHandler(selectedImage, 'original')}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-gray-600 hover:bg-gray-700 text-white"
              >
                Download Image
              </button>
            </div>
          </div>
        )}

      </div>
       <style>{`
        @keyframes fade-in-scale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in-scale { animation: fade-in-scale 0.2s ease-out forwards; }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

const LocationDisplay = ({ location, onMapClick, isMapAvailable }: { location: string, onMapClick: () => void, isMapAvailable: boolean }) => (
    <button
      onClick={onMapClick}
      disabled={!isMapAvailable}
      className="flex items-center gap-2 p-2 rounded-lg transition-colors duration-200 enabled:hover:bg-gray-200 enabled:dark:hover:bg-gray-600/50 disabled:cursor-not-allowed disabled:opacity-60 group"
      title={isMapAvailable ? `Show ${location} on an interactive map` : 'Location coordinates not available for map view'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">{location}</span>
      {isMapAvailable && (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m-6 10l6-3m0 0l6-3m-6 3V7" />
        </svg>
      )}
    </button>
  );

const TemperatureDisplay = ({ temp }: { temp: number }) => (
  <div className="flex items-center gap-2" title={`Estimated Temperature: ${temp}°C`}>
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V4a4 4 0 10-8 0v12a6 6 0 108 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-4" />
    </svg>
    <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">{Math.round(temp)}°C</span>
  </div>
);

const WindSpeedDisplay = ({ speed }: { speed: number }) => (
  <div className="flex items-center gap-2" title={`Estimated Wind Speed: ${Math.round(speed)} km/h`}>
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
    <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">{Math.round(speed)} km/h</span>
  </div>
);

const PrecipitationDisplay = ({ chance }: { chance: number }) => (
  <div className="flex items-center gap-2" title={`Chance of Precipitation: ${chance}%`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-500 dark:text-cyan-300" fill="currentColor" stroke="none" viewBox="0 0 24 24">
          <path d="M17.502 19.001H6.5c-2.208 0-4-1.792-4-4s1.792-4 4-4h.198c.414-3.402 3.286-6 6.802-6 3.805 0 6.998 2.903 6.998 6.5v.5c1.381 0 2.5 1.119 2.5 2.5s-1.119 2.5-2.5 2.5z" />
          <circle className="precip-drop1" cx="8" cy="18" r="1.5" />
          <circle className="precip-drop2" cx="12" cy="18" r="1.5" />
          <circle className="precip-drop3" cx="16" cy="18" r="1.5" />
      </svg>
      <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">{chance}%</span>
  </div>
);


const HumidityDisplay = ({ humidity }: { humidity: number }) => (
  <div className="flex items-center gap-2" title={`Humidity: ${humidity}%`}>
     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
       <path strokeLinecap="round" strokeLinejoin="round" d="M6.375 8.25a5.625 5.625 0 1111.25 0c0 3.108-2.517 5.625-5.625 5.625S6.375 11.358 6.375 8.25z" />
       <path strokeLinecap="round" strokeLinejoin="round" d="M12 13.875V19.5" />
       <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 19.5h7.5" />
     </svg>
    <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">{humidity}%</span>
  </div>
);

const UvIndexDisplay = ({ index }: { index: number }) => (
  <div className="flex items-center gap-2" title={`UV Index: ${index}`}>
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-500 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
    <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">{index}</span>
  </div>
);

const WindDirectionArrow = ({ direction }: { direction: string }) => {
  const rotationClasses: { [key: string]: string } = {
    'N': 'rotate-0', 'NE': 'rotate-45', 'E': 'rotate-90', 'SE': 'rotate-135',
    'S': 'rotate-180', 'SW': '-rotate-135', 'W': '-rotate-90', 'NW': '-rotate-45',
  };
  const normalizedDirection = direction.toUpperCase().replace(/[^A-Z]/g, '');
  let rotation = 'rotate-0';
  for (const key in rotationClasses) {
    if(normalizedDirection.startsWith(key)) {
      rotation = rotationClasses[key];
      break;
    }
  }

  return (
    <div className="flex items-center gap-2" title={`Wind Direction: ${direction}`}>
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{direction.toUpperCase()}</span>
      <div className={`w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center transform transition-transform duration-700 ease-in-out ${rotation}`}>
        <div className="animate-spin-slow w-5 h-5 flex items-center justify-center">
          <svg className="w-5 h-5 text-cyan-500 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l-7-7 7-7 7 7-7 7z" transform="rotate(-45 12 12)" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v10" />
          </svg>
        </div>
      </div>
    </div>
  );
};

const getTemperatureColor = (temp: number): string => {
  if (temp <= 0) return 'rgba(100, 100, 255, 0.4)'; // Cold Blue
  if (temp <= 10) return 'rgba(100, 200, 255, 0.4)'; // Cool Blue
  if (temp <= 18) return 'rgba(150, 255, 150, 0.4)'; // Mild Green
  if (temp <= 25) return 'rgba(255, 255, 100, 0.4)'; // Warm Yellow
  if (temp <= 32) return 'rgba(255, 180, 50, 0.4)'; // Hot Orange
  return 'rgba(255, 100, 100, 0.45)'; // Very Hot Red
};

const TemperatureHeatmapDisplay = ({ temperature }: { temperature: number }) => {
  const color = getTemperatureColor(temperature);
  return (
    <div
      className="absolute top-0 left-0 w-full h-full pointer-events-none transition-opacity duration-500"
      style={{ backgroundColor: color }}
      title={`Heatmap representing avg. temp of ${Math.round(temperature)}°C`}
    />
  );
};

const getIntensityColor = (intensity: string) => {
  const lowerIntensity = intensity.toLowerCase();
  if (lowerIntensity.includes('5')) return '#ef4444'; // red-500
  if (lowerIntensity.includes('4')) return '#f97316'; // orange-500
  if (lowerIntensity.includes('3')) return '#f59e0b'; // amber-500
  if (lowerIntensity.includes('2')) return '#eab308'; // yellow-500
  if (lowerIntensity.includes('1')) return '#fde047'; // yellow-300
  return '#a3e635'; // lime-400 for Tropical Storm/Depression
};

const StormTrackDisplay = ({ track, dimensions, forecastHour }: { track: StormTrackPoint[], dimensions: { width: number, height: number }, forecastHour: number }) => {
  if (!track || track.length === 0 || dimensions.width === 0) return null;
  
  const visibleTrack = track.filter(p => p.hours <= forecastHour);
  if (visibleTrack.length === 0) return null;

  const activePoint = visibleTrack[visibleTrack.length - 1];
  const pathPoints = visibleTrack.map(p => `${p.x / 100 * dimensions.width},${p.y / 100 * dimensions.height}`).join(' ');

  return (
    <>
      <style>{`
        @keyframes dash-flow { to { stroke-dashoffset: -20; } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.5); } }
        .storm-path { animation: dash-flow 1.5s linear infinite; }
        .storm-point {
          animation: pulse 2.5s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
      `}</style>
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
        <polyline
          className="storm-path"
          points={pathPoints}
          fill="none"
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        {visibleTrack.map((point, index) => (
          <circle
            key={index}
            className={point === activePoint ? "storm-point pointer-events-auto" : "pointer-events-auto"}
            style={{ animationDelay: `${index * 0.3}s` }}
            cx={point.x / 100 * dimensions.width}
            cy={point.y / 100 * dimensions.height}
            r={point === activePoint ? 8 : 4}
            fill={getIntensityColor(point.intensity)}
            stroke="rgba(0, 0, 0, 0.5)"
            strokeWidth="1"
          >
            <title>{`In ${point.hours} hours: ${point.intensity}`}</title>
          </circle>
        ))}
      </svg>
    </>
  );
};

const AnomalyStreaksDisplay = ({ streaks, dimensions, setTooltip }: {
  streaks: AnomalyStreak[],
  dimensions: { width: number, height: number },
  setTooltip: React.Dispatch<React.SetStateAction<{ visible: boolean; content: React.ReactNode; x: number; y: number }>>
}) => {
  if (!streaks || streaks.length === 0 || dimensions.width === 0) return null;

  return (
    <>
      <style>{`
        @keyframes subtle-glow {
          0% { filter: drop-shadow(0 0 3px #fef08a) drop-shadow(0 0 1px #fef08a); opacity: 0.7; }
          50% { filter: drop-shadow(0 0 8px #facc15) drop-shadow(0 0 2px #facc15); opacity: 1; }
          100% { filter: drop-shadow(0 0 3px #fef08a) drop-shadow(0 0 1px #fef08a); opacity: 0.7; }
        }
        .anomaly-streak {
          animation: subtle-glow 3.5s ease-in-out infinite;
          stroke-linejoin: round;
          stroke-linecap: round;
        }
      `}</style>
      <svg className="absolute top-0 left-0 w-full h-full" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
        {streaks.map((streak, index) => {
          const pointsStr = streak.points.map(p => `${p.x / 100 * dimensions.width},${p.y / 100 * dimensions.height}`).join(' ');
          return (
            <polygon
              key={index}
              points={pointsStr}
              className="anomaly-streak cursor-pointer"
              fill="rgba(250, 204, 21, 0.25)"
              stroke="#facc15"
              strokeWidth="2"
              onMouseEnter={(e) => setTooltip({
                visible: true,
                content: (
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{streak.description}</p>
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <strong className="text-yellow-600 dark:text-yellow-400">Potential Impact:</strong>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{streak.impact}</p>
                    </div>
                  </div>
                ),
                x: e.clientX,
                y: e.clientY
              })}
              onMouseMove={(e) => setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))}
              onMouseLeave={() => setTooltip({ visible: false, content: '', x: 0, y: 0 })}
            >
              <title>{streak.description}</title>
            </polygon>
          );
        })}
      </svg>
    </>
  );
};

const StormSurgeDisplay = ({ surge, dimensions }: { surge: StormSurgeForecast, dimensions: { width: number, height: number } }) => {
  if (!surge || !surge.affectedArea || surge.affectedArea.length === 0 || dimensions.width === 0) return null;

  const pointsStr = surge.affectedArea.map(p => `${p.x / 100 * dimensions.width},${p.y / 100 * dimensions.height}`).join(' ');
  
  // Calculate centroid for text label placement
  const centroid = surge.affectedArea.reduce((acc, p) => ({
    x: acc.x + p.x / 100 * dimensions.width,
    y: acc.y + p.y / 100 * dimensions.height
  }), { x: 0, y: 0 });
  centroid.x /= surge.affectedArea.length;
  centroid.y /= surge.affectedArea.length;

  return (
    <>
      <style>{`
        @keyframes surge-pulse {
          0% { opacity: 0.4; }
          50% { opacity: 0.7; }
          100% { opacity: 0.4; }
        }
        .surge-area {
          animation: surge-pulse 4s ease-in-out infinite;
        }
      `}</style>
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
        <polygon
          points={pointsStr}
          className="surge-area"
          fill="rgba(220, 38, 38, 0.5)"
          stroke="rgba(255, 100, 100, 0.8)"
          strokeWidth="1.5"
        >
          <title>Storm Surge Warning</title>
        </polygon>
        <text
          x={centroid.x}
          y={centroid.y}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-white font-bold text-lg"
          style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: '2px', strokeLinejoin: 'round' }}
        >
          {surge.surgeHeight}m Surge
        </text>
      </svg>
    </>
  );
};

const DynamicWindArrowOverlay = ({ windField, dimensions }: { windField: WindFieldPoint[]; dimensions: { width: number, height: number } }) => {
  if (!windField || windField.length === 0 || dimensions.width === 0) return null;

  return (
    <>
      <style>{`
        @keyframes wind-flow {
          0% { transform: translateX(-1.5px); opacity: 0.6; }
          50% { transform: translateX(1.5px); opacity: 1; }
          100% { transform: translateX(-1.5px); opacity: 0.6; }
        }
        .wind-arrow-group {
          animation: wind-flow 3s ease-in-out infinite;
          filter: drop-shadow(0 0 2px rgba(0,0,0,0.7));
        }
      `}</style>
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
        {windField.map((point, index) => (
          <g
            key={index}
            className="wind-arrow-group"
            style={{ animationDelay: `${(point.x + point.y) * 10}ms` }}
            transform={`translate(${point.x / 100 * dimensions.width}, ${point.y / 100 * dimensions.height}) rotate(${point.direction})`}
          >
            <path
              d="M 0 -7 L 4 3 L -4 3 Z"
              fill={getWindColor(point.speed)}
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="0.5"
            >
              <title>{`Wind: ${point.speed.toFixed(0)} km/h, ${point.direction.toFixed(0)}°`}</title>
            </path>
          </g>
        ))}
      </svg>
    </>
  );
};

const IsobarDisplay = ({ isobars, dimensions }: { isobars: Isobar[], dimensions: { width: number, height: number } }) => {
  if (!isobars || isobars.length === 0 || dimensions.width === 0) return null;

  // Convert the SVG path from a 100x100 viewbox to the actual image dimensions
  const scalePath = (path: string, width: number, height: number) => {
    return path.replace(/([0-9.]+)/g, (match, numberStr) => {
      // This is a simplification; it assumes alternating x and y coordinates in commands like M, L, C etc.
      // A more robust solution would parse the SVG path commands properly.
      // For now, we scale every number, which works for paths generated as absolute coordinates.
      // The AI is asked for percentage based coordinates, which this handles.
      // Let's assume the path is like "M x1,y1 C x2,y2 x3,y3 x4,y4"
      // A regex might be better. Let's try to parse it.
      const commands = path.split(/(?=[MmLlHhVvCcSsQqTtAaZz])/);
      return commands.map(command => {
        const op = command.charAt(0);
        const args = command.substring(1).trim().split(/[\s,]+/).map(parseFloat);
        const scaledArgs = args.map((arg, i) => {
          if (isNaN(arg)) return '';
          // Scale X coordinates (even indices) by width, Y (odd indices) by height
          return (i % 2 === 0) ? (arg / 100 * width).toFixed(2) : (arg / 100 * height).toFixed(2);
        });
        return op + scaledArgs.join(' ');
      }).join('');
    });
  };

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
      <style>{`
        .isobar-label {
            font-size: 10px;
            font-weight: bold;
            paint-order: stroke;
            stroke-width: 2px;
            stroke-linejoin: round;
        }
        .isobar-path {
          filter: drop-shadow(0 0 1px rgba(0,0,0,0.6));
        }
      `}</style>
      {isobars.map((isobar, index) => (
        <g key={index}>
          <path
            d={scalePath(isobar.path, dimensions.width, dimensions.height)}
            className="isobar-path"
            fill="none"
            stroke="rgba(230, 230, 230, 0.9)"
            strokeWidth="1.5"
          />
          <text
            x={(isobar.labelPosition.x / 100) * dimensions.width}
            y={(isobar.labelPosition.y / 100) * dimensions.height}
            className="isobar-label fill-white dark:fill-gray-100 stroke-gray-900/80 dark:stroke-black/80"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {isobar.pressure}
          </text>
        </g>
      ))}
    </svg>
  );
};


const Tooltip = ({ visible, content, x, y }: { visible: boolean; content: React.ReactNode; x: number; y: number }) => {
  if (!visible) return null;
  return (
    <div
      className="fixed z-50 p-3 text-sm text-gray-800 dark:text-white bg-white dark:bg-gray-900 dark:bg-opacity-80 rounded-md shadow-lg pointer-events-none transition-opacity max-w-xs border border-gray-200 dark:border-transparent"
      style={{ top: y + 15, left: x + 15 }}
    >
      {content}
    </div>
  );
};

const LiveWeatherDisplay = ({ 
  data, 
  isLoading, 
  error 
}: { 
  data: LiveWeatherData | null, 
  isLoading: boolean, 
  error: string | null 
}) => {
  const WeatherIcon = ({ icon }: { icon: LiveWeatherData['conditionIcon'] }) => {
    switch(icon) {
      case 'sun':
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 14.464A1 1 0 106.465 13.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zm-1.414-2.12a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zM4 11a1 1 0 100-2H3a1 1 0 100 2h1z" clipRule="evenodd" /></svg>;
      case 'cloud':
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" /></svg>;
      case 'rain':
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
            <path d="M15.5 16a3.5 3.5 0 00-3.32-3.48 4 4 0 00-7.86 1.48A4.5 4.5 0 006.5 16h9z"/>
            <path d="M8.5 16.5a1 1 0 10-2 0 1 1 0 002 0zM12.5 16.5a1 1 0 10-2 0 1 1 0 002 0z"/>
        </svg>;
      case 'storm':
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13 2.05v.01c0 .09.02.18.04.27l1.45 4.34H16a2 2 0 011.66 3.11L13 15.89v2.06A2.05 2.05 0 0111 20a2.05 2.05 0 01-2-2.05v-2.1l-4.6-6.38A2 2 0 016 6.05h1.55l1.4-4.21c.03-.08.05-.16.05-.24v-.01a2.05 2.05 0 014 0z"/>
            <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z"/>
        </svg>;
      default:
        return null;
    }
  };
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
            <svg className="animate-spin h-8 w-8 text-cyan-500 dark:text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="ml-3 text-sm text-gray-600 dark:text-gray-400">Fetching live data...</p>
        </div>
      );
    }

    if (error) {
      return (
         <div className="text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded-md flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            {error}
         </div>
      );
    }
    
    if (data) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
            <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
              <WeatherIcon icon={data.conditionIcon} />
              <p className="font-semibold text-gray-800 dark:text-gray-200">{data.condition}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{data.temperature}°C</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Feels like {data.feelsLike}°</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-gray-800 dark:text-gray-200">{data.windSpeed} <span className="text-sm">km/h</span></p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Wind ({data.windDirection})</p>
            </div>
            <p className="col-span-2 sm:col-span-1 text-xs text-gray-500 dark:text-gray-400 text-right">Updated: {data.lastUpdated}</p>
        </div>
      );
    }
    return null;
  }
  
  return (
    <div className="mb-4 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
       <div className="flex items-center mb-2">
         <span className="bg-red-500 text-white text-xs font-bold mr-2 px-2 py-0.5 rounded-full">LIVE</span>
         <h3 className="font-semibold text-gray-700 dark:text-gray-300">Current Conditions</h3>
       </div>
      {renderContent()}
    </div>
  );
};


export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [analysis, setAnalysis] = useState<WeatherAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isHiResImageLoaded, setIsHiResImageLoaded] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isLookerModalOpen, setIsLookerModalOpen] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [visualSummary, setVisualSummary] = useState<{base64: string, mimeType: string} | null>(null);
  const [composedOverlayImage, setComposedOverlayImage] = useState<{base64: string, mimeType: string} | null>(null);
  const [unifiedAnalysisImage, setUnifiedAnalysisImage] = useState<{base64: string, mimeType: string} | null>(null);
  const [isGeneratingVisual, setIsGeneratingVisual] = useState<boolean>(false);
  const [isGeneratingOverlay, setIsGeneratingOverlay] = useState<boolean>(false);
  const [isGeneratingUnified, setIsGeneratingUnified] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'original' | 'overlay' | 'ai' | 'unified'>('original');
  const [forecastHour, setForecastHour] = useState<number>(0);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showWind, setShowWind] = useState<boolean>(false);
  const [showIsobars, setShowIsobars] = useState<boolean>(false);
  const [tooltip, setTooltip] = useState<{ visible: boolean; content: React.ReactNode; x: number; y: number }>({ visible: false, content: '', x: 0, y: 0 });

  const [includeStormTrack, setIncludeStormTrack] = useState<boolean>(true);
  const [includeAnomalies, setIncludeAnomalies] = useState<boolean>(true);
  const [includeStormSurge, setIncludeStormSurge] = useState<boolean>(true);

  const [liveWeatherData, setLiveWeatherData] = useState<LiveWeatherData | null>(null);
  const [isFetchingLiveWeather, setIsFetchingLiveWeather] = useState<boolean>(false);
  const [liveWeatherError, setLiveWeatherError] = useState<string | null>(null);
  

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('bg-gray-900');
      document.body.classList.remove('bg-gray-100');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.add('bg-gray-100');
      document.body.classList.remove('bg-gray-900');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    try {
      const savedAnalysisJSON = localStorage.getItem('latestWeatherAnalysis');
      const savedImageJSON = localStorage.getItem('latestWeatherImage');

      if (savedAnalysisJSON && savedImageJSON) {
        const savedAnalysis: WeatherAnalysis = JSON.parse(savedAnalysisJSON);
        const savedImageInfo: { base64: string; mimeType: string; fileName: string } = JSON.parse(savedImageJSON);

        if (savedAnalysis && savedImageInfo) {
            const imageFile = base64ToFile(savedImageInfo.base64, savedImageInfo.fileName, savedImageInfo.mimeType);
            
            setAnalysis(savedAnalysis);
            setSelectedImage({
                file: imageFile,
                base64: savedImageInfo.base64,
                mimeType: savedImageInfo.mimeType,
            });
        }
      }
    } catch (e) {
      console.error("Failed to load saved analysis from localStorage", e);
      // Clear potentially corrupted data
      localStorage.removeItem('latestWeatherAnalysis');
      localStorage.removeItem('latestWeatherImage');
    }
  }, []);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setImageDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    const currentRef = imageContainerRef.current;
    if (currentRef) {
      resizeObserver.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        resizeObserver.unobserve(currentRef);
      }
    };
  }, []);

  const resetAnalysis = useCallback(() => {
    setAnalysis(null);
    setError(null);
    setVisualSummary(null);
    setComposedOverlayImage(null);
    setUnifiedAnalysisImage(null);
    setViewMode('original');
    setForecastHour(0);
    setShowHeatmap(false);
    setShowWind(false);
    setShowIsobars(false);
    setIncludeStormTrack(true);
    setIncludeAnomalies(true);
    setIncludeStormSurge(true);
    setLiveWeatherData(null);
    setLiveWeatherError(null);
    setIsFetchingLiveWeather(false);
  }, []);

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find(item => item.kind === 'file' && item.type.startsWith('image/'));

    if (imageItem) {
        event.preventDefault();
        const imageFile = imageItem.getAsFile();
        if (imageFile) {
            setIsUploading(true);
            setIsHiResImageLoaded(false);
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                setSelectedImage({ file: imageFile, base64: base64String, mimeType: imageFile.type });
                resetAnalysis();
                setIsUploading(false);
            };
            reader.onerror = () => {
              setError("Failed to read the pasted image.");
              setIsUploading(false);
            };
            reader.readAsDataURL(imageFile);
        }
    }
  }, [resetAnalysis]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => { document.removeEventListener('paste', handlePaste); };
  }, [handlePaste]);

  useEffect(() => {
    if (analysis && analysis.centerCoordinates) {
      const { lat, lon } = analysis.centerCoordinates;
      const fetchLiveWeather = async () => {
        setIsFetchingLiveWeather(true);
        setLiveWeatherError(null);
        setLiveWeatherData(null);
        try {
          const data = await fetchLiveWeatherData(lat, lon);
          setLiveWeatherData(data);
        } catch (err: any) {
          setLiveWeatherError(err.message || "Failed to fetch live weather.");
        } finally {
          setIsFetchingLiveWeather(false);
        }
      };
      fetchLiveWeather();
    } else {
      setLiveWeatherData(null);
      setLiveWeatherError(null);
      setIsFetchingLiveWeather(false);
    }
  }, [analysis]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      setIsHiResImageLoaded(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setSelectedImage({ file: file, base64: base64String, mimeType: file.type });
        resetAnalysis();
        setIsUploading(false);
      };
      reader.onerror = () => {
        setError("Failed to read the image file.");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeClick = useCallback(async () => {
    if (!selectedImage) return;
    setIsLoading(true);
    resetAnalysis();
    try {
      const result = await explainWeatherFromImage(selectedImage.mimeType, selectedImage.base64);
      if (result.explanation === 'ERROR: Not a weather map') {
        setError('The provided image does not appear to be a weather map.');
        setAnalysis(null);
      } else {
        setAnalysis(result);
        localStorage.setItem('latestWeatherAnalysis', JSON.stringify(result));
        localStorage.setItem('latestWeatherImage', JSON.stringify({
          base64: selectedImage.base64,
          mimeType: selectedImage.mimeType,
          fileName: selectedImage.file.name
        }));
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedImage, resetAnalysis]);

  const handleUseSample = async () => {
    setIsUploading(true);
    setIsHiResImageLoaded(false);
    resetAnalysis();
    try {
      const response = await fetch(HISTORICAL_IMAGE_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        const file = new File([blob], "hurricane-ian.jpg", { type: blob.type });
        setSelectedImage({
          file: file,
          base64: base64String,
          mimeType: blob.type,
        });
        setIsUploading(false);
      };
      reader.onerror = () => {
        setError("Failed to read sample image file.");
        setIsUploading(false);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error("Failed to fetch sample image:", e);
      setError("Could not load the sample image. Please check your network connection.");
      setIsUploading(false);
    }
  };

  const getDisplayImage = () => {
    if (!selectedImage) return null;
    switch (viewMode) {
      case 'unified':
        if (unifiedAnalysisImage) return { src: `data:${unifiedAnalysisImage.mimeType};base64,${unifiedAnalysisImage.base64}`, name: 'Unified Summary Card' };
        break;
      case 'ai':
        if (visualSummary) return { src: `data:${visualSummary.mimeType};base64,${visualSummary.base64}`, name: 'AI-Generated Visual Summary' };
        break;
      case 'overlay':
        if (composedOverlayImage) return { src: `data:${composedOverlayImage.mimeType};base64,${composedOverlayImage.base64}`, name: 'Image with Overlays' };
        break;
    }
    return { src: `data:${selectedImage.mimeType};base64,${selectedImage.base64}`, name: selectedImage.file.name };
  };

  const generateComposedImageBase64 = useCallback(async (): Promise<string> => {
    if (!selectedImage || !analysis || !imageContainerRef.current) {
        throw new Error("Missing required data for image composition.");
    }

    const { width: containerWidth, height: containerHeight } = imageDimensions;
    const originalImg = new Image();

    return new Promise<string>((resolve, reject) => {
        originalImg.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = containerWidth;
            canvas.height = containerHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }

            // --- Aspect Ratio Calculation ---
            const imgNaturalWidth = originalImg.naturalWidth;
            const imgNaturalHeight = originalImg.naturalHeight;

            const scale = Math.min(containerWidth / imgNaturalWidth, containerHeight / imgNaturalHeight);
            const scaledWidth = imgNaturalWidth * scale;
            const scaledHeight = imgNaturalHeight * scale;
            
            const xOffset = (containerWidth - scaledWidth) / 2;
            const yOffset = (containerHeight - scaledHeight) / 2;

            // 1. Draw original image with correct aspect ratio
            ctx.drawImage(originalImg, xOffset, yOffset, scaledWidth, scaledHeight);
            
            // --- Helper functions for coordinate transformation ---
            const transformCoords = (p: {x: number, y: number}) => ({
                x: xOffset + (p.x / 100 * scaledWidth),
                y: yOffset + (p.y / 100 * scaledHeight),
            });

            const scaleSvgPathForCanvasWithOffset = (path: string): string => {
                const commands = path.split(/(?=[MmLlHhVvCcSsQqTtAaZz])/);
                return commands.map(command => {
                    if (!command) return '';
                    const op = command.charAt(0);
                    const args = command.substring(1).trim().split(/[\s,]+/).map(parseFloat);
                    const scaledArgs = args.map((arg, i) => {
                    if (isNaN(arg)) return '';
                    return (i % 2 === 0) 
                        ? (xOffset + (arg / 100 * scaledWidth)).toFixed(2) 
                        : (yOffset + (arg / 100 * scaledHeight)).toFixed(2);
                    });
                    return op + scaledArgs.join(' ');
                }).join('');
            };

            // 2. Draw heatmap
            if (showHeatmap && analysis.temperature) {
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = getTemperatureColor(analysis.temperature);
                ctx.fillRect(xOffset, yOffset, scaledWidth, scaledHeight);
                ctx.globalAlpha = 1.0;
            }

            // 3. Draw storm track, anomalies, surge
            if (includeStormTrack && analysis.stormTrack && analysis.stormTrack.length > 0) {
                ctx.beginPath();
                const firstPoint = transformCoords(analysis.stormTrack[0]);
                ctx.moveTo(firstPoint.x, firstPoint.y);
                analysis.stormTrack.forEach(point => {
                    const canvasPoint = transformCoords(point);
                    ctx.lineTo(canvasPoint.x, canvasPoint.y);
                });
                ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.setLineDash([]);

                analysis.stormTrack.forEach(point => {
                    const canvasPoint = transformCoords(point);
                    ctx.beginPath();
                    ctx.arc(canvasPoint.x, canvasPoint.y, 6, 0, 2 * Math.PI);
                    ctx.fillStyle = getIntensityColor(point.intensity);
                    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
                    ctx.lineWidth = 1;
                    ctx.fill();
                    ctx.stroke();
                });
            }

            if (includeAnomalies && analysis.anomalyStreaks && analysis.anomalyStreaks.length > 0) {
                analysis.anomalyStreaks.forEach(streak => {
                    ctx.beginPath();
                    const firstPoint = transformCoords(streak.points[0]);
                    ctx.moveTo(firstPoint.x, firstPoint.y);
                    for (let i = 1; i < streak.points.length; i++) {
                        const canvasPoint = transformCoords(streak.points[i]);
                        ctx.lineTo(canvasPoint.x, canvasPoint.y);
                    }
                    ctx.closePath();
                    ctx.fillStyle = "rgba(250, 204, 21, 0.25)";
                    ctx.strokeStyle = "#facc15";
                    ctx.lineWidth = 2;
                    ctx.fill();
                    ctx.stroke();
                    
                    if (streak.points.length > 0) {
                        const centroidPercent = streak.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
                        centroidPercent.x /= streak.points.length;
                        centroidPercent.y /= streak.points.length;
                        const centroidCanvas = transformCoords(centroidPercent);

                        ctx.font = 'bold 14px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 3;
                        ctx.strokeText(streak.description, centroidCanvas.x, centroidCanvas.y);
                        ctx.fillStyle = 'white';
                        ctx.fillText(streak.description, centroidCanvas.x, centroidCanvas.y);
                    }
                });
            }

            if (includeStormSurge && analysis.stormSurge && analysis.stormSurge.affectedArea.length > 0) {
                const surgeArea = analysis.stormSurge.affectedArea;
                ctx.beginPath();
                const firstCanvasPoint = transformCoords(surgeArea[0]);
                ctx.moveTo(firstCanvasPoint.x, firstCanvasPoint.y);
                for (let i = 1; i < surgeArea.length; i++) {
                    const canvasPoint = transformCoords(surgeArea[i]);
                    ctx.lineTo(canvasPoint.x, canvasPoint.y);
                }
                ctx.closePath();
                ctx.fillStyle = "rgba(220, 38, 38, 0.4)";
                ctx.strokeStyle = "rgba(255, 100, 100, 0.8)";
                ctx.lineWidth = 1.5;
                ctx.fill();
                ctx.stroke();

                const centroidPercent = surgeArea.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
                centroidPercent.x /= surgeArea.length;
                centroidPercent.y /= surgeArea.length;
                const centroidCanvas = transformCoords(centroidPercent);

                ctx.font = 'bold 16px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 3;
                ctx.strokeText(`${analysis.stormSurge!.surgeHeight}m Surge`, centroidCanvas.x, centroidCanvas.y);
                ctx.fillStyle = 'white';
                ctx.fillText(`${analysis.stormSurge!.surgeHeight}m Surge`, centroidCanvas.x, centroidCanvas.y);
            }

            // 4. Draw Isobars
            if (showIsobars && analysis.isobars && analysis.isobars.length > 0) {
                analysis.isobars.forEach(isobar => {
                    const scaledPath = scaleSvgPathForCanvasWithOffset(isobar.path);
                    ctx.strokeStyle = "rgba(230, 230, 230, 0.9)";
                    ctx.lineWidth = 1.5;
                    ctx.stroke(new Path2D(scaledPath));
                    
                    const labelCanvas = transformCoords(isobar.labelPosition);
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                    ctx.lineWidth = 2;
                    ctx.strokeText(isobar.pressure.toString(), labelCanvas.x, labelCanvas.y);
                    ctx.fillStyle = 'white';
                    ctx.fillText(isobar.pressure.toString(), labelCanvas.x, labelCanvas.y);
                });
            }

            // 5. Draw Wind Arrows
            if (showWind && analysis.windField && analysis.windField.length > 0) {
                analysis.windField.forEach(point => {
                    const canvasPoint = transformCoords(point);
                    drawWindArrowOnCanvas(ctx, canvasPoint.x, canvasPoint.y, point.speed, point.direction);
                });
            }

            const pngDataUrl = canvas.toDataURL('image/png');
            resolve(pngDataUrl.split(',')[1]);
        };

        originalImg.onerror = () => {
            reject(new Error("Failed to load original image for composition."));
        };

        originalImg.src = `data:${selectedImage.mimeType};base64,${selectedImage.base64}`;
    });
  }, [selectedImage, analysis, imageDimensions, includeStormTrack, includeAnomalies, includeStormSurge, showHeatmap, showWind, showIsobars]);


  const handleGenerateOverlayImage = useCallback(async () => {
      setIsGeneratingOverlay(true);
      setError(null);
      try {
          const composedBase64 = await generateComposedImageBase64();
          setComposedOverlayImage({ base64: composedBase64, mimeType: 'image/png' });
          setViewMode('overlay');
      } catch (err: any) {
          setError(err.message || 'Failed to generate overlay image.');
      } finally {
          setIsGeneratingOverlay(false);
      }
  }, [generateComposedImageBase64]);

  const handleGenerateAISummary = useCallback(async () => {
    if (!analysis) return;
    setIsGeneratingVisual(true);
    setError(null);
    try {
        const composedBase64 = await generateComposedImageBase64();
        const generatedImageBase64 = await generateVisualSummaryImage(composedBase64, 'image/png', analysis);
        setVisualSummary({ base64: generatedImageBase64, mimeType: 'image/png' });
        setViewMode('ai');
    } catch (err: any) {
        setError(err.message || 'Failed to generate AI summary.');
    } finally {
        setIsGeneratingVisual(false);
    }
  }, [analysis, generateComposedImageBase64]);
  
  const generateUnifiedAnalysisImage = async (
    analysis: WeatherAnalysis, 
    composedImage: { base64: string, mimeType: string }, 
    theme: 'light' | 'dark'
  ): Promise<string> => {
      const canvas = document.createElement('canvas');
      const width = 800;
      const height = 1200;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context not available");

      const ICONS: { [key: string]: string } = {
        temp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 16V4a4 4 0 10-8 0v12a6 6 0 108 0z" /><path d="M13 16h-4" /></svg>`,
        wind: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>`,
        precip: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.502 19.001H6.5c-2.208 0-4-1.792-4-4s1.792-4 4-4h.198c.414-3.402 3.286-6 6.802-6 3.805 0 6.998 2.903 6.998 6.5v.5c1.381 0 2.5 1.119 2.5 2.5s-1.119 2.5-2.5 2.5z" /></svg>`,
        humidity: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.375 8.25a5.625 5.625 0 1111.25 0c0 3.108-2.517 5.625-5.625 5.625S6.375 11.358 6.375 8.25z" /><path d="M12 13.875V19.5" /><path d="M8.25 19.5h7.5" /></svg>`,
        uv: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`,
        dir: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l-7-7 7-7 7 7-7 7z" transform="rotate(-45 12 12)" /><path d="M12 2v10" /></svg>`
      };

      const loadIcon = (svgString: string, color: string): Promise<HTMLImageElement> => {
        return new Promise(resolve => {
          const img = new Image();
          const coloredSvg = svgString.replace('<svg', `<svg stroke="${color}"`);
          img.src = `data:image/svg+xml;base64,${btoa(coloredSvg)}`;
          img.onload = () => resolve(img);
        });
      };
      
      const loadImage = (base64: string, mimeType: string): Promise<HTMLImageElement> => {
        return new Promise(resolve => {
            const img = new Image();
            img.src = `data:${mimeType};base64,${base64}`;
            img.onload = () => resolve(img);
        });
      };
      
      const wrapText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
        const words = text.split(' ');
        let line = '';
        for(let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = context.measureText(testLine);
          const testWidth = metrics.width;
          if (testWidth > maxWidth && n > 0) {
            context.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
          } else {
            line = testLine;
          }
        }
        context.fillText(line, x, y);
      };

      // --- Drawing ---
      const p = 40; // padding
      const contentWidth = width - 2 * p;

      // Colors
      const bgColor = theme === 'dark' ? '#1f2937' : '#f3f4f6';
      const textColor = theme === 'dark' ? '#e5e7eb' : '#111827';
      const secondaryColor = theme === 'dark' ? '#9ca3af' : '#4b5563';
      const accentColor = '#06b6d4';

      // Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      
      // Load assets
      const [mapImage, tempIcon, windIcon, precipIcon, humidityIcon, uvIcon, dirIcon] = await Promise.all([
        loadImage(composedImage.base64, composedImage.mimeType),
        loadIcon(ICONS.temp, accentColor),
        loadIcon(ICONS.wind, accentColor),
        loadIcon(ICONS.precip, accentColor),
        loadIcon(ICONS.humidity, accentColor),
        loadIcon(ICONS.uv, accentColor),
        loadIcon(ICONS.dir, accentColor)
      ]);
      
      // Header
      ctx.fillStyle = textColor;
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AI Weather Analysis', width / 2, p + 30);
      ctx.fillStyle = secondaryColor;
      ctx.font = '24px sans-serif';
      ctx.fillText(analysis.location, width / 2, p + 70);
      
      // Map Image
      const mapY = p + 90;
      const mapMaxHeight = 450;
      const scale = Math.min(contentWidth / mapImage.width, mapMaxHeight / mapImage.height);
      const mapH = mapImage.height * scale;
      const mapW = mapImage.width * scale;
      ctx.drawImage(mapImage, (width - mapW) / 2, mapY, mapW, mapH);
      
      // Metrics
      const metricsY = mapY + mapH + 50;
      const metricBoxWidth = contentWidth / 3;
      const iconSize = 32;

      const metrics = [
        { icon: tempIcon, label: 'Temperature', value: `${Math.round(analysis.temperature)}°C` },
        { icon: windIcon, label: 'Wind Speed', value: `${Math.round(analysis.windSpeed)} km/h` },
        { icon: dirIcon, label: 'Direction', value: `${analysis.windDirection}` },
        { icon: precipIcon, label: 'Precipitation', value: `${analysis.chanceOfPrecipitation}%` },
        { icon: humidityIcon, label: 'Humidity', value: `${analysis.humidity}%` },
        { icon: uvIcon, label: 'UV Index', value: `${analysis.uvIndex}` }
      ];

      metrics.forEach((metric, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const x = p + col * metricBoxWidth + metricBoxWidth / 2;
        const y = metricsY + row * 90;
        
        ctx.drawImage(metric.icon, x - iconSize / 2, y, iconSize, iconSize);
        ctx.fillStyle = textColor;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(metric.value, x, y + iconSize + 20);
        ctx.fillStyle = secondaryColor;
        ctx.font = '14px sans-serif';
        ctx.fillText(metric.label, x, y + iconSize + 40);
      });
      
      // Analysis Text
      const textY = metricsY + 2 * 90 + 20;
      ctx.textAlign = 'left';
      ctx.fillStyle = textColor;
      ctx.font = '18px sans-serif';
      wrapText(ctx, analysis.explanation, p, textY, contentWidth, 28);
      
      // Footer
      ctx.fillStyle = secondaryColor;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Generated by AI Weather Explainer', width / 2, height - p/2);

      return canvas.toDataURL('image/png').split(',')[1];
  };
  
  const handleGenerateUnifiedSummary = useCallback(async () => {
    if (!analysis) return;
    setIsGeneratingUnified(true);
    setError(null);
    try {
        const composedBase64 = await generateComposedImageBase64();
        const unifiedImageBase64 = await generateUnifiedAnalysisImage(
            analysis, 
            { base64: composedBase64, mimeType: 'image/png' }, 
            theme
        );
        setUnifiedAnalysisImage({ base64: unifiedImageBase64, mimeType: 'image/png' });
        setViewMode('unified');
        setIsShareModalOpen(true);
    } catch (err: any) {
        setError(err.message || 'Failed to generate summary card.');
    } finally {
        setIsGeneratingUnified(false);
    }
  }, [analysis, generateComposedImageBase64, theme]);

  const genericDownloadHandler = (image: {base64: string, mimeType: string} | null, prefix: string) => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = `data:${image.mimeType};base64,${image.base64}`;
    const newFilename = `${prefix}_${selectedImage?.file.name.split('.')[0] || 'weather'}.png`;
    link.download = newFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const genericShareHandler = async (image: {base64: string, mimeType: string} | null, prefix: string, titleText: string, bodyText: string) => {
    if (!image || !selectedImage || !navigator.share) return;
    
    const newFilename = `${prefix}_${selectedImage.file.name.split('.')[0]}.png`;
    const fileToShare = base64ToFile(image.base64, newFilename, image.mimeType);

    try {
      await navigator.share({
        files: [fileToShare],
        title: titleText,
        text: bodyText,
      });
    } catch (error) {
      console.error(`Error sharing the ${prefix} image:`, error);
    }
  };

  const handleShareAiImage = () => {
    if (!visualSummary || !analysis) return;
    const summaryText = `Weather for ${analysis.location}: Temp: ${Math.round(analysis.temperature)}°C, Wind: ${Math.round(analysis.windSpeed)} km/h ${analysis.windDirection}, Precip: ${analysis.chanceOfPrecipitation}%, Humidity: ${analysis.humidity}%, UV: ${analysis.uvIndex}. Analysis: ${analysis.explanation.substring(0, 100)}...`;

    if (navigator.share) {
        genericShareHandler(visualSummary, 'visual_summary', `Weather Analysis for ${analysis.location}`, summaryText);
    } else {
        setIsShareModalOpen(true);
    }
  };

  const handleDownloadCurrentImage = () => {
    const displayImage = getDisplayImage();
    if (!displayImage || !selectedImage) return;

    const getPrefix = () => {
      switch (viewMode) {
        case 'unified': return 'summary-card';
        case 'ai': return 'ai-summary';
        case 'overlay': return 'overlay';
        case 'original':
        default: return 'original';
      }
    };

    const originalFilename = selectedImage.file.name.split('.').slice(0, -1).join('.') || 'weather_analysis';
    const newFilename = `${getPrefix()}_${originalFilename}.png`;

    const link = document.createElement('a');
    link.href = displayImage.src;
    link.download = newFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportForLooker = () => {
    if (!analysis || !selectedImage) return;

    const escapeCsvField = (field: any): string => {
      const stringField = String(field);
      if (/[",\n\r]/.test(stringField)) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    const headers = [
      'timestamp',
      'location',
      'temperature_celsius',
      'wind_speed_kmh',
      'wind_direction',
      'precipitation_chance_percent',
      'humidity_percent',
      'uv_index',
      'explanation',
      'image_filename',
    ];

    const dataRow = [
      new Date().toISOString(),
      analysis.location,
      analysis.temperature,
      analysis.windSpeed,
      analysis.windDirection,
      analysis.chanceOfPrecipitation,
      analysis.humidity,
      analysis.uvIndex,
      analysis.explanation,
      selectedImage.file.name,
    ].map(escapeCsvField);

    const csvContent = [
      headers.join(','),
      dataRow.join(','),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.setAttribute('download', `weather_analysis_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConnectToLooker = () => {
    handleExportForLooker(); // First, trigger the download
    setIsLookerModalOpen(true); // Then, show the instructions
  };


  const triggerFileSelect = () => fileInputRef.current?.click();
  const hasStormTrack = analysis?.stormTrack && analysis.stormTrack.length > 0;
  const hasAnomalies = analysis?.anomalyStreaks && analysis.anomalyStreaks.length > 0;
  const hasStormSurge = analysis?.stormSurge && analysis.stormSurge.affectedArea.length > 0;
  const hasIsobars = analysis?.isobars && analysis.isobars.length > 0;
  const hasWindField = analysis?.windField && analysis.windField.length > 0;
  const hasAnyOverlays = hasStormTrack || hasAnomalies || hasStormSurge || (analysis && (showHeatmap || showWind || hasIsobars));

  const displayImage = getDisplayImage();

  const getViewModeButtonClass = (mode: typeof viewMode) => {
    let baseClass = 'px-3 py-1 text-sm font-medium rounded-md transition-colors ';
    if (viewMode === mode) {
       baseClass += 'bg-cyan-500 text-white';
    } else {
       baseClass += 'bg-transparent text-gray-700 hover:bg-gray-300 dark:text-gray-300 dark:hover:bg-gray-600';
    }
    if (mode === 'unified' && !unifiedAnalysisImage) {
        baseClass += ' hidden';
    }
    return baseClass;
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin 4s linear infinite; }
        @keyframes fall {
          0% { transform: translateY(-2px); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateY(8px); opacity: 0; }
        }
        .precip-drop1 { animation: fall 1.5s linear infinite; animation-delay: 0s; }
        .precip-drop2 { animation: fall 1.5s linear infinite; animation-delay: 0.5s; }
        .precip-drop3 { animation: fall 1.5s linear infinite; animation-delay: 1s; }
        
        input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            background: #22d3ee; /* cyan-400 */
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid #fff;
            margin-top: -8px; /* Center thumb on the track */
        }
        input[type=range]::-moz-range-thumb {
            width: 16px;
            height: 16px;
            background: #22d3ee; /* cyan-400 */
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid #fff;
        }
      `}</style>
      <Tooltip visible={tooltip.visible} content={tooltip.content} x={tooltip.x} y={tooltip.y} />
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8 relative">
          <h1 className="text-4xl sm:text-5xl font-bold text-cyan-600 dark:text-cyan-400 mb-2">AI Weather Explainer</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Upload a satellite image for an expert meteorological analysis and storm tracking.</p>
          <div className="absolute top-0 right-0">
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          </div>
        </header>

        <main className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700 p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 min-h-[300px]">
            {selectedImage ? (
              <div className="text-center w-full">
                <div ref={imageContainerRef} className="relative w-full aspect-video bg-gray-200 dark:bg-gray-800/50 rounded-lg overflow-hidden mb-4 flex items-center justify-center">
                   {(isLoading || isUploading) && (
                        <div className="absolute inset-0 bg-gray-900/60 dark:bg-black/50 flex flex-col items-center justify-center z-10 rounded-lg backdrop-blur-sm transition-opacity duration-300 animate-fade-in">
                            <svg className="animate-spin h-12 w-12 text-cyan-500 dark:text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="mt-4 text-white font-semibold text-lg">
                                {isLoading ? 'Analyzing image...' : 'Loading image...'}
                            </p>
                        </div>
                    )}
                   {displayImage && (
                    <img
                        key={displayImage.src}
                        src={displayImage.src}
                        alt={displayImage.name}
                        className={`w-full h-full object-contain transition-all duration-700 ease-out ${isHiResImageLoaded ? 'blur-0 scale-100' : 'blur-xl scale-105'}`}
                        onLoad={() => setIsHiResImageLoaded(true)}
                    />
                   )}
                  {viewMode === 'ai' && visualSummary && (
                    <button
                        onClick={handleShareAiImage}
                        className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500"
                        title="Share AI-Generated Image"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>
                    </button>
                  )}
                  {viewMode === 'original' && hasStormTrack && includeStormTrack && <StormTrackDisplay track={analysis.stormTrack!} dimensions={imageDimensions} forecastHour={forecastHour} />}
                  {viewMode === 'original' && hasAnomalies && includeAnomalies && <AnomalyStreaksDisplay streaks={analysis.anomalyStreaks!} dimensions={imageDimensions} setTooltip={setTooltip} />}
                  {viewMode === 'original' && hasStormSurge && includeStormSurge && <StormSurgeDisplay surge={analysis.stormSurge!} dimensions={imageDimensions} />}
                  {viewMode === 'original' && showHeatmap && analysis && (
                    <TemperatureHeatmapDisplay temperature={analysis.temperature} />
                  )}
                  {viewMode === 'original' && showWind && hasWindField && (
                    <DynamicWindArrowOverlay windField={analysis.windField!} dimensions={imageDimensions} />
                  )}
                  {viewMode === 'original' && showIsobars && hasIsobars && (
                    <IsobarDisplay isobars={analysis.isobars!} dimensions={imageDimensions} />
                  )}
                </div>

                {hasStormTrack && viewMode === 'original' && (
                  <div className="mt-4 p-4 bg-gray-200/50 dark:bg-gray-900/50 rounded-lg">
                    <label htmlFor="time-slider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Forecast Time: <span className="font-bold text-cyan-500 dark:text-cyan-400">+{forecastHour} Hours</span>
                    </label>
                    <input
                      id="time-slider"
                      type="range"
                      min="0"
                      max="48"
                      step="1"
                      value={forecastHour}
                      onChange={(e) => setForecastHour(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}
                
                {(composedOverlayImage || visualSummary || unifiedAnalysisImage) && (
                  <div className="mt-4 flex justify-center bg-gray-200/50 dark:bg-gray-900/50 p-1 rounded-lg">
                      <div className="flex space-x-1 rounded-md bg-gray-300 dark:bg-gray-700 p-1" role="group">
                          <button onClick={() => setViewMode('original')} className={getViewModeButtonClass('original')}>Original</button>
                          {composedOverlayImage && <button onClick={() => setViewMode('overlay')} className={getViewModeButtonClass('overlay')}>Overlay</button>}
                          {visualSummary && <button onClick={() => setViewMode('ai')} className={getViewModeButtonClass('ai')}>AI Enhanced</button>}
                          {unifiedAnalysisImage && <button onClick={() => setViewMode('unified')} className={getViewModeButtonClass('unified')}>Summary Card</button>}
                      </div>
                  </div>
                )}

                {analysis && (
                  <div className="mt-4 p-3 bg-gray-200/50 dark:bg-gray-900/50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Analysis Layers:</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      {hasStormTrack && (
                        <label className="flex items-center space-x-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeStormTrack}
                            onChange={(e) => setIncludeStormTrack(e.target.checked)}
                            className="h-4 w-4 rounded bg-gray-200 border-gray-400 text-cyan-600 focus:ring-cyan-500 dark:bg-gray-700 dark:border-gray-600 dark:text-cyan-500 dark:focus:ring-cyan-600"
                          />
                          <span>Storm Track</span>
                        </label>
                      )}
                      {hasAnomalies && (
                        <label className="flex items-center space-x-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeAnomalies}
                            onChange={(e) => setIncludeAnomalies(e.target.checked)}
                            className="h-4 w-4 rounded bg-gray-200 border-gray-400 text-cyan-600 focus:ring-cyan-500 dark:bg-gray-700 dark:border-gray-600 dark:text-cyan-500 dark:focus:ring-cyan-600"
                          />
                          <span>Anomalies</span>
                        </label>
                      )}
                      {hasStormSurge && (
                        <label className="flex items-center space-x-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeStormSurge}
                            onChange={(e) => setIncludeStormSurge(e.target.checked)}
                            className="h-4 w-4 rounded bg-gray-200 border-gray-400 text-cyan-600 focus:ring-cyan-500 dark:bg-gray-700 dark:border-gray-600 dark:text-cyan-500 dark:focus:ring-cyan-600"
                          />
                          <span>Storm Surge</span>
                        </label>
                      )}
                      <label className="flex items-center space-x-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showHeatmap}
                          onChange={(e) => setShowHeatmap(e.target.checked)}
                          className="h-4 w-4 rounded bg-gray-200 border-gray-400 text-cyan-600 focus:ring-cyan-500 dark:bg-gray-700 dark:border-gray-600 dark:text-cyan-500 dark:focus:ring-cyan-600"
                        />
                        <span>Heatmap</span>
                      </label>
                      <label className={`flex items-center space-x-2 text-sm text-gray-800 dark:text-gray-200 ${!hasWindField ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={showWind}
                          disabled={!hasWindField}
                          onChange={(e) => setShowWind(e.target.checked)}
                          className="h-4 w-4 rounded bg-gray-200 border-gray-400 text-cyan-600 focus:ring-cyan-500 dark:bg-gray-700 dark:border-gray-600 dark:text-cyan-500 dark:focus:ring-cyan-600"
                        />
                        <span>Wind Arrows</span>
                      </label>
                      <label className={`flex items-center space-x-2 text-sm text-gray-800 dark:text-gray-200 ${!hasIsobars ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={showIsobars}
                          disabled={!hasIsobars}
                          onChange={(e) => setShowIsobars(e.target.checked)}
                          className="h-4 w-4 rounded bg-gray-200 border-gray-400 text-cyan-600 focus:ring-cyan-500 dark:bg-gray-700 dark:border-gray-600 dark:text-cyan-500 dark:focus:ring-cyan-600 disabled:opacity-50"
                        />
                        <span>Isobars</span>
                      </label>
                    </div>
                  </div>
                )}
                
                {analysis && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 mt-4">
                        <button
                          onClick={handleGenerateUnifiedSummary}
                          disabled={isLoading || isGeneratingUnified || isGeneratingOverlay || isGeneratingVisual || !hasAnyOverlays}
                          className="w-full col-span-2 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                          title={!hasAnyOverlays ? "No analysis data to generate a summary from" : "Generate a shareable summary card"}
                        >
                            {isGeneratingUnified ? 'Generating Card...' : 'Create Share Card'}
                        </button>
                        <button
                            onClick={handleGenerateOverlayImage}
                            disabled={isLoading || isGeneratingOverlay || isGeneratingVisual || !hasAnyOverlays}
                            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                            title={!hasAnyOverlays ? "No analysis data to generate an overlay from" : "Generate a static image with analysis overlays"}
                        >
                            {isGeneratingOverlay ? 'Generating...' : 'Generate Overlay Image'}
                        </button>
                        <button
                            onClick={handleGenerateAISummary}
                            disabled={isLoading || isGeneratingVisual || isGeneratingOverlay || !hasAnyOverlays}
                            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                            title={!hasAnyOverlays ? "No analysis data to generate a summary from" : "Use AI to generate an enhanced visual summary"}
                        >
                            {isGeneratingVisual ? 'Generating...' : 'Generate AI Summary'}
                        </button>
                    </div>
                )}
                
                <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-4">{displayImage?.name || ''}</p>

                {hasStormTrack && (
                  <div className="mt-4 text-xs text-left bg-gray-200/50 dark:bg-gray-900/50 p-3 rounded-md">
                    <p className="font-bold text-gray-800 dark:text-gray-200 mb-2">Storm Track Legend:</p>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: getIntensityColor('5')}}></div>
                      <span className="text-gray-600 dark:text-gray-400">Cat 3-5</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: getIntensityColor('1')}}></div>
                      <span className="text-gray-600 dark:text-gray-400">Cat 1-2</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: getIntensityColor('ts')}}></div>
                      <span className="text-gray-600 dark:text-gray-400">Tropical Storm</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                <h3 className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">No image selected</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by uploading an image, using our sample, or pasting a screenshot.</p>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
              <button onClick={triggerFileSelect} className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-cyan-500">Upload Image</button>
              <button onClick={handleUseSample} className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-800 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-indigo-500">Use Sample</button>
            </div>
          </div>

          <div className="flex flex-col">
            <button onClick={handleAnalyzeClick} disabled={!selectedImage || isLoading || isUploading} className="w-full mb-4 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed">
              {isLoading ? 'Analyzing...' : 'Analyze Weather'}
            </button>
            {analysis && !isLoading && (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <button
                        onClick={handleConnectToLooker}
                        className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-green-500"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                           <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        Connect to Looker
                    </button>
                    <button
                        onClick={handleExportForLooker}
                        title="Export analysis as a CSV file for other tools"
                        className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-sky-500"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                       </svg>
                        Export CSV
                    </button>
                </div>
            )}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 flex-grow min-h-[200px] flex flex-col">
              
               {(analysis || isFetchingLiveWeather) && (
                  <LiveWeatherDisplay data={liveWeatherData} isLoading={isFetchingLiveWeather} error={liveWeatherError} />
                )}

              <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                 <div className="flex items-center gap-3">
                   <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Meteorological Analysis</h2>
                   {analysis && !isLoading && (
                    <>
                      <button onClick={() => setIsShareModalOpen(true)} title="Share Analysis" className="text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>
                      </button>
                      <button onClick={handleDownloadCurrentImage} title="Download Current Image" className="text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </>
                   )}
                 </div>
                 <div className="flex items-center gap-x-4 gap-y-2 flex-wrap justify-end">
                  {analysis && !isLoading && (<>
                      <LocationDisplay 
                        location={analysis.location} 
                        onMapClick={() => setIsMapModalOpen(true)} 
                        isMapAvailable={!!analysis.centerCoordinates} 
                      />
                      <TemperatureDisplay temp={analysis.temperature} />
                      <WindSpeedDisplay speed={analysis.windSpeed} />
                      <PrecipitationDisplay chance={analysis.chanceOfPrecipitation} />
                      <HumidityDisplay humidity={analysis.humidity} />
                      <UvIndexDisplay index={analysis.uvIndex} />
                      <WindDirectionArrow direction={analysis.windDirection} />
                  </>)}
                 </div>
              </div>
              
              <div className="flex-grow">
                {/* FIX: Removed an extra closing div tag which was causing a JSX parsing error. */}
                {isLoading && (<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500 dark:border-cyan-400"></div></div>)}
                {error && <div className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 p-3 rounded-md">{error}</div>}
                {analysis && (<div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{analysis.explanation}</div>)}
                {!isLoading && !analysis && !error && (<p className="text-gray-500 dark:text-gray-400">Your weather analysis will appear here.</p>)}
              </div>
            </div>
          </div>
        </main>
      </div>
      <ShareModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        analysisData={analysis}
        visualSummaryImage={visualSummary}
        composedOverlayImage={composedOverlayImage}
        unifiedAnalysisImage={unifiedAnalysisImage}
        selectedImage={selectedImage}
        theme={theme}
        genericDownloadHandler={genericDownloadHandler}
        genericShareHandler={genericShareHandler}
      />
       <MapModal 
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        analysis={analysis}
      />
      <LookerStepsModal
        isOpen={isLookerModalOpen}
        onClose={() => setIsLookerModalOpen(false)}
      />
    </div>
  );
}