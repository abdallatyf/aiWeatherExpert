import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ImageFile } from './types';
import { explainWeatherFromImage, WeatherAnalysis, StormTrackPoint, AnomalyStreak, generateVisualSummaryImage, StormSurgeForecast, fetchLiveWeatherData, LiveWeatherData, Isobar } from './services/geminiService';
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

// Helper to get rotation for wind barb based on direction string
const getRotationForBarb = (dir: string): number => {
    const normalizedDir = dir.toUpperCase().replace(/[^A-Z]/g, '');
    // Barb staff points in the direction the wind is FROM.
    const directionMap: { [key: string]: number } = {
      'N': 0, 'NE': 45, 'E': 90, 'SE': 135,
      'S': 180, 'SW': 225, 'W': 270, 'NW': 315,
    };
    for (const key in directionMap) {
      if (normalizedDir.startsWith(key)) return directionMap[key];
    }
    return 0;
};

// Helper to draw a single wind barb on a canvas context
const drawWindBarbOnCanvas = (ctx: CanvasRenderingContext2D, x: number, y: number, speed: number, direction: string) => {
    const rotation = getRotationForBarb(direction);
    const speedInKnots = Math.round(speed / 1.852);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * Math.PI / 180); // Convert degrees to radians
    ctx.strokeStyle = 'white';
    ctx.fillStyle = 'white';
    ctx.lineWidth = 1.5;

    // Calm wind (circle)
    if (speedInKnots < 3) {
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
        return;
    }
    
    const staffLength = 25;
    const barbLength = 10;
    const halfBarbLength = 5;
    const barbSpacing = 4;
    const pennantHeight = barbSpacing;

    // Staff
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -staffLength);
    ctx.stroke();

    let remainingKnots = speedInKnots;
    let currentY = -staffLength;

    const numPennants = Math.floor(remainingKnots / 50);
    remainingKnots %= 50;
    const numFullBarbs = Math.floor(remainingKnots / 10);
    remainingKnots %= 10;
    const numHalfBarbs = remainingKnots >= 5 ? 1 : 0;
    
    // Draw from the tip of the staff inwards
    for (let i = 0; i < numPennants; i++) {
        ctx.beginPath();
        ctx.moveTo(0, currentY);
        ctx.lineTo(-barbLength, currentY + pennantHeight / 2);
        ctx.lineTo(0, currentY + pennantHeight);
        ctx.closePath();
        ctx.fill();
        currentY += pennantHeight + 2;
    }

    if (numPennants > 0 && (numFullBarbs > 0 || numHalfBarbs > 0)) {
        currentY += barbSpacing / 2;
    }

    for (let i = 0; i < numFullBarbs; i++) {
        ctx.beginPath();
        ctx.moveTo(0, currentY);
        ctx.lineTo(-barbLength, currentY - barbSpacing);
        ctx.stroke();
        currentY += barbSpacing;
    }

    if (numHalfBarbs > 0) {
        ctx.beginPath();
        ctx.moveTo(0, currentY);
        ctx.lineTo(-halfBarbLength, currentY - barbSpacing / 2);
        ctx.stroke();
    }
    
    ctx.restore();
};

