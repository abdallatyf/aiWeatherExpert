
import React, { useState, useCallback, useRef } from 'react';
import { ImageFile } from './types';
import { explainWeatherFromImage } from './services/geminiService';

// --- Helper Components defined inside App.tsx to reduce file count ---

const UploadIcon: React.FC = () => (
  <svg className="w-12 h-12 mx-auto text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
    </svg>
);

const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const App: React.FC = () => {
    const [imageFile, setImageFile] = useState<ImageFile | null>(null);
    const [explanation, setExplanation] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                if (base64String) {
                    setImageFile({
                        file: file,
                        base64: base64String,
                        mimeType: file.type,
                    });
                    setExplanation('');
                    setError('');
                } else {
                    setError('Could not read the image file.');
                }
            };
            reader.onerror = () => {
                setError('Error reading file.');
            };
            reader.readAsDataURL(file);
        } else if (file) {
            setError('Please upload a valid image file (JPEG, PNG, WEBP, GIF).');
        }
    };

    const handleSubmit = useCallback(async () => {
        if (!imageFile || isLoading) return;

        setIsLoading(true);
        setError('');
        try {
            const result = await explainWeatherFromImage(imageFile.mimeType, imageFile.base64);
            setExplanation(result);
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, [imageFile, isLoading]);

    const handleReset = () => {
        setImageFile(null);
        setExplanation('');
        setError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const triggerFileSelect = () => fileInputRef.current?.click();

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
                        AI Weather Explainer
                    </h1>
                    <p className="mt-2 text-lg text-gray-400">
                        Upload a satellite image to get an expert meteorological analysis.
                    </p>
                </header>

                <main className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 md:p-8 border border-gray-700">
                    {explanation ? (
                        // --- Results View ---
                        <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
                            <div>
                                <h2 className="text-2xl font-bold mb-4 text-teal-300">Uploaded Image</h2>
                                <img src={`data:${imageFile?.mimeType};base64,${imageFile?.base64}`} alt="Weather satellite" className="rounded-lg shadow-lg w-full object-contain" />
                                <button
                                    onClick={handleReset}
                                    className="mt-6 w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-all duration-200"
                                >
                                    Analyze Another Image
                                </button>
                            </div>
                            <div className="prose prose-invert prose-lg max-w-none">
                                <h2 className="text-2xl font-bold mb-4 text-teal-300 flex items-center">
                                    <SparklesIcon className="w-6 h-6 mr-2" />
                                    AI-Generated Analysis
                                </h2>
                                <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-700 whitespace-pre-wrap">{explanation}</div>
                            </div>
                        </div>
                    ) : (
                        // --- Upload View ---
                        <div className="flex flex-col items-center">
                            {imageFile ? (
                                <div className="w-full max-w-xl text-center animate-fade-in">
                                    <h3 className="text-xl font-semibold mb-4 text-teal-300">Image Preview</h3>
                                    <img src={`data:${imageFile.mimeType};base64,${imageFile.base64}`} alt="Preview" className="rounded-lg shadow-lg mb-6 mx-auto max-h-96" />
                                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                        <button
                                            onClick={handleSubmit}
                                            disabled={isLoading}
                                            className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-all duration-200"
                                        >
                                            {isLoading && <LoadingSpinner />}
                                            {isLoading ? 'Analyzing...' : 'Get Explanation'}
                                        </button>
                                        <button
                                            onClick={handleReset}
                                            className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border border-gray-600 text-base font-medium rounded-md text-gray-300 bg-transparent hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-all duration-200"
                                        >
                                            Choose a different image
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full max-w-lg">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageChange}
                                        className="hidden"
                                        accept="image/jpeg, image/png, image/webp, image/gif"
                                    />
                                    <div 
                                        onClick={triggerFileSelect}
                                        className="mt-2 flex justify-center rounded-lg border-2 border-dashed border-gray-600 hover:border-blue-500 transition-colors duration-200 px-6 py-10 cursor-pointer"
                                    >
                                        <div className="text-center">
                                            <UploadIcon />
                                            <div className="mt-4 flex text-sm leading-6 text-gray-400">
                                                <p className="pl-1">Click to upload or drag and drop</p>
                                            </div>
                                            <p className="text-xs leading-5 text-gray-500">PNG, JPG, GIF up to 10MB</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="mt-6 w-full max-w-xl bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative" role="alert">
                                    <strong className="font-bold">Error: </strong>
                                    <span className="block sm:inline">{error}</span>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;
