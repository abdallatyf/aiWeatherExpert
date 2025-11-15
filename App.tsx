import React, { useState, useCallback, useRef } from 'react';
import { ImageFile } from './types';
import { explainWeatherFromImage, WeatherAnalysis } from './services/geminiService';
import { HISTORICAL_IMAGE_BASE64, HISTORICAL_IMAGE_MIMETYPE } from './historicalImage';

const ShareModal = ({ isOpen, onClose, analysisData }: { isOpen: boolean, onClose: () => void, analysisData: WeatherAnalysis | null }) => {
  if (!isOpen || !analysisData) return null;

  const { location, temperature, windDirection, windSpeed, explanation } = analysisData;

  const summary = `Weather for ${location}: Temp: ${Math.round(temperature)}°C, Wind: ${Math.round(windSpeed)} km/h ${windDirection}. Analysis: ${explanation.substring(0, 100)}...`;
  const encodedSummary = encodeURIComponent(summary);

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodedSummary}&bgcolor=374151&color=e5e7eb&qzone=1`;
  const emailLink = `mailto:?subject=Weather Analysis for ${location}&body=${encodedSummary}`;
  const twitterLink = `https://twitter.com/intent/tweet?text=${encodedSummary}`;

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
        <h3 id="share-modal-title" className="text-2xl font-bold text-cyan-400 mb-4 text-center">Share Analysis</h3>
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center bg-gray-700 p-4 rounded-lg">
            <img src={qrCodeUrl} alt="QR Code for weather analysis" className="rounded-md" />
            <p className="mt-3 text-sm text-gray-300">Scan QR code to share</p>
          </div>
          <div className="flex justify-center items-center gap-6">
            <a href={emailLink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" title="Share via Email">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </a>
            <a href={twitterLink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" title="Share on Twitter">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
          <p className="text-xs text-gray-500 text-center px-2">
            Sharing includes a summary for: {location}, {Math.round(temperature)}°C, {Math.round(windSpeed)} km/h.
          </p>
        </div>
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
    <span className="text-xl font-semibold text-gray-200">{location}</span>
  </div>
);


const TemperatureDisplay = ({ temp }: { temp: number }) => (
  <div className="flex items-center gap-2" title={`Estimated Temperature: ${temp}°C`}>
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V4a4 4 0 10-8 0v12a6 6 0 108 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-4" />
    </svg>
    <span className="text-xl font-semibold text-gray-200">{Math.round(temp)}°C</span>
  </div>
);

const WindSpeedDisplay = ({ speed }: { speed: number }) => (
  <div className="flex items-center gap-2" title={`Estimated Wind Speed: ${Math.round(speed)} km/h`}>
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
    <span className="text-xl font-semibold text-gray-200">{Math.round(speed)} km/h</span>
  </div>
);


const WindDirectionArrow = ({ direction }: { direction: string }) => {
  const rotationClasses: { [key: string]: string } = {
    'N': 'rotate-0',
    'NE': 'rotate-45',
    'E': 'rotate-90',
    'SE': 'rotate-135',
    'S': 'rotate-180',
    'SW': '-rotate-135',
    'W': '-rotate-90',
    'NW': '-rotate-45',
  };
  // Handle intermediate directions like NNE by mapping to nearest 8-point direction
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
        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l-7-7 7-7 7 7-7 7z" transform="rotate(-45 12 12)" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v10" />
        </svg>
      </div>
    </div>
  );
};