// Helper to scale an SVG path string from percentage-based to pixel-based coordinates
const scaleSvgPathForCanvas = (path: string, width: number, height: number): string => {
    const commands = path.split(/(?=[MmLlHhVvCcSsQqTtAaZz])/);
    return commands.map(command => {
        if (!command) return '';
        const op = command.charAt(0);
        const args = command.substring(1).trim().split(/[\s,]+/).map(parseFloat);
        const scaledArgs = args.map((arg, i) => {
        if (isNaN(arg)) return '';
        // Scale X coordinates (even indices) by width, Y (odd indices) by height
        return (i % 2 === 0) ? (arg / 100 * width).toFixed(2) : (arg / 100 * height).toFixed(2);
        });
        return op + scaledArgs.join(' ');
    }).join('');
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


const ShareModal = ({ 
  isOpen, 
  onClose, 
  analysisData, 
  visualSummaryImage, 
  composedOverlayImage,
  selectedImage,
  theme
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  analysisData: WeatherAnalysis | null, 
  visualSummaryImage: { base64: string, mimeType: string } | null,
  composedOverlayImage: { base64: string, mimeType: string } | null,
  selectedImage: ImageFile | null,
  theme: 'light' | 'dark'
}) => {
  const [copyButtonText, setCopyButtonText] = useState('Copy');
  const [shareMode, setShareMode] = useState<'analysis' | 'original' | 'overlay' | 'visual'>('analysis');
  
  useEffect(() => {
    if (isOpen) {
      setCopyButtonText('Copy');
      // Set a smart default share mode
      if (visualSummaryImage) {
        setShareMode('visual');
      } else if (composedOverlayImage) {
        setShareMode('overlay');
      } else {
        setShareMode('analysis');
      }
    }
  }, [isOpen, visualSummaryImage, composedOverlayImage]);

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

  const handleDownloadVisualSummary = () => {
    if (!visualSummaryImage) return;
    const link = document.createElement('a');
    link.href = `data:${visualSummaryImage.mimeType};base64,${visualSummaryImage.base64}`;
    const newFilename = `visual_summary_${selectedImage?.file.name.split('.')[0] || 'weather'}.png`;
    link.download = newFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleShareVisualSummary = async () => {
    if (!visualSummaryImage || !selectedImage || !navigator.share) return;
    
    const newFilename = `visual_summary_${selectedImage.file.name.split('.')[0]}.png`;
    const fileToShare = base64ToFile(visualSummaryImage.base64, newFilename, visualSummaryImage.mimeType);

    try {
      await navigator.share({
        files: [fileToShare],
        title: `Weather Analysis for ${location}`,
        text: summaryText,
      });
    } catch (error) {
      console.error('Error sharing the visual summary:', error);
    }
  };
  
  const handleDownloadComposedImage = () => {
    if (!composedOverlayImage) return;
    const link = document.createElement('a');
    link.href = `data:${composedOverlayImage.mimeType};base64,${composedOverlayImage.base64}`;
    const newFilename = `overlay_${selectedImage?.file.name.split('.')[0] || 'weather'}.png`;
    link.download = newFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareComposedImage = async () => {
    if (!composedOverlayImage || !selectedImage || !navigator.share) return;
    
    const newFilename = `overlay_${selectedImage.file.name.split('.')[0]}.png`;
    const fileToShare = base64ToFile(composedOverlayImage.base64, newFilename, composedOverlayImage.mimeType);

    try {
      await navigator.share({
        files: [fileToShare],
        title: `Weather Overlay for ${location}`,
        text: summaryText,
      });
    } catch (error) {
      console.error('Error sharing the overlay image:', error);
    }
  };

  const handleDownloadOriginalImage = () => {
    if (!selectedImage) return;
    const link = document.createElement('a');
    link.href = `data:${selectedImage.mimeType};base64,${selectedImage.base64}`;
    link.download = selectedImage.file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleShareOriginalImage = async () => {
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
  };

  const getTabClass = (mode: 'analysis' | 'original' | 'overlay' | 'visual') => {
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
            <nav className="-mb-px flex justify-center space-x-4" aria-label="Tabs">
                <button
                    onClick={() => setShareMode('analysis')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${getTabClass('analysis')}`}
                >
                    Analysis
                </button>
                <button
                    onClick={() => setShareMode('original')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${getTabClass('original')}`}
                    disabled={!selectedImage}
                >
                    Original
                </button>
                 <button
                    onClick={() => setShareMode('overlay')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${getTabClass('overlay')} disabled:text-gray-600 disabled:cursor-not-allowed disabled:border-transparent`}
                    disabled={!composedOverlayImage}
                >
                    Overlay
                </button>
                <button
                    onClick={() => setShareMode('visual')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${getTabClass('visual')} disabled:text-gray-600 disabled:cursor-not-allowed disabled:border-transparent`}
                    disabled={!visualSummaryImage}
                >
                    AI Summary
                </button>
            </nav>
        </div>

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
                onClick={handleShareComposedImage}
                disabled={!navigator.share}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
                title={!navigator.share ? 'Web Share API not supported' : 'Share image using native dialog'}
              >
                Share Image
              </button>
              <button
                onClick={handleDownloadComposedImage}
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
                onClick={handleShareVisualSummary}
                disabled={!navigator.share}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
                title={!navigator.share ? 'Web Share API not supported in your browser' : 'Share image using native dialog'}
              >
                Share Image
              </button>
              <button
                onClick={handleDownloadVisualSummary}
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
                onClick={handleShareOriginalImage}
                disabled={!navigator.share}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
                title={!navigator.share ? 'Web Share API not supported in your browser' : 'Share image using native dialog'}
              >
                Share Image
              </button>
              <button
                onClick={handleDownloadOriginalImage}
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
  setTooltip: React.Dispatch<React.SetStateAction<{ visible: boolean; content: string; x: number; y: number }>>
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
              onMouseEnter={(e) => setTooltip({ visible: true, content: streak.description, x: e.clientX, y: e.clientY })}
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

const WindBarbOverlay = ({ direction, speed, dimensions }: { direction: string; speed: number; dimensions: { width: number, height: number } }) => {
  if (!direction || speed < 0 || dimensions.width === 0) return null;
  const speedInKnots = Math.round(speed / 1.852);

  const Barb = ({ knots, x, y, rotation }: { knots: number, x: number, y: number, rotation: number }) => {
    const staffLength = 25;
    const barbLength = 10;
    const halfBarbLength = 5;
    const barbSpacing = 4;
    const pennantHeight = barbSpacing;

    // Calm wind (circle)
    if (knots < 3) {
      return (
        <g transform={`translate(${x} ${y})`}>
          <circle r="4" strokeWidth="1.5" stroke="white" fill="none" />
        </g>
      );
    }
    
    const elements = [];
    let remainingKnots = knots;
    let currentY = -staffLength;

    const numPennants = Math.floor(remainingKnots / 50);
    remainingKnots -= numPennants * 50;
    const numFullBarbs = Math.floor(remainingKnots / 10);
    remainingKnots -= numFullBarbs * 10;
    const numHalfBarbs = remainingKnots >= 5 ? 1 : 0;
    
    // Draw from the tip of the staff inwards
    for (let i = 0; i < numPennants; i++) {
        elements.push(<polygon key={`p${i}`} points={`0,${currentY} ${-barbLength},${currentY + pennantHeight / 2} 0,${currentY + pennantHeight}`} fill="white" />);
        currentY += pennantHeight + 2;
    }

    if (numPennants > 0 && (numFullBarbs > 0 || numHalfBarbs > 0)) {
        currentY += barbSpacing / 2;
    }

    for (let i = 0; i < numFullBarbs; i++) {
        elements.push(<line key={`f${i}`} x1="0" y1={currentY} x2={-barbLength} y2={currentY - barbSpacing} />);
        currentY += barbSpacing;
    }

    if (numHalfBarbs > 0) {
        elements.push(<line key="h1" x1="0" y1={currentY} x2={-halfBarbLength} y2={currentY - barbSpacing / 2} />);
    }

    return (
      <g transform={`translate(${x} ${y}) rotate(${rotation})`}>
        <line x1="0" y1="0" x2="0" y2={-staffLength} stroke="white" strokeWidth="1.5" />
        <g stroke="white" strokeWidth="1.5">
           {elements}
        </g>
      </g>
    );
  };
  
  const gridRows = 4;
  const gridCols = 6;
  const barbs = [];
  
  for (let i = 0; i < gridRows; i++) {
    for (let j = 0; j < gridCols; j++) {
      const x = (j + 0.5) * dimensions.width / gridCols;
      const y = (i + 0.5) * dimensions.height / gridRows;
      barbs.push({ x, y });
    }
  }

  return (
    <>
      <style>{`
        @keyframes fade-in-barbs {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .wind-barb-group {
          animation: fade-in-barbs 0.5s ease-out forwards;
          filter: drop-shadow(0 0 2px rgba(0,0,0,0.7));
        }
      `}</style>
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
        <g className="wind-barb-group">
            {barbs.map((barb, index) => (
                <Barb key={index} x={barb.x} y={barb.y} knots={speedInKnots} rotation={getRotationForBarb(direction)} />
            ))}
        </g>
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


const Tooltip = ({ visible, content, x, y }: { visible: boolean; content: string; x: number; y: number }) => {
  if (!visible) return null;
  return (
    <div
      className="fixed z-50 p-2 text-sm text-gray-800 dark:text-white bg-white dark:bg-gray-900 dark:bg-opacity-80 rounded-md shadow-lg pointer-events-none transition-opacity max-w-xs border border-gray-200 dark:border-transparent"
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
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>;
      case 'storm':
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5.293l6.293-6.293a1 1 0 111.414 1.414L13.414 8.5H19a1 1 0 110 2h-5.586l6.293 6.293a1 1 0 11-1.414 1.414L12 11.414V17a1 1 0 11-2 0v-5.586L3.707 17.707a1 1 0 11-1.414-1.414L8.586 10H3a1 1 0 110-2h5.586L2.293 1.707A1 1 0 113.707.293L10 6.586V2a1 1 0 011.3-.954z" clipRule="evenodd" /></svg>;
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
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [visualSummary, setVisualSummary] = useState<{base64: string, mimeType: string} | null>(null);
  const [composedOverlayImage, setComposedOverlayImage] = useState<{base64: string, mimeType: string} | null>(null);
  const [isGeneratingVisual, setIsGeneratingVisual] = useState<boolean>(false);
  const [isGeneratingOverlay, setIsGeneratingOverlay] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'original' | 'overlay' | 'ai'>('original');
  const [forecastHour, setForecastHour] = useState<number>(0);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showWind, setShowWind] = useState<boolean>(false);
  const [showIsobars, setShowIsobars] = useState<boolean>(false);
  const [tooltip, setTooltip] = useState<{ visible: boolean; content: string; x: number; y: number }>({ visible: false, content: '', x: 0, y: 0 });

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

  const generateComposedImageBase64 = useCallback(async (options: {
      showHeatmap: boolean,
      showWind: boolean,
      showIsobars: boolean,
  }): Promise<string> => {
    if (!selectedImage || !analysis || !imageContainerRef.current) {
        throw new Error("Missing required data for image composition.");
    }

    const { showHeatmap, showWind, showIsobars } = options;
    const { width, height } = imageDimensions;
    const originalImg = new Image();

    return new Promise<string>((resolve, reject) => {
        originalImg.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }

            // 1. Draw original image
            ctx.drawImage(originalImg, 0, 0, width, height);

            // 2. Draw heatmap
            if (showHeatmap && analysis.temperature) {
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = getTemperatureColor(analysis.temperature);
                ctx.fillRect(0, 0, width, height);
                ctx.globalAlpha = 1.0;
            }

            // 3. Draw storm track, anomalies, surge
            if (includeStormTrack && analysis.stormTrack && analysis.stormTrack.length > 0) {
                ctx.beginPath();
                const firstPoint = analysis.stormTrack[0];
                ctx.moveTo(firstPoint.x / 100 * width, firstPoint.y / 100 * height);
                analysis.stormTrack.forEach(point => {
                    ctx.lineTo(point.x / 100 * width, point.y / 100 * height);
                });
                ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.setLineDash([]);

                analysis.stormTrack.forEach(point => {
                    ctx.beginPath();
                    ctx.arc(point.x / 100 * width, point.y / 100 * height, 6, 0, 2 * Math.PI);
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
                    const firstPoint = streak.points[0];
                    ctx.moveTo(firstPoint.x / 100 * width, firstPoint.y / 100 * height);
                    for (let i = 1; i < streak.points.length; i++) {
                        const point = streak.points[i];
                        ctx.lineTo(point.x / 100 * width, point.y / 100 * height);
                    }
                    ctx.closePath();
                    ctx.fillStyle = "rgba(250, 204, 21, 0.25)";
                    ctx.strokeStyle = "#facc15";
                    ctx.lineWidth = 2;
                    ctx.fill();
                    ctx.stroke();
                    
                    if (streak.points.length > 0) {
                        const centroid = streak.points.reduce((acc, p) => ({
                            x: acc.x + p.x / 100 * width,
                            y: acc.y + p.y / 100 * height
                        }), { x: 0, y: 0 });
                        centroid.x /= streak.points.length;
                        centroid.y /= streak.points.length;

                        ctx.font = 'bold 14px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 3;
                        ctx.strokeText(streak.description, centroid.x, centroid.y);
                        ctx.fillStyle = 'white';
                        ctx.fillText(streak.description, centroid.x, centroid.y);
                    }
                });
            }

            if (includeStormSurge && analysis.stormSurge && analysis.stormSurge.affectedArea.length > 0) {
                const surgeArea = analysis.stormSurge.affectedArea;
                ctx.beginPath();
                ctx.moveTo(surgeArea[0].x / 100 * width, surgeArea[0].y / 100 * height);
                for (let i = 1; i < surgeArea.length; i++) {
                    ctx.lineTo(surgeArea[i].x / 100 * width, surgeArea[i].y / 100 * height);
                }
                ctx.closePath();
                ctx.fillStyle = "rgba(220, 38, 38, 0.4)";
                ctx.strokeStyle = "rgba(255, 100, 100, 0.8)";
                ctx.lineWidth = 1.5;
                ctx.fill();
                ctx.stroke();

                const centroid = surgeArea.reduce((acc, p) => ({
                    x: acc.x + p.x / 100 * width,
                    y: acc.y + p.y / 100 * height
                }), { x: 0, y: 0 });
                centroid.x /= surgeArea.length;
                centroid.y /= surgeArea.length;

                ctx.font = 'bold 16px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 3;
                ctx.strokeText(`${analysis.stormSurge!.surgeHeight}m Surge`, centroid.x, centroid.y);
                ctx.fillStyle = 'white';
                ctx.fillText(`${analysis.stormSurge!.surgeHeight}m Surge`, centroid.x, centroid.y);
            }

            // 4. Draw Isobars
            if (showIsobars && analysis.isobars && analysis.isobars.length > 0) {
                analysis.isobars.forEach(isobar => {
                    const scaledPath = scaleSvgPathForCanvas(isobar.path, width, height);
                    ctx.strokeStyle = "rgba(230, 230, 230, 0.9)";
                    ctx.lineWidth = 1.5;
                    ctx.stroke(new Path2D(scaledPath));
                    
                    const labelX = (isobar.labelPosition.x / 100) * width;
                    const labelY = (isobar.labelPosition.y / 100) * height;
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                    ctx.lineWidth = 2;
                    ctx.strokeText(isobar.pressure.toString(), labelX, labelY);
                    ctx.fillStyle = 'white';
                    ctx.fillText(isobar.pressure.toString(), labelX, labelY);
                });
            }

            // 5. Draw Wind Barbs
            if (showWind && analysis.windDirection && typeof analysis.windSpeed !== 'undefined') {
                const gridRows = 4;
                const gridCols = 6;
                for (let i = 0; i < gridRows; i++) {
                    for (let j = 0; j < gridCols; j++) {
                        const x = (j + 0.5) * width / gridCols;
                        const y = (i + 0.5) * height / gridRows;
                        drawWindBarbOnCanvas(ctx, x, y, analysis.windSpeed, analysis.windDirection);
                    }
                }
            }

            const pngDataUrl = canvas.toDataURL('image/png');
            resolve(pngDataUrl.split(',')[1]);
        };

        originalImg.onerror = () => {
            reject(new Error("Failed to load original image for composition."));
        };

        originalImg.src = `data:${selectedImage.mimeType};base64,${selectedImage.base64}`;
    });
  }, [selectedImage, analysis, imageDimensions, includeStormTrack, includeAnomalies, includeStormSurge]);

  const handleGenerateOverlayImage = useCallback(async () => {
      setIsGeneratingOverlay(true);
      setError(null);
      try {
          const composedBase64 = await generateComposedImageBase64({
            showHeatmap,
            showWind,
            showIsobars,
          });
          setComposedOverlayImage({ base64: composedBase64, mimeType: 'image/png' });
          setViewMode('overlay');
      } catch (err: any) {
          setError(err.message || 'Failed to generate overlay image.');
      } finally {
          setIsGeneratingOverlay(false);
      }
  }, [generateComposedImageBase64, showHeatmap, showWind, showIsobars]);

  const handleGenerateAISummary = useCallback(async () => {
    if (!analysis) return;
    setIsGeneratingVisual(true);
    setError(null);
    try {
        const composedBase64 = await generateComposedImageBase64({
            showHeatmap,
            showWind,
            showIsobars,
        });
        const generatedImageBase64 = await generateVisualSummaryImage(composedBase64, 'image/png', analysis);
        setVisualSummary({ base64: generatedImageBase64, mimeType: 'image/png' });
        setViewMode('ai');
    } catch (err: any) {
        setError(err.message || 'Failed to generate AI summary.');
    } finally {
        setIsGeneratingVisual(false);
    }
  }, [analysis, generateComposedImageBase64, showHeatmap, showWind, showIsobars]);

  const triggerFileSelect = () => fileInputRef.current?.click();
  const hasStormTrack = analysis?.stormTrack && analysis.stormTrack.length > 0;
  const hasAnomalies = analysis?.anomalyStreaks && analysis.anomalyStreaks.length > 0;
  const hasStormSurge = analysis?.stormSurge && analysis.stormSurge.affectedArea.length > 0;
  const hasIsobars = analysis?.isobars && analysis.isobars.length > 0;
  const hasOverlays = hasStormTrack || hasAnomalies || hasStormSurge;

  const getDisplayImage = () => {
    if (!selectedImage) return null;
    switch (viewMode) {
      case 'ai':
        if (visualSummary) return { src: `data:${visualSummary.mimeType};base64,${visualSummary.base64}`, name: 'AI-Generated Visual Summary' };
        break;
      case 'overlay':
        if (composedOverlayImage) return { src: `data:${composedOverlayImage.mimeType};base64,${composedOverlayImage.base64}`, name: 'Image with Overlays' };
        break;
    }
    return { src: `data:${selectedImage.mimeType};base64,${selectedImage.base64}`, name: selectedImage.file.name };
  };
  const displayImage = getDisplayImage();

  const getViewModeButtonClass = (mode: typeof viewMode) => {
    return viewMode === mode
      ? 'bg-cyan-500 text-white'
      : 'bg-transparent text-gray-700 hover:bg-gray-300 dark:text-gray-300 dark:hover:bg-gray-600';
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
                        className={`w-full h-full object-cover transition-all duration-700 ease-out ${isHiResImageLoaded ? 'blur-0 scale-100' : 'blur-xl scale-105'}`}
                        onLoad={() => setIsHiResImageLoaded(true)}
                    />
                   )}
                  {viewMode === 'original' && hasStormTrack && includeStormTrack && <StormTrackDisplay track={analysis.stormTrack!} dimensions={imageDimensions} forecastHour={forecastHour} />}
                  {viewMode === 'original' && hasAnomalies && includeAnomalies && <AnomalyStreaksDisplay streaks={analysis.anomalyStreaks!} dimensions={imageDimensions} setTooltip={setTooltip} />}
                  {viewMode === 'original' && hasStormSurge && includeStormSurge && <StormSurgeDisplay surge={analysis.stormSurge!} dimensions={imageDimensions} />}
                  {viewMode === 'original' && showHeatmap && analysis && (
                    <TemperatureHeatmapDisplay temperature={analysis.temperature} />
                  )}
                  {viewMode === 'original' && showWind && analysis && (
                    <WindBarbOverlay direction={analysis.windDirection} speed={analysis.windSpeed} dimensions={imageDimensions} />
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
                
                {(composedOverlayImage || visualSummary) && (
                  <div className="mt-4 flex justify-center bg-gray-200/50 dark:bg-gray-900/50 p-1 rounded-lg">
                      <div className="flex space-x-1 rounded-md bg-gray-300 dark:bg-gray-700 p-1" role="group">
                          <button onClick={() => setViewMode('original')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${getViewModeButtonClass('original')}`}>Original</button>
                          {composedOverlayImage && <button onClick={() => setViewMode('overlay')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${getViewModeButtonClass('overlay')}`}>Overlay</button>}
                          {visualSummary && <button onClick={() => setViewMode('ai')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${getViewModeButtonClass('ai')}`}>AI Enhanced</button>}
                      </div>
                  </div>
                )}

                {analysis && hasOverlays && (
                  <div className="mt-4 p-3 bg-gray-200/50 dark:bg-gray-900/50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Analysis Layers:</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
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
                    </div>
                  </div>
                )}

                {analysis && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 mt-4">
                        <button
                            onClick={handleGenerateOverlayImage}
                            disabled={isLoading || isGeneratingOverlay || isGeneratingVisual || !hasOverlays}
                            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                            title={!hasOverlays ? "No analysis data to generate an overlay from" : "Generate a static image with analysis overlays"}
                        >
                            {isGeneratingOverlay ? 'Generating...' : 'Generate Overlay Image'}
                        </button>
                        <button
                            onClick={handleGenerateAISummary}
                            disabled={isLoading || isGeneratingVisual || isGeneratingOverlay || !hasOverlays}
                            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                            title={!hasOverlays ? "No analysis data to generate a summary from" : "Use AI to generate an enhanced visual summary"}
                        >
                            {isGeneratingVisual ? 'Generating...' : 'Generate AI Summary'}
                        </button>
                        <button
                          onClick={() => setShowHeatmap(!showHeatmap)}
                          className={`w-full inline-flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm transition-colors ${showHeatmap ? 'bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 border-transparent text-white ring-2 ring-orange-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-800' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-300'}`}
                        >
                          {showHeatmap ? 'Hide' : 'Show'} Heatmap
                        </button>
                         <button
                          onClick={() => setShowWind(!showWind)}
                          className={`w-full inline-flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm transition-colors ${showWind ? 'bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 border-transparent text-white ring-2 ring-sky-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-800' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-300'}`}
                        >
                          {showWind ? 'Hide' : 'Show'} Wind Barbs
                        </button>
                         <button
                          onClick={() => setShowIsobars(!showIsobars)}
                          disabled={!hasIsobars}
                          className={`w-full col-span-2 inline-flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed ${showIsobars ? 'bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700 border-transparent text-white ring-2 ring-indigo-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-800' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-300'}`}
                        >
                          {showIsobars ? 'Hide' : 'Show'} Isobars
                        </button>
                    </div>
                )}
                
                <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-4">{displayImage?.name || ''}</p>

                {hasStormTrack && (
                  <div className="mt-4 text-xs text-left bg-gray-200/50 dark:bg-gray-900/50 p-3 rounded-md">
                    <p className="font-bold text-gray-800 dark:text-gray-200 mb-2">Storm Track Legend:</p>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: getIntensityColor('5')}}></div><span className="text-gray-600 dark:text-gray-400">Cat 3-5</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: getIntensityColor('1')}}></div><span className="text-gray-600 dark:text-gray-400">Cat 1-2</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: getIntensityColor('ts')}}></div><span className="text-gray-600 dark:text-gray-400">Tropical Storm</span></div>
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
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 flex-grow min-h-[200px] flex flex-col">
              
               {(analysis || isFetchingLiveWeather) && (
                  <LiveWeatherDisplay data={liveWeatherData} isLoading={isFetchingLiveWeather} error={liveWeatherError} />
                )}

              <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                 <div className="flex items-center gap-3">
                   <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Meteorological Analysis</h2>
                   {analysis && !isLoading && (<button onClick={() => setIsShareModalOpen(true)} title="Share Analysis" className="text-gray-500 hover:text-cyan-500 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg></button>)}
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
        selectedImage={selectedImage}
        theme={theme}
      />
       <MapModal 
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        analysis={analysis}
      />
    </div>
  );
}