import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ImageFile } from './types';
import { explainWeatherFromImage, WeatherAnalysis, StormTrackPoint, AnomalyStreak, generateVisualSummaryImage, StormSurgeForecast } from './services/geminiService';
import { HISTORICAL_IMAGE_BASE64, HISTORICAL_IMAGE_MIMETYPE } from './historicalImage';

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

const ShareModal = ({ 
  isOpen, 
  onClose, 
  analysisData, 
  visualSummaryImage, 
  originalImageFile 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  analysisData: WeatherAnalysis | null, 
  visualSummaryImage: { base64: string, mimeType: string } | null,
  originalImageFile: File | null,
}) => {
  const [copyButtonText, setCopyButtonText] = useState('Copy');
  
  useEffect(() => {
    if (isOpen) {
      setCopyButtonText('Copy');
    }
  }, [isOpen]);

  if (!isOpen || !analysisData) return null;

  const { location, temperature, windDirection, windSpeed, explanation, chanceOfPrecipitation, humidity, uvIndex } = analysisData;
  const hasVisualSummary = visualSummaryImage && originalImageFile;

  const summary = `Weather for ${location}: Temp: ${Math.round(temperature)}°C, Wind: ${Math.round(windSpeed)} km/h ${windDirection}, Precip: ${chanceOfPrecipitation}%, Humidity: ${humidity}%, UV: ${uvIndex}. Analysis: ${explanation.substring(0, 100)}...`;
  const encodedSummary = encodeURIComponent(summary);
  const shareLink = `https://www.google.com/search?q=${encodedSummary}`;
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopyButtonText('Copied!');
      setTimeout(() => setCopyButtonText('Copy'), 2000);
    }).catch(err => {
      console.error('Failed to copy link: ', err);
    });
  };

  const handleDownloadImage = () => {
    if (!visualSummaryImage) return;
    const link = document.createElement('a');
    link.href = `data:${visualSummaryImage.mimeType};base64,${visualSummaryImage.base64}`;
    const newFilename = `visual_summary_${originalImageFile?.name.split('.')[0] || 'weather'}.png`;
    link.download = newFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleShareImage = async () => {
    if (!visualSummaryImage || !originalImageFile || !navigator.share) return;
    
    const newFilename = `visual_summary_${originalImageFile.name.split('.')[0]}.png`;
    const fileToShare = base64ToFile(visualSummaryImage.base64, newFilename, visualSummaryImage.mimeType);

    try {
      await navigator.share({
        files: [fileToShare],
        title: `Weather Analysis for ${location}`,
        text: summary,
      });
    } catch (error) {
      console.error('Error sharing the image:', error);
    }
  };


  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm relative transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
          aria-label="Close share dialog"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h3 id="share-modal-title" className="text-2xl font-bold text-cyan-400 mb-4 text-center">
          {hasVisualSummary ? 'Share Visual Summary' : 'Share Analysis'}
        </h3>
        {hasVisualSummary ? (
          <div className="space-y-4 text-center">
            <img 
              src={`data:${visualSummaryImage.mimeType};base64,${visualSummaryImage.base64}`} 
              alt="AI-generated visual summary" 
              className="rounded-lg border-2 border-gray-600 max-h-64 w-auto mx-auto"
            />
            <p className="text-sm text-gray-400">Share this AI-enhanced image with your analysis baked in.</p>
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleShareImage}
                disabled={!navigator.share}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
                title={!navigator.share ? 'Web Share API not supported in your browser' : 'Share image using native dialog'}
              >
                Share Image
              </button>
              <button
                onClick={handleDownloadImage}
                className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors duration-200 bg-gray-600 hover:bg-gray-700 text-white"
              >
                Download Image
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center bg-gray-700 p-4 rounded-lg">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodedSummary}&bgcolor=374151&color=e5e7eb&qzone=1`} alt="QR Code for weather analysis" className="rounded-md" />
              <p className="mt-3 text-sm text-gray-300">Scan QR code to share</p>
            </div>
            <div>
              <label htmlFor="share-link" className="block text-sm font-medium text-gray-300 mb-2 text-center">Or Copy Link</label>
              <div className="flex gap-2">
                <input
                  id="share-link"
                  type="text"
                  readOnly
                  value={shareLink}
                  className="w-full bg-gray-600 text-gray-200 border border-gray-500 rounded-md px-3 py-1.5 text-sm focus:ring-cyan-500 focus:border-cyan-500"
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
            <hr className="border-gray-600" />
            <div className="flex justify-center items-center gap-6">
              <a href={`mailto:?subject=Weather Analysis for ${location}&body=${encodedSummary}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" title="Share via Email">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
              </a>
              <a href={`https://twitter.com/intent/tweet?text=${encodedSummary}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" title="Share on Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
            </div>
          </div>
        )}
      </div>
       <style>{`
        @keyframes fade-in-scale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-scale { animation: fade-in-scale 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
};

const LocationDisplay = ({ location }: { location: string }) => (
  <div className="flex items-center gap-2" title={`Location: ${location}`}>
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
    <span className="text-lg font-semibold text-gray-200">{location}</span>
  </div>
);

const TemperatureDisplay = ({ temp }: { temp: number }) => (
  <div className="flex items-center gap-2" title={`Estimated Temperature: ${temp}°C`}>
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V4a4 4 0 10-8 0v12a6 6 0 108 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-4" />
    </svg>
    <span className="text-lg font-semibold text-gray-200">{Math.round(temp)}°C</span>
  </div>
);

const WindSpeedDisplay = ({ speed }: { speed: number }) => (
  <div className="flex items-center gap-2" title={`Estimated Wind Speed: ${Math.round(speed)} km/h`}>
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
    <span className="text-lg font-semibold text-gray-200">{Math.round(speed)} km/h</span>
  </div>
);

const PrecipitationDisplay = ({ chance }: { chance: number }) => (
  <div className="flex items-center gap-2" title={`Chance of Precipitation: ${chance}%`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-300" fill="currentColor" stroke="none" viewBox="0 0 24 24">
          <path d="M17.502 19.001H6.5c-2.208 0-4-1.792-4-4s1.792-4 4-4h.198c.414-3.402 3.286-6 6.802-6 3.805 0 6.998 2.903 6.998 6.5v.5c1.381 0 2.5 1.119 2.5 2.5s-1.119 2.5-2.5 2.5z" />
          <circle className="precip-drop1" cx="8" cy="18" r="1.5" />
          <circle className="precip-drop2" cx="12" cy="18" r="1.5" />
          <circle className="precip-drop3" cx="16" cy="18" r="1.5" />
      </svg>
      <span className="text-lg font-semibold text-gray-200">{chance}%</span>
  </div>
);


const HumidityDisplay = ({ humidity }: { humidity: number }) => (
  <div className="flex items-center gap-2" title={`Humidity: ${humidity}%`}>
     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
       <path strokeLinecap="round" strokeLinejoin="round" d="M6.375 8.25a5.625 5.625 0 1111.25 0c0 3.108-2.517 5.625-5.625 5.625S6.375 11.358 6.375 8.25z" />
       <path strokeLinecap="round" strokeLinejoin="round" d="M12 13.875V19.5" />
       <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 19.5h7.5" />
     </svg>
    <span className="text-lg font-semibold text-gray-200">{humidity}%</span>
  </div>
);

const UvIndexDisplay = ({ index }: { index: number }) => (
  <div className="flex items-center gap-2" title={`UV Index: ${index}`}>
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
    <span className="text-lg font-semibold text-gray-200">{index}</span>
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
      <span className="text-sm font-medium text-gray-400">{direction.toUpperCase()}</span>
      <div className={`w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center transform transition-transform duration-700 ease-in-out ${rotation}`}>
        <div className="animate-spin-slow w-5 h-5 flex items-center justify-center">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l-7-7 7-7 7 7-7 7z" transform="rotate(-45 12 12)" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v10" />
          </svg>
        </div>
      </div>
    </div>
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

const AnomalyStreaksDisplay = ({ streaks, dimensions }: { streaks: AnomalyStreak[], dimensions: { width: number, height: number } }) => {
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
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
        {streaks.map((streak, index) => {
          const pointsStr = streak.points.map(p => `${p.x / 100 * dimensions.width},${p.y / 100 * dimensions.height}`).join(' ');
          return (
            <polygon
              key={index}
              points={pointsStr}
              className="anomaly-streak"
              fill="rgba(250, 204, 21, 0.25)"
              stroke="#facc15"
              strokeWidth="2"
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

export default function App() {
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [analysis, setAnalysis] = useState<WeatherAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isHiResImageLoaded, setIsHiResImageLoaded] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [visualSummary, setVisualSummary] = useState<{base64: string, mimeType: string} | null>(null);
  const [isGeneratingVisual, setIsGeneratingVisual] = useState<boolean>(false);
  const [showOriginal, setShowOriginal] = useState<boolean>(true);
  const [forecastHour, setForecastHour] = useState<number>(0);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

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
    setShowOriginal(true);
    setForecastHour(0);
  }, []);

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find(item => item.kind === 'file' && item.type.startsWith('image/'));

    if (imageItem) {
        event.preventDefault();
        const imageFile = imageItem.getAsFile();
        if (imageFile) {
            setIsHiResImageLoaded(false);
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                setSelectedImage({ file: imageFile, base64: base64String, mimeType: imageFile.type });
                resetAnalysis();
            };
            reader.readAsDataURL(imageFile);
        }
    }
  }, [resetAnalysis]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => { document.removeEventListener('paste', handlePaste); };
  }, [handlePaste]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsHiResImageLoaded(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setSelectedImage({ file: file, base64: base64String, mimeType: file.type });
        resetAnalysis();
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
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedImage, resetAnalysis]);

  const handleUseSample = () => {
    setIsHiResImageLoaded(false);
    setSelectedImage({
      file: new File([], "hurricane-ian.jpg", { type: HISTORICAL_IMAGE_MIMETYPE }),
      base64: HISTORICAL_IMAGE_BASE64, mimeType: HISTORICAL_IMAGE_MIMETYPE,
    });
    resetAnalysis();
  };

  const handleGenerateVisualSummary = useCallback(async () => {
    if (!selectedImage || !analysis || !imageContainerRef.current) return;

    setIsGeneratingVisual(true);
    setError(null);

    try {
        const { width, height } = imageDimensions;

        let overlaysSVG = '';
        if (analysis.stormTrack && analysis.stormTrack.length > 0) {
            const points = analysis.stormTrack.map(p => `${p.x / 100 * width},${p.y / 100 * height}`).join(' ');
            overlaysSVG += `<polyline points="${points}" fill="none" stroke="rgba(255, 255, 255, 0.7)" stroke-width="2" stroke-dasharray="5,5" />`;
            analysis.stormTrack.forEach(point => {
                overlaysSVG += `<circle cx="${point.x / 100 * width}" cy="${point.y / 100 * height}" r="6" fill="${getIntensityColor(point.intensity)}" stroke="rgba(0, 0, 0, 0.5)" stroke-width="1" />`;
            });
        }
        if (analysis.anomalyStreaks && analysis.anomalyStreaks.length > 0) {
             analysis.anomalyStreaks.forEach(streak => {
                const pointsStr = streak.points.map(p => `${p.x / 100 * width},${p.y / 100 * height}`).join(' ');
                overlaysSVG += `<polygon points="${pointsStr}" fill="rgba(250, 204, 21, 0.25)" stroke="#facc15" stroke-width="2" />`;
            });
        }

        if (analysis.stormSurge && analysis.stormSurge.affectedArea.length > 0) {
            const surgePoints = analysis.stormSurge.affectedArea.map(p => `${p.x / 100 * width},${p.y / 100 * height}`).join(' ');
            overlaysSVG += `<polygon points="${surgePoints}" fill="rgba(220, 38, 38, 0.4)" stroke="rgba(255, 100, 100, 0.8)" stroke-width="1.5" />`;

            const centroid = analysis.stormSurge.affectedArea.reduce((acc, p) => ({
                x: acc.x + p.x / 100 * width,
                y: acc.y + p.y / 100 * height
            }), { x: 0, y: 0 });
            centroid.x /= analysis.stormSurge.affectedArea.length;
            centroid.y /= analysis.stormSurge.affectedArea.length;

            overlaysSVG += `<text x="${centroid.x}" y="${centroid.y}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="sans-serif" font-size="16" font-weight="bold" style="paint-order: stroke; stroke: black; stroke-width: 2px; stroke-linejoin: round;">${analysis.stormSurge.surgeHeight}m Surge</text>`;
        }


        const fullSVG = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <image href="${`data:${selectedImage.mimeType};base64,${selectedImage.base64}`}" x="0" y="0" width="${width}" height="${height}" />
                ${overlaysSVG}
            </svg>
        `;

        const svgBlob = new Blob([fullSVG], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const img = new Image();

        const getPngDataUrl = () => new Promise<string>((resolve, reject) => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(svgUrl);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => {
                URL.revokeObjectURL(svgUrl);
                reject(new Error("Failed to load composite SVG image for conversion."));
            };
            img.src = svgUrl;
        });

        const pngDataUrl = await getPngDataUrl();
        const pngBase64 = pngDataUrl.split(',')[1];
        
        const generatedImageBase64 = await generateVisualSummaryImage(pngBase64, 'image/png', analysis);
        
        setVisualSummary({ base64: generatedImageBase64, mimeType: 'image/png' });
        setShowOriginal(false);

    } catch (err: any) {
        setError(err.message || 'Failed to generate visual summary.');
    } finally {
        setIsGeneratingVisual(false);
    }
}, [selectedImage, analysis, imageDimensions]);

  const triggerFileSelect = () => fileInputRef.current?.click();
  const hasStormTrack = analysis?.stormTrack && analysis.stormTrack.length > 0;
  const hasAnomalies = analysis?.anomalyStreaks && analysis.anomalyStreaks.length > 0;
  const hasStormSurge = analysis?.stormSurge && analysis.stormSurge.affectedArea.length > 0;
  const hasOverlays = hasStormTrack || hasAnomalies || hasStormSurge;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8">
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
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400 mb-2">AI Weather Explainer</h1>
          <p className="text-lg text-gray-400">Upload a satellite image for an expert meteorological analysis and storm tracking.</p>
        </header>

        <main className="bg-gray-800 rounded-xl shadow-2xl p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col items-center justify-center bg-gray-700 p-6 rounded-lg border-2 border-dashed border-gray-600 min-h-[300px]">
            {selectedImage ? (
              <div className="text-center w-full">
                <div ref={imageContainerRef} className="relative w-full aspect-video bg-gray-800/50 rounded-lg overflow-hidden mb-4 flex items-center justify-center">
                  <img
                    key={showOriginal || !visualSummary ? selectedImage.base64 : visualSummary.base64}
                    src={showOriginal || !visualSummary ? `data:${selectedImage.mimeType};base64,${selectedImage.base64}` : `data:${visualSummary.mimeType};base64,${visualSummary.base64}`}
                    alt="Weather satellite analysis"
                    className={`w-full h-full object-cover transition-all duration-700 ease-out ${isHiResImageLoaded ? 'blur-0 scale-100' : 'blur-xl scale-105'}`}
                    onLoad={() => setIsHiResImageLoaded(true)}
                  />
                  {showOriginal && hasStormTrack && <StormTrackDisplay track={analysis.stormTrack!} dimensions={imageDimensions} forecastHour={forecastHour} />}
                  {showOriginal && hasAnomalies && <AnomalyStreaksDisplay streaks={analysis.anomalyStreaks!} dimensions={imageDimensions} />}
                  {showOriginal && hasStormSurge && <StormSurgeDisplay surge={analysis.stormSurge!} dimensions={imageDimensions} />}
                </div>

                {hasStormTrack && showOriginal && (
                  <div className="mt-4 p-4 bg-gray-900/50 rounded-lg">
                    <label htmlFor="time-slider" className="block text-sm font-medium text-gray-300 mb-2">
                      Forecast Time: <span className="font-bold text-cyan-400">+{forecastHour} Hours</span>
                    </label>
                    <input
                      id="time-slider"
                      type="range"
                      min="0"
                      max="48"
                      step="1"
                      value={forecastHour}
                      onChange={(e) => setForecastHour(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}

                {analysis && (
                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                        <button
                            onClick={handleGenerateVisualSummary}
                            disabled={isLoading || isGeneratingVisual || !hasOverlays}
                            className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                            title={!hasOverlays ? "No overlays to generate a summary from" : "Use AI to generate an enhanced visual"}
                        >
                            {isGeneratingVisual ? 'Generating...' : 'Generate Visual Summary'}
                        </button>
                        {visualSummary && (
                            <button
                                onClick={() => setShowOriginal(!showOriginal)}
                                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600"
                            >
                                {showOriginal ? 'Show Visual Summary' : 'Show Original'}
                            </button>
                        )}
                    </div>
                )}
                
                <p className="text-sm text-gray-300 truncate mt-4">{showOriginal ? selectedImage.file.name : 'AI-Generated Visual Summary'}</p>

                {hasStormTrack && (
                  <div className="mt-4 text-xs text-left bg-gray-900/50 p-3 rounded-md">
                    <p className="font-bold text-gray-200 mb-2">Storm Track Legend:</p>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: getIntensityColor('5')}}></div><span className="text-gray-400">Cat 3-5</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: getIntensityColor('1')}}></div><span className="text-gray-400">Cat 1-2</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: getIntensityColor('ts')}}></div><span className="text-gray-400">Tropical Storm</span></div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                <h3 className="mt-2 text-sm font-medium text-gray-300">No image selected</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by uploading an image, using our sample, or pasting a screenshot.</p>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
              <button onClick={triggerFileSelect} className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500">Upload Image</button>
              <button onClick={handleUseSample} className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500">Use Sample</button>
            </div>
          </div>

          <div className="flex flex-col">
            <button onClick={handleAnalyzeClick} disabled={!selectedImage || isLoading} className="w-full mb-4 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed">
              {isLoading ? 'Analyzing...' : 'Analyze Weather'}
            </button>
            <div className="bg-gray-700/50 rounded-lg p-6 flex-grow min-h-[200px] flex flex-col">
              <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                 <div className="flex items-center gap-3">
                   <h2 className="text-xl font-semibold text-gray-200">Meteorological Analysis</h2>
                   {analysis && !isLoading && (<button onClick={() => setIsShareModalOpen(true)} title="Share Analysis" className="text-gray-400 hover:text-cyan-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg></button>)}
                 </div>
                 <div className="flex items-center gap-x-4 gap-y-2 flex-wrap justify-end">
                  {analysis && !isLoading && (<>
                      <LocationDisplay location={analysis.location} />
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
                {isLoading && (<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-400"></div></div>)}
                {error && <div className="text-red-400 bg-red-900/50 p-3 rounded-md">{error}</div>}
                {analysis && (<div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap">{analysis.explanation}</div>)}
                {!isLoading && !analysis && !error && (<p className="text-gray-400">Your weather analysis will appear here.</p>)}
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
        originalImageFile={selectedImage?.file || null}
      />
    </div>
  );
}
