





import React, { useState, useCallback, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { zlibSync, unzlibSync } from 'fflate';
import { ImageFile, AnalysisResult, SavedAnalysis, StorableImage } from './types';
import { explainWeatherFromImage } from './services/geminiService';
import { HISTORICAL_IMAGE_MIMETYPE, HISTORICAL_IMAGE_BASE64 } from './historicalImageData';

// --- Helper Components defined inside App.tsx to reduce file count ---

const UploadIcon: React.FC = () => (
  <svg className="w-12 h-12 mx-auto text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CalendarDaysIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25M3 18.75a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18" />
    </svg>
);

const ComputerDesktopIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z" />
    </svg>
);

const ArrowLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
);

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
    </svg>
);

const ShareIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm0 0v1.066c0 .98 1.533 1.066 1.533 0V10.907m0-4.522c.938 0 1.616.632 1.616 1.408 0 .58-.454 1.133-1.074 1.394M12 21.75a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm0 0v-1.066c0-.98-1.533-1.066-1.533 0v1.066m0-4.522c-.938 0-1.616.632-1.616 1.408 0 .58.454 1.133 1.074 1.394M8.583 7.512a2.25 2.25 0 0 0-1.083 1.083c.043.344.185.652.372.918l2.95 3.54-2.95 3.54a2.25 2.25 0 0 0-.372.918c.245.58.784 1.083 1.48 1.083h4.833c.696 0 1.235-.503 1.48-1.083.187-.266.329-.574.372-.918l-2.95-3.54 2.95-3.54a2.25 2.25 0 0 0 .372-.918c-.245-.58-.784-1.083-1.48-1.083H8.583Z" />
    </svg>
);

const ClipboardIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a2.25 2.25 0 0 1-2.25 2.25h-1.5a2.25 2.25 0 0 1-2.25-2.25v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
);

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);

const LinkIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
);

const ArrowDownTrayIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

const BookmarkIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 11.186 0Z" />
    </svg>
);


// --- Main App Component ---

type AppMode = 'home' | 'upload' | 'historical' | 'viewing' | 'sharing' | 'saved' | 'webCapture';