export default function App() {
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [windDirection, setWindDirection] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [windSpeed, setWindSpeed] = useState<number | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isHiResImageLoaded, setIsHiResImageLoaded] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAnalysis = () => {
    setExplanation('');
    setWindDirection(null);
    setTemperature(null);
    setWindSpeed(null);
    setLocation(null);
    setError(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsHiResImageLoaded(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setSelectedImage({
          file: file,
          base64: base64String,
          mimeType: file.type,
        });
        resetAnalysis();
      };
      reader.onerror = () => {
        setError('Failed to read the file.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeClick = useCallback(async () => {
    if (!selectedImage) {
      setError('Please select an image first.');
      return;
    }
    setIsLoading(true);
    resetAnalysis();
    try {
      const result = await explainWeatherFromImage(selectedImage.mimeType, selectedImage.base64);
      setExplanation(result.explanation);
      setWindDirection(result.windDirection);
      setTemperature(result.temperature);
      setWindSpeed(result.windSpeed);
      setLocation(result.location);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedImage]);

  const handleUseSample = () => {
    setIsHiResImageLoaded(false);
    setSelectedImage({
      file: new File([], "hurricane-ian.jpg", { type: HISTORICAL_IMAGE_MIMETYPE }),
      base64: HISTORICAL_IMAGE_BASE64,
      mimeType: HISTORICAL_IMAGE_MIMETYPE,
    });
    resetAnalysis();
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  const analysisData: WeatherAnalysis | null = explanation && windDirection && temperature !== null && windSpeed !== null && location
    ? { explanation, windDirection, temperature, windSpeed, location }
    : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400 mb-2">AI Weather Explainer</h1>
          <p className="text-lg text-gray-400">Upload a satellite image and get an expert meteorological analysis.</p>
        </header>

        <main className="bg-gray-800 rounded-xl shadow-2xl p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Image Upload and Display */}
          <div className="flex flex-col items-center justify-center bg-gray-700 p-6 rounded-lg border-2 border-dashed border-gray-600 min-h-[300px]">
            {selectedImage ? (
              <div className="text-center w-full">
                <div className="w-full aspect-video bg-gray-800/50 rounded-lg overflow-hidden mb-4 flex items-center justify-center">
                  <img
                    key={selectedImage.base64} // Force re-render for onLoad to fire again
                    src={`data:${selectedImage.mimeType};base64,${selectedImage.base64}`}
                    alt="Selected weather satellite"
                    className={`w-full h-full object-cover transition-all duration-700 ease-out ${isHiResImageLoaded ? 'blur-0 scale-100' : 'blur-xl scale-105'}`}
                    onLoad={() => setIsHiResImageLoaded(true)}
                  />
                </div>
                <p className="text-sm text-gray-300 truncate">{selectedImage.file.name}</p>
              </div>
            ) : (
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-300">No image selected</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by uploading an image or using our sample.</p>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                aria-label="Upload image"
              />
              <button
                onClick={triggerFileSelect}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500"
              >
                Upload Image
              </button>
              <button
                onClick={handleUseSample}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
              >
                Use Sample
              </button>
            </div>
          </div>

          {/* Right Column: Analysis */}
          <div className="flex flex-col">
            <button
              onClick={handleAnalyzeClick}
              disabled={!selectedImage || isLoading}
              className="w-full mb-4 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Analyzing...' : 'Analyze Weather'}
            </button>
            <div className="bg-gray-700/50 rounded-lg p-6 flex-grow min-h-[200px] flex flex-col">
              <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                 <div className="flex items-center gap-3">
                   <h2 className="text-xl font-semibold text-gray-200">Meteorological Analysis</h2>
                   {analysisData && !isLoading && (
                      <button onClick={() => setIsShareModalOpen(true)} title="Share Analysis" className="text-gray-400 hover:text-cyan-400 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                        </svg>
                      </button>
                   )}
                 </div>
                 <div className="flex items-center gap-4 flex-wrap justify-end">
                  {location && !isLoading && <LocationDisplay location={location} />}
                  {temperature !== null && !isLoading && <TemperatureDisplay temp={temperature} />}
                  {windSpeed !== null && !isLoading && <WindSpeedDisplay speed={windSpeed} />}
                  {windDirection && !isLoading && <WindDirectionArrow direction={windDirection} />}
                 </div>
              </div>
              
              <div className="flex-grow">
                {isLoading && (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-400"></div>
                  </div>
                )}
                {error && <div className="text-red-400 bg-red-900/50 p-3 rounded-md">{error}</div>}
                {explanation && (
                  <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap">
                      {explanation}
                  </div>
                )}
                {!isLoading && !explanation && !error && (
                  <p className="text-gray-400">Your weather analysis will appear here.</p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
      <ShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        analysisData={analysisData}
      />
    </div>
  );
}
