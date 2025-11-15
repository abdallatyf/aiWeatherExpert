import React, { useState, useCallback, useRef } from 'react';
import { ImageFile } from './types';
import { explainWeatherFromImage } from './services/geminiService';
import { HISTORICAL_IMAGE_BASE64, HISTORICAL_IMAGE_MIMETYPE } from './historicalImage';

export default function App() {
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isHiResImageLoaded, setIsHiResImageLoaded] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsHiResImageLoaded(false); // Reset for blur-up effect
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setSelectedImage({
          file: file,
          base64: base64String,
          mimeType: file.type,
        });
        setExplanation('');
        setError(null);
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
    setError(null);
    setExplanation('');
    try {
      const result = await explainWeatherFromImage(selectedImage.mimeType, selectedImage.base64);
      setExplanation(result);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedImage]);

  const handleUseSample = () => {
    setIsHiResImageLoaded(false); // Reset for blur-up effect
    setSelectedImage({
      file: new File([], "hurricane-ian.jpg", { type: HISTORICAL_IMAGE_MIMETYPE }),
      base64: HISTORICAL_IMAGE_BASE64,
      mimeType: HISTORICAL_IMAGE_MIMETYPE,
    });
    setExplanation('');
    setError(null);
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

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
            <div className="bg-gray-700/50 rounded-lg p-6 flex-grow min-h-[200px]">
              <h2 className="text-xl font-semibold text-gray-200 mb-4">Meteorological Analysis</h2>
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
        </main>
      </div>
    </div>
  );
}