function App() {
    const [mode, setMode] = useState<AppMode>('home');
    const [imageFile, setImageFile] = useState<ImageFile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSharingLoading, setIsSharingLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [activeAnalysis, setActiveAnalysis] = useState<SavedAnalysis | null>(null);
    const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [shareUrl, setShareUrl] = useState<string>('');
    const [showCopied, setShowCopied] = useState(false);
    const [lastFailedAction, setLastFailedAction] = useState<(() => Promise<void>) | null>(null);
    const liveMapUrl = 'https://zoom.earth/maps/satellite/#view=7.389094,124.063201,9z/overlays=radar';

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Data Persistence ---
    const saveAnalysis = useCallback((analysis: SavedAnalysis) => {
        setSavedAnalyses(prev => {
            const updated = [analysis, ...prev.filter(a => a.id !== analysis.id)];
            try {
                localStorage.setItem('savedAnalyses', JSON.stringify(updated));
            } catch (e) {
                console.error("Failed to save to localStorage:", e);
            }
            return updated;
        });
    }, []);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('savedAnalyses');
            if (stored) {
                setSavedAnalyses(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to load from localStorage:", e);
        }

        // Check for shared URL on initial load
        const urlParams = new URLSearchParams(window.location.search);
        const sharedData = urlParams.get('data');
        if (sharedData) {
            try {
                const decoded = atob(sharedData);
                const decompressed = unzlibSync(new Uint8Array(decoded.split('').map(c => c.charCodeAt(0))));
                const jsonString = new TextDecoder().decode(decompressed);
                const analysis = JSON.parse(jsonString) as SavedAnalysis;
                setActiveAnalysis(analysis);
                setMode('viewing');
                // Clean URL after loading
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (e) {
                console.error("Failed to load shared analysis:", e);
                setError("The shared analysis link is invalid or corrupted.");
                setMode('home');
            }
        }
    }, []);

    // --- Event Handlers ---

    const handleBack = () => {
        if (mode === 'upload' || mode === 'historical' || mode === 'saved' || mode === 'webCapture') {
            setMode('home');
        } else if (mode === 'viewing' || mode === 'sharing') {
            // Determine where to go back to
            const previousMode = activeAnalysis?.originalImage.base64 === HISTORICAL_IMAGE_BASE64 ? 'historical' : 'upload';
            setMode(previousMode);
        }
        // Reset transient state
        setError(null);
        setLastFailedAction(null);
        setAnalysisResult(null);
    };

    const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    const base64 = (event.target.result as string).split(',')[1];
                    setImageFile({ file: file, base64, mimeType: file.type });
                    setError(null);
                    setLastFailedAction(null);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUploadSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!imageFile) {
            setError("Please select an image file first.");
            setLastFailedAction(null);
            return;
        }

        const analysisFn = async () => {
            setIsLoading(true);
            setError(null);
            setAnalysisResult(null);
            setLastFailedAction(null);

            try {
                const result = await explainWeatherFromImage(imageFile.mimeType, imageFile.base64);
                setAnalysisResult(result);
                const newAnalysis: SavedAnalysis = {
                    id: Date.now().toString(),
                    date: new Date().toISOString().split('T')[0],
                    originalImage: { base64: imageFile.base64, mimeType: imageFile.mimeType },
                    ...result,
                };
                saveAnalysis(newAnalysis);
                setActiveAnalysis(newAnalysis);
                setMode('viewing');
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                setError(errorMessage);
                setLastFailedAction(() => analysisFn);
                console.error("Upload analysis failed:", err);
            } finally {
                setIsLoading(false);
            }
        };

        analysisFn();

    }, [imageFile, saveAnalysis]);

    const onDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedDate(e.target.value);
        setError(null);
        setLastFailedAction(null);
    };

    const handleHistoricalSubmit = useCallback(async () => {
        if (!selectedDate) {
            setError("Please select a date first.");
            setLastFailedAction(null);
            return;
        }

        const analysisFn = async () => {
            setIsLoading(true);
            setError(null);
            setAnalysisResult(null);
            setLastFailedAction(null);
            try {
                const result = await explainWeatherFromImage(HISTORICAL_IMAGE_MIMETYPE, HISTORICAL_IMAGE_BASE64);
                setAnalysisResult(result);
                const newAnalysis: SavedAnalysis = {
                    id: Date.now().toString(),
                    date: selectedDate,
                    originalImage: { base64: HISTORICAL_IMAGE_BASE64, mimeType: HISTORICAL_IMAGE_MIMETYPE },
                    ...result,
                };
                saveAnalysis(newAnalysis);
                setActiveAnalysis(newAnalysis);
                setMode('viewing');
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                setError(errorMessage);
                setLastFailedAction(() => analysisFn);
                console.error("Historical analysis failed:", err);
            } finally {
                setIsLoading(false);
            }
        };

        analysisFn();
    }, [selectedDate, saveAnalysis]);
    
    const handleCaptureAndAnalyze = useCallback(async () => {
        const analysisFn = async () => {
            setIsLoading(true);
            setError(null);
            setLastFailedAction(null);
            setAnalysisResult(null);

            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    // FIX: The `cursor` property is a valid constraint for `getDisplayMedia`, but may not be present in some TypeScript DOM type definitions. Casting to `any` bypasses this type check.
                    video: { cursor: "never" } as any,
                    audio: false,
                });

                const track = stream.getVideoTracks()[0];
                const video = document.createElement('video');
                video.srcObject = stream;
                
                await new Promise((resolve, reject) => {
                    video.onloadedmetadata = resolve;
                    video.onerror = reject;
                });
                video.play();
                
                // Allow a moment for the video to render the first frame.
                await new Promise(resolve => setTimeout(resolve, 100));

                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const context = canvas.getContext('2d');
                if (!context) throw new Error("Could not get canvas context.");
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                track.stop();
                video.srcObject = null;

                const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
                const mimeType = 'image/jpeg';

                const result = await explainWeatherFromImage(mimeType, base64);
                setAnalysisResult(result);
                const newAnalysis: SavedAnalysis = {
                    id: Date.now().toString(),
                    date: new Date().toISOString().split('T')[0],
                    originalImage: { base64, mimeType },
                    ...result,
                };
                saveAnalysis(newAnalysis);
                setActiveAnalysis(newAnalysis);
                setMode('viewing');

            } catch (err) {
                let errorMessage: string;
                if (err instanceof DOMException && err.name === 'NotAllowedError') {
                    errorMessage = "Screen capture permission was denied. Please allow sharing to proceed.";
                } else {
                    errorMessage = err instanceof Error ? err.message : "An unknown error occurred during capture or analysis.";
                }
                setError(errorMessage);
                setLastFailedAction(() => analysisFn);
                console.error("Live Map analysis failed:", err);
            } finally {
                setIsLoading(false);
            }
        };
        analysisFn();
    }, [saveAnalysis]);


    const handleShare = async () => {
        if (!activeAnalysis || isSharingLoading) return;
        
        setIsSharingLoading(true);
        setError(null); // Clear previous errors

        try {
            const jsonString = JSON.stringify(activeAnalysis);
            const compressed = zlibSync(new TextEncoder().encode(jsonString));
            const base64 = btoa(String.fromCharCode.apply(null, Array.from(compressed)));
            const url = `${window.location.origin}${window.location.pathname}?data=${base64}`;

            const qr = await QRCode.toDataURL(url, {
                errorCorrectionLevel: 'L', // Use lower error correction for smaller QR codes
                margin: 2,
                scale: 4,
                color: {
                    dark: '#e5e7eb', // gray-300
                    light: '#00000000' // transparent
                }
            });
            setQrCodeUrl(qr);
            setShareUrl(url);
            setMode('sharing'); // Switch mode only on success
        } catch (e) {
            console.error("Failed to generate share link:", e);
            setError("Could not generate the shareable link. The data might be too large or corrupted.");
            // Stay on the 'viewing' screen to display the error.
        } finally {
            setIsSharingLoading(false);
        }
    };
    
    useEffect(() => {
        if (mode === 'historical' && !selectedDate) {
            setSelectedDate(new Date().toISOString().split('T')[0]);
        }
    }, [mode, selectedDate]);

    const copyToClipboard = () => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl).then(() => {
            setShowCopied(true);
            setTimeout(() => setShowCopied(false), 2000);
        });
    };
    
    const handleDownload = (image: StorableImage, filename: string) => {
        const link = document.createElement('a');
        link.href = `data:${image.mimeType};base64,${image.base64}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    // --- UI Rendering ---

    const renderHeader = (title: string, showBackButton: boolean) => (
        <div className="relative flex items-center justify-center p-4 border-b border-gray-700">
            {showBackButton && (
                <button onClick={handleBack} className="absolute left-4 p-2 rounded-full hover:bg-gray-700 transition-colors" aria-label="Go back">
                    <ArrowLeftIcon className="w-6 h-6" />
                </button>
            )}
            <h1 className="text-xl font-bold text-center">{title}</h1>
        </div>
    );

    const renderHome = () => (
        <div className="flex flex-col items-center justify-center min-h-full p-8 text-center animate-fade-in">
            <SparklesIcon className="w-16 h-16 text-cyan-400" />
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white">AI Weather Explainer</h1>
            <p className="mt-2 text-lg text-gray-400 max-w-2xl">
                Upload a satellite image, explore historical data, or analyze a live map to get an AI-powered meteorological analysis.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
                <button onClick={() => setMode('upload')} className="w-full sm:w-auto flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-200 transform hover:scale-105">
                    <UploadIcon /> <span className="ml-3">Upload Image</span>
                </button>
                <button onClick={() => setMode('historical')} className="w-full sm:w-auto flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 transition-all duration-200 transform hover:scale-105">
                    <CalendarDaysIcon className="w-5 h-5" /> <span className="ml-3">Historical Data</span>
                </button>
                 <button onClick={() => setMode('webCapture')} className="w-full sm:w-auto flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 transition-all duration-200 transform hover:scale-105">
                    <ComputerDesktopIcon className="w-5 h-5" /> <span className="ml-3">Analyze Live Map</span>
                </button>
                 <button onClick={() => setMode('saved')} className="mt-4 sm:mt-0 w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-gray-200 bg-gray-700 hover:bg-gray-600 transition-all duration-200 transform hover:scale-105">
                    <BookmarkIcon className="w-5 h-5" /> <span className="ml-3">Saved Analyses ({savedAnalyses.length})</span>
                </button>
            </div>
        </div>
    );

    const renderUpload = () => (
        <div className="flex flex-col h-full">
            {renderHeader("Upload Satellite Image", true)}
            <div className="flex-grow p-4 md:p-8 flex flex-col items-center justify-center">
                <form onSubmit={handleUploadSubmit} className="w-full max-w-lg">
                    <div className="mt-2 flex justify-center rounded-lg border-2 border-dashed border-gray-600 px-6 py-10 hover:border-gray-500 transition-colors">
                        <div className="text-center">
                            <UploadIcon />
                            <div className="mt-4 flex text-sm leading-6 text-gray-400">
                                <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-indigo-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 hover:text-indigo-300">
                                    <span>Upload a file</span>
                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={onImageChange} accept="image/png, image/jpeg, image/webp, image/gif" ref={fileInputRef} />
                                </label>
                                <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs leading-5 text-gray-500">PNG, JPG, GIF, WEBP up to 10MB</p>
                        </div>
                    </div>

                    {imageFile && (
                        <div className="mt-4 text-center">
                            <img src={`data:${imageFile.mimeType};base64,${imageFile.base64}`} alt="Preview" className="mx-auto max-h-48 rounded-lg shadow-lg" />
                            <p className="mt-2 text-sm text-gray-400 truncate">{imageFile.file.name}</p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 bg-red-900/50 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg relative animate-fade-in flex items-center justify-between" role="alert">
                            <div>
                                <strong className="font-bold">Error:</strong>
                                <span className="block sm:inline ml-2">{error}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                {lastFailedAction && (
                                    <button
                                        type="button"
                                        onClick={lastFailedAction}
                                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-yellow-500 transition-all duration-200"
                                    >
                                        Retry
                                    </button>
                                )}
                                <button type="button" onClick={() => { setError(null); setLastFailedAction(null); }} className="p-1 rounded-full hover:bg-red-800/50" aria-label="Close">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}


                    <button type="submit" disabled={!imageFile || isLoading} className="mt-6 w-full flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200">
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analyzing...
                            </>
                        ) : "Explain Weather"}
                    </button>
                </form>
            </div>
        </div>
    );
    
    const renderHistorical = () => (
        <div className="flex flex-col h-full">
            {renderHeader("Explore Historical Data", true)}
            <div className="flex-grow p-4 md:p-8 flex flex-col items-center">
                <div className="w-full max-w-lg text-center">
                    <p className="text-gray-400">Select a date to analyze a significant historical weather event: Hurricane Ian (2022).</p>
                    <div className="mt-4">
                        <label htmlFor="date-picker" className="block text-sm font-medium text-gray-300 mb-1">Select Date</label>
                        <input
                            type="date"
                            id="date-picker"
                            value={selectedDate}
                            onChange={onDateChange}
                            className="w-full bg-gray-800 border-gray-600 text-white rounded-md p-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>

                    <div className="mt-4 p-2 border border-gray-700 rounded-lg bg-black">
                         <img src={`data:${HISTORICAL_IMAGE_MIMETYPE};base64,${HISTORICAL_IMAGE_BASE64}`} alt="Hurricane Ian" className="rounded-md w-full" />
                    </div>

                     {error && (
                        <div className="mt-4 bg-red-900/50 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg relative animate-fade-in flex items-center justify-between" role="alert">
                            <div>
                                <strong className="font-bold">Error:</strong>
                                <span className="block sm:inline ml-2">{error}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                {lastFailedAction && (
                                    <button
                                        type="button"
                                        onClick={lastFailedAction}
                                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-yellow-500 transition-all duration-200"
                                    >
                                        Retry
                                    </button>
                                )}
                                <button type="button" onClick={() => { setError(null); setLastFailedAction(null); }} className="p-1 rounded-full hover:bg-red-800/50" aria-label="Close">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    <button onClick={handleHistoricalSubmit} disabled={!selectedDate || isLoading} className="mt-6 w-full flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-teal-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200">
                         {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analyzing...
                            </>
                        ) : "Explain Historical Weather"}
                    </button>
                </div>
            </div>
        </div>
    );
    
    const renderWebCapture = () => {
        return (
            <div className="flex flex-col h-full">
                {renderHeader("Analyze Live Map", true)}
                <div className="flex-grow p-4 md:p-8 flex flex-col items-center">
                    <div className="w-full h-full max-w-7xl flex flex-col">
                        <p className="text-center text-gray-400 mb-4">
                            Pan and zoom the map to the desired view, then capture it for a detailed meteorological analysis.
                        </p>
                        <div className="flex-grow w-full border border-gray-700 rounded-lg overflow-hidden bg-black">
                            <iframe
                                src={liveMapUrl}
                                className="w-full h-full"
                                title="Live Weather Map"
                            ></iframe>
                        </div>
                         {error && (
                            <div className="mt-4 bg-red-900/50 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg relative animate-fade-in flex items-center justify-between" role="alert">
                                <div>
                                    <strong className="font-bold">Error:</strong>
                                    <span className="block sm:inline ml-2">{error}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {lastFailedAction && (
                                        <button
                                            type="button"
                                            onClick={lastFailedAction}
                                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-yellow-500 transition-all duration-200"
                                        >
                                            Retry
                                        </button>
                                    )}
                                    <button type="button" onClick={() => { setError(null); setLastFailedAction(null); }} className="p-1 rounded-full hover:bg-red-800/50" aria-label="Close">
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={handleCaptureAndAnalyze}
                            disabled={isLoading}
                            className="mt-6 w-full flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Analyzing...
                                </>
                            ) : "Analyze"}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const ImageViewer: React.FC<{ original: StorableImage, summary: StorableImage }> = ({ original, summary }) => {
        const [showSummary, setShowSummary] = useState(true);
        const [isOriginalLoaded, setOriginalLoaded] = useState(false);
        const [isSummaryLoaded, setSummaryLoaded] = useState(false);
        const showLoader = !isOriginalLoaded || !isSummaryLoaded;

        const ImageLoadingSpinner = () => (
             <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );

        return (
            <div className="relative w-full aspect-square border border-gray-700 rounded-lg overflow-hidden bg-black">
                {showLoader && <ImageLoadingSpinner />}
                <img
                    src={`data:${original.mimeType};base64,${original.base64}`}
                    alt="Original satellite"
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${showSummary ? 'opacity-0' : 'opacity-100'} ${isOriginalLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setOriginalLoaded(true)}
                />
                <img
                    src={`data:${summary.mimeType};base64,${summary.base64}`}
                    alt="AI visual summary"
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${showSummary ? 'opacity-100' : 'opacity-0'} ${isSummaryLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setSummaryLoaded(true)}
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900/70 backdrop-blur-sm p-1 rounded-full flex items-center space-x-1 z-10">
                    <button onClick={() => setShowSummary(false)} className={`px-4 py-1.5 text-sm font-medium rounded-full ${!showSummary ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Original</button>
                    <button onClick={() => setShowSummary(true)} className={`px-4 py-1.5 text-sm font-medium rounded-full ${showSummary ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>AI Summary</button>
                </div>
            </div>
        );
    };

    const renderViewing = () => {
        if (!activeAnalysis) return null;

        return (
            <div className="flex flex-col h-full">
                {renderHeader(`Analysis for ${activeAnalysis.date}`, true)}
                <div className="flex-grow overflow-y-auto p-4 md:p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
                        <div className="flex flex-col space-y-4">
                             <ImageViewer 
                                original={activeAnalysis.originalImage} 
                                summary={{ base64: activeAnalysis.visualSummary, mimeType: activeAnalysis.visualSummaryMimeType }} 
                             />
                            <div className="flex space-x-2">
                                <button onClick={() => handleDownload(activeAnalysis.originalImage, `original-${activeAnalysis.date}.jpg`)} className="flex-1 text-sm flex items-center justify-center p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"><ArrowDownTrayIcon className="w-4 h-4 mr-2" /> Original</button>
                                <button onClick={() => handleDownload({base64: activeAnalysis.visualSummary, mimeType: activeAnalysis.visualSummaryMimeType}, `summary-${activeAnalysis.date}.jpg`)} className="flex-1 text-sm flex items-center justify-center p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"><ArrowDownTrayIcon className="w-4 h-4 mr-2" /> AI Summary</button>
                            </div>
                        </div>

                        <div className="bg-gray-800/50 rounded-lg p-4 md:p-6 prose prose-invert prose-p:text-gray-300 prose-headings:text-gray-100 max-w-none">
                            <h2 className="!mt-0">Meteorological Explanation</h2>
                            <p>{activeAnalysis.explanation}</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-700">
                    {error && (
                        <div className="mb-4 bg-red-900/50 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg relative animate-fade-in flex items-center justify-between" role="alert">
                            <div>
                                <strong className="font-bold">Error:</strong>
                                <span className="block sm:inline ml-2">{error}</span>
                            </div>
                            <button type="button" onClick={() => setError(null)} className="p-1 rounded-full hover:bg-red-800/50" aria-label="Close">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <button 
                            onClick={handleShare} 
                            disabled={isSharingLoading}
                            className="flex items-center justify-center px-6 py-2 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-all duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            {isSharingLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Generating Link...
                                </>
                            ) : (
                                <>
                                    <ShareIcon className="w-5 h-5 mr-2" /> Share Analysis
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderSharing = () => {
        return (
             <div className="flex flex-col h-full">
                {renderHeader("Share Analysis", true)}
                <div className="flex-grow p-4 md:p-8 flex flex-col items-center justify-center text-center">
                    <h2 className="text-2xl font-bold">Share this analysis</h2>
                    <p className="mt-2 text-gray-400">Others can scan this QR code to view the results.</p>
                    <div className="mt-6 p-4 border-2 border-dashed border-gray-600 rounded-xl bg-gray-800/50">
                        {qrCodeUrl ? <img src={qrCodeUrl} alt="QR Code" className="w-56 h-56 mx-auto" /> : <div className="w-56 h-56 flex items-center justify-center">Loading QR Code...</div>}
                    </div>
                    <div className="mt-6 w-full max-w-sm">
                        <div className="flex rounded-md shadow-sm bg-gray-800 border border-gray-600">
                             <span className="inline-flex items-center px-3 rounded-l-md text-gray-400 sm:text-sm">
                                <LinkIcon className="w-5 h-5" />
                             </span>
                            <input type="text" readOnly value={shareUrl} className="flex-1 block w-full min-w-0 rounded-none bg-transparent sm:text-sm text-gray-200 border-0 focus:ring-0" />
                            <button onClick={copyToClipboard} className="relative inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold bg-gray-700 hover:bg-gray-600">
                                {showCopied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderSaved = () => (
        <div className="flex flex-col h-full">
            {renderHeader(`Saved Analyses (${savedAnalyses.length})`, true)}
            <div className="flex-grow p-4 md:p-8 overflow-y-auto">
                {savedAnalyses.length === 0 ? (
                    <div className="text-center text-gray-500">
                        <p>You haven't saved any analyses yet.</p>
                        <p>Upload an image or analyze historical data to get started.</p>
                    </div>
                ) : (
                    <ul className="space-y-4">
                        {savedAnalyses.map(analysis => (
                            <li key={analysis.id} className="bg-gray-800 p-4 rounded-lg flex items-center justify-between hover:bg-gray-700/50 transition-colors cursor-pointer" onClick={() => { setActiveAnalysis(analysis); setMode('viewing'); }}>
                                <div className="flex items-center">
                                    <img src={`data:${analysis.originalImage.mimeType};base64,${analysis.originalImage.base64}`} alt={`Analysis for ${analysis.date}`} className="w-16 h-16 object-cover rounded-md mr-4" />
                                    <div>
                                        <p className="font-bold text-white">Weather Analysis</p>
                                        <p className="text-sm text-gray-400">Date: {analysis.date}</p>
                                    </div>
                                </div>
                                <button onClick={(e) => {
                                    e.stopPropagation();
                                    if(window.confirm("Are you sure you want to delete this analysis?")) {
                                        setSavedAnalyses(prev => {
                                            const updated = prev.filter(a => a.id !== analysis.id);
                                            localStorage.setItem('savedAnalyses', JSON.stringify(updated));
                                            return updated;
                                        });
                                    }
                                }} className="p-2 rounded-full hover:bg-red-800/50 text-red-400 hover:text-red-300 transition-colors" aria-label="Delete analysis">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );


    const renderContent = () => {
        switch (mode) {
            case 'home': return renderHome();
            case 'upload': return renderUpload();
            case 'historical': return renderHistorical();
            case 'webCapture': return renderWebCapture();
            case 'viewing': return renderViewing();
            case 'sharing': return renderSharing();
            case 'saved': return renderSaved();
            default: return renderHome();
        }
    };

    return (
        <main className="bg-gray-900 text-gray-200 font-sans h-screen flex flex-col">
            {renderContent()}
        </main>
    );
}

export default App;