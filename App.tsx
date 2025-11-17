import React, { useState, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { ImageFile, AnalysisResult } from './types';
import { explainWeatherFromImage } from './services/geminiService';

// --- Placeholder for historical image data ---
// In a real application, you would fetch this from a weather API.
// This is a Base64 encoded image of Hurricane Ian, courtesy of NASA.
const HISTORICAL_IMAGE_MIMETYPE = 'image/jpeg';
const HISTORICAL_IMAGE_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIbGNtcwIQAABtbnRyUkdCIFhZWiAH4gADABQACQAOAB1hY3NwTVNGVAAAAABIUUhOAAAAAAAAAAAAAAA9tYAAQAAAADTLUhQICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABFjcHJ0AAABUAAAADNkZXNjAAABhAAAAGx3dHB0AAAB8AAAABRia3B0AAACBAAAABRyWFlaAAACGAAAABRnWFlaAAACLAAAABRiWFlaAAACQAAAABRkbW5kAAACVAAAAHBkbWRkAAACxAAAAIh2dWVkAAADTAAAAIZ2aWV3AAADiAAAACRsdW1pAAADoAAAAEhmeaBwAAAA6AAAACR0ZWNoAAAADsAAAAAKclRSQwAADEMAAAAgZ1RSQwAADEMAAAAgYlRSQwAADEMAAAAgY2hybQAADGAAAAAkY2hhZAAADSAAAAAsYWFyZwAADWAAAAAkYWFoZwAADWAAAAAkYWFpZwAADWAAAAAkYWRkZQAADWAAAAAkaW50ZgAADWAAAAAkZGVwdgAADWAAAAAkaW5wdgAADWAAAAAkenRwcgAADWAAAAAkemV4ZQAADWAAAAAkemFwMAAADWAAAAAkemFwcQAADWAAAAAkenN3ZQAADWAAAAAkemN3cAAADWAAAAAkemV3awAADWAAAAAkemx3ZwAADWAAAAAkemV3bwAADWAAAAAkemN3bwAADWAAAAAkemN3cQAADWAAAAAkenBvZwAADWAAAAAkenBwcAAADWAAAAAkenJtcQAADWAAAAAkenNtbQAADWAAAAAkenR3ZwAADWAAAAAkenh3ZwAADWAAAAAkenR3bwAADWAAAAAkZW5mbQAADWAAAAAkaW5mbwAADWAAAAAkc2xpZQAADWAAAAAkc21vZwAADWAAAAAkbW90bgAADWAAAAAkenRoZwAADWAAAAAkbW9pZwAADWAAAAAkbXNpdgAADWAAAAAkZ2NvdQAADWAAAAAkaW5wbwAADWAAAAAkY2xpZQAADWAAAAAkc29zZQAADWAAAAAkbWRiZQAADWAAAAAkenN0ZwAADWAAAAAkc3N0ZQAADWAAAAAkYmxwbwAADWAAAAAkYXBwZwAADWAAAAAkbWx1YwAAAAAAAAABAAAAmGFwcGwAAAAAAAAAAAAAAAAAAAAAAG1sdWMAAAAAAAAAAQAAAAZlblVTAAAAoAAAABwAUAByAG8AZgBpAGwAZQAgAGcAZQBuAGUAcgBhAHQAZQBkACAAaQBuACAAcwBpAG0AcABsAGUAUwBDLgAgAEgAUwBEACAAcwBoAGEAcgBwAGUAbgBpAG4AZwAgAHMAdABlAHAALgAgAEMAbwBwAHkAcgBpAGcAaAB0ACAAKABjACkAIABHAG8AbwBnAGwAZQAgAEkAbgBjAC4AAAARY3VydgAAAAAAAAABAAAA0P/bAEMAAwICAwICAwMDAwQDAwQFCAUFBAYFCgcHBggMCgwMCwoLCw0OEhANDhEOCwsQFhARExQVFRUMDxcYFhQYEhQVFP/AEMBAwQEBQQFCQUFCRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/AABEIA4QGgAMBIgACEQEDEQH/xAAdAAEAAgIDAQEAAAAAAAAAAAAABgcEBQEDCAIJ/8QAZhAAAQQBAgMDBwcTCwsJCQQLAQACAwQRBQYHEiExCRNBUQgUFSJhcZHSFhhTVIGRtiMzNDlCUlRVoaQJGTdWYmVxcoKSlbGywdNVdZWis8ZERVRndpW04idERcNGdIOl8CY4g8P/xAAbAQEAAwEBAQEAAAAAAAAAAAAAAQIDBAUGB//EADwRAQACAQIDBQUHAwIFBQAAAAABEQIDEiExBUEFUWFxEyKBkaHB0fAUMsHhBiNSUhU0Q2JykvFiY7Ky/AiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAi//Z';

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

const LoadingSpinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

interface ImageViewerProps {
    originalImage: ImageFile;
    visualSummary: { base64: string; mimeType: string; };
    viewMode: 'original' | 'visual' | 'unified';
    onViewModeChange: (mode: 'original' | 'visual' | 'unified') => void;
    selectedDate?: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ originalImage, visualSummary, viewMode, onViewModeChange, selectedDate }) => {
    const modes = [
        { id: 'unified', label: 'Unified' },
        { id: 'visual', label: 'AI Summary' },
        { id: 'original', label: 'Original' },
    ];

    const formattedDate = selectedDate 
        ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
          })
        : '';

    return (
        <div>
            <div className="flex justify-center mb-4">
                <div className="inline-flex rounded-lg bg-gray-700/50 p-1 space-x-1">
                    {modes.map(mode => (
                        <button
                            key={mode.id}
                            onClick={() => onViewModeChange(mode.id as any)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 ${
                                viewMode === mode.id ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:bg-gray-600/50'
                            }`}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative w-full rounded-lg shadow-lg overflow-hidden border border-gray-700">
                {/* Hidden image to set the aspect ratio of the container */}
                <img
                    src={`data:${originalImage.mimeType};base64,${originalImage.base64}`}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-auto object-contain invisible"
                />
                <img
                    src={`data:${originalImage.mimeType};base64,${originalImage.base64}`}
                    alt="Original weather satellite"
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
                        viewMode === 'original' || viewMode === 'unified' ? 'opacity-100' : 'opacity-0'
                    }`}
                />
                <img
                    src={`data:${visualSummary.mimeType};base64,${visualSummary.base64}`}
                    alt="AI Generated visual summary"
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
                        viewMode === 'visual' ? 'opacity-100' :
                        viewMode === 'unified' ? 'opacity-75' : 'opacity-0'
                    }`}
                />
                {selectedDate && (viewMode === 'visual' || viewMode === 'unified') && (
                    <div className="absolute top-3 right-3 bg-black/60 text-white text-base font-bold px-4 py-2 rounded-lg backdrop-blur-sm pointer-events-none shadow-lg border border-white/20">
                        {formattedDate}
                    </div>
                )}
            </div>
        </div>
    );
};

interface ErrorAlertProps {
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onDismiss, onRetry }) => (
    <div className="mt-6 w-full max-w-xl mx-auto bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative flex items-center justify-between animate-fade-in" role="alert">
        <div className="pr-4">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{message}</span>
        </div>
        <div className="flex items-center flex-shrink-0">
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="mr-2 px-3 py-1 border border-red-500 text-red-300 rounded hover:bg-red-500/30 transition-colors text-sm font-semibold"
                >
                    Retry
                </button>
            )}
            <button onClick={onDismiss} className="p-1 rounded-full hover:bg-red-500/30 transition-colors" aria-label="Dismiss">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
    </div>
);

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    qrCodeDataUrl: string;
    onDownloadImage: () => void;
    onCopyText: () => void;
    onCopyLink: () => void;
    onWebShare: () => void;
    isDownloading: boolean;
    copyStatus: { text: boolean; link: boolean };
}

const ShareModal: React.FC<ShareModalProps> = ({
    isOpen, onClose, qrCodeDataUrl, onDownloadImage, onCopyText, onCopyLink, onWebShare, isDownloading, copyStatus
}) => {
    if (!isOpen) return null;
    const canShare = typeof navigator.share === 'function';

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in-fast" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md m-4 text-gray-200 p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-teal-300">Share Analysis</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-gray-900/50 rounded-lg">
                        <div className="p-2 bg-white rounded-lg">
                            {qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="QR Code" className="w-28 h-28" /> : <div className="w-28 h-28 bg-gray-300 animate-pulse rounded"></div>}
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <p className="font-semibold">Share with QR Code</p>
                            <p className="text-sm text-gray-400 mb-3">Scan this code to open the current view on another device.</p>
                            <button onClick={onCopyLink} className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors duration-200">
                                {copyStatus.link ? <CheckIcon className="w-5 h-5 mr-2 text-green-400" /> : <LinkIcon className="w-5 h-5 mr-2" />}
                                {copyStatus.link ? 'Link Copied!' : 'Copy Link'}
                            </button>
                        </div>
                    </div>

                    <button onClick={onDownloadImage} disabled={isDownloading} className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors duration-200">
                        {isDownloading ? <LoadingSpinner /> : <ArrowDownTrayIcon className="w-5 h-5 mr-2" />}
                        {isDownloading ? 'Downloading...' : 'Download Unified Image'}
                    </button>

                    <button onClick={onCopyText} className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-600 text-base font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors duration-200">
                        {copyStatus.text ? <CheckIcon className="w-5 h-5 mr-2 text-green-400" /> : <ClipboardIcon className="w-5 h-5 mr-2" />}
                        {copyStatus.text ? 'Analysis Copied!' : 'Copy Analysis Text'}
                    </button>
                    
                    {canShare && (
                         <button onClick={onWebShare} className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-600 text-base font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors duration-200">
                            <ShareIcon className="w-5 h-5 mr-2" />
                            Share via...
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    const [mode, setMode] = useState<'selection' | 'upload' | 'historical'>('selection');
    const [imageFile, setImageFile] = useState<ImageFile | null>(null);
    const [explanation, setExplanation] = useState<string>('');
    const [visualSummary, setVisualSummary] = useState<{base64: string; mimeType: string;} | null>(null);
    const [viewMode, setViewMode] = useState<'original' | 'visual' | 'unified'>('unified');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [lastActionIdentifier, setLastActionIdentifier] = useState<'upload' | 'historical' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [isDownloadingImage, setIsDownloadingImage] = useState(false);
    const [copyStatus, setCopyStatus] = useState({ text: false, link: false });

    const getTodayString = () => new Date().toISOString().split('T')[0];

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
                    setLastActionIdentifier(null);
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

    const handleUploadSubmit = useCallback(async () => {
        if (!imageFile || isLoading) return;
        setIsLoading(true);
        setError('');
        setLastActionIdentifier(null);
        try {
            const result = await explainWeatherFromImage(imageFile.mimeType, imageFile.base64);
            setExplanation(result.explanation);
            setVisualSummary({ base64: result.visualSummary, mimeType: result.visualSummaryMimeType });
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
            setLastActionIdentifier('upload');
        } finally {
            setIsLoading(false);
        }
    }, [imageFile, isLoading]);

    const handleHistoricalSubmit = useCallback(async () => {
        if (!selectedDate || isLoading) return;
        setIsLoading(true);
        setError('');
        setLastActionIdentifier(null);

        const placeholderImage = {
            file: new File([], "historical.jpg", { type: HISTORICAL_IMAGE_MIMETYPE }),
            base64: HISTORICAL_IMAGE_BASE64,
            mimeType: HISTORICAL_IMAGE_MIMETYPE,
        };
        setImageFile(placeholderImage);

        try {
            const result = await explainWeatherFromImage(placeholderImage.mimeType, placeholderImage.base64);
            setExplanation(result.explanation);
            setVisualSummary({ base64: result.visualSummary, mimeType: result.visualSummaryMimeType });
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
            setImageFile(null);
            setLastActionIdentifier('historical');
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate, isLoading]);

    const handleReset = () => {
        setImageFile(null);
        setExplanation('');
        setError('');
        setSelectedDate('');
        setVisualSummary(null);
        setViewMode('unified');
        setMode('selection');
        setLastActionIdentifier(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const handleDismissError = () => {
        setError('');
        setLastActionIdentifier(null);
    };

    const handleRetry = () => {
        if (lastActionIdentifier === 'upload') {
            handleUploadSubmit();
        } else if (lastActionIdentifier === 'historical') {
            handleHistoricalSubmit();
        }
    };

    const triggerFileSelect = () => fileInputRef.current?.click();

    // --- Share Modal Logic ---
    const handleOpenShareModal = async () => {
        setIsShareModalOpen(true);
        try {
            const url = await QRCode.toDataURL(window.location.href, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#e5e7eb', // gray-200
                    light: '#00000000' // transparent
                }
            });
            setQrCodeDataUrl(url);
        } catch (err) {
            console.error('Failed to generate QR code', err);
        }
    };

    const handleCloseShareModal = () => {
        setIsShareModalOpen(false);
        setQrCodeDataUrl('');
        setCopyStatus({ text: false, link: false });
    };

    const handleDownloadImage = useCallback(async () => {
        if (!imageFile || !visualSummary) return;
        setIsDownloadingImage(true);
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const original = new Image();
            const summary = new Image();

            const loadImage = (img: HTMLImageElement, src: string) =>
                new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = reject;
                    img.src = src;
                });
            
            await Promise.all([
                loadImage(original, `data:${imageFile.mimeType};base64,${imageFile.base64}`),
                loadImage(summary, `data:${visualSummary.mimeType};base64,${visualSummary.base64}`)
            ]);
            
            canvas.width = original.width;
            canvas.height = original.height;

            ctx.drawImage(original, 0, 0);
            ctx.globalAlpha = 0.75;
            ctx.drawImage(summary, 0, 0);
            ctx.globalAlpha = 1.0;

            const link = document.createElement('a');
            link.download = `weather-analysis-${selectedDate || 'current'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error("Failed to create or download image:", error);
            setError("Sorry, there was an error downloading the image.");
        } finally {
            setIsDownloadingImage(false);
        }
    }, [imageFile, visualSummary, selectedDate]);

    const handleCopy = async (type: 'text' | 'link') => {
        try {
            let contentToCopy = '';
            if (type === 'text') {
                contentToCopy = explanation;
            } else {
                contentToCopy = window.location.href;
            }
            await navigator.clipboard.writeText(contentToCopy);
            setCopyStatus(prev => ({ ...prev, [type]: true }));
            setTimeout(() => setCopyStatus(prev => ({ ...prev, [type]: false })), 2000);
        } catch (err) {
            console.error(`Failed to copy ${type}:`, err);
            setError(`Failed to copy ${type} to clipboard.`);
        }
    };

    const handleWebShare = async () => {
         if (!explanation) return;
        const shareText = selectedDate 
            ? `AI Weather Analysis for ${selectedDate}:\n\n${explanation}`
            : `AI Weather Analysis:\n\n${explanation}`;
        try {
            await navigator.share({
                title: 'AI Weather Analysis',
                text: shareText,
                url: window.location.href,
            });
        } catch (error) {
            console.info('User cancelled share or share failed.', error);
        }
    };

    const renderBackButton = (targetMode: 'selection') => (
        <button
            onClick={() => setMode(targetMode)}
            className="absolute top-4 left-4 inline-flex items-center px-3 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-800/50 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500 transition-all duration-200"
        >
            <ArrowLeftIcon className="w-4 h-4 mr-2 transform -translate-x-1" />
            Back
        </button>
    );

    const renderContent = () => {
        if (explanation && imageFile && visualSummary) {
            // --- Results View ---
            return (
                <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
                    <div>
                        <h2 className="text-2xl font-bold mb-4 text-teal-300">
                            {mode === 'historical' ? `Historical Image for ${selectedDate}` : 'Uploaded Image'}
                        </h2>
                        <ImageViewer
                          originalImage={imageFile}
                          visualSummary={visualSummary}
                          viewMode={viewMode}
                          onViewModeChange={setViewMode}
                          selectedDate={selectedDate}
                        />
                        <button
                            onClick={handleReset}
                            className="mt-6 w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-all duration-200"
                        >
                            Start Over
                        </button>
                    </div>
                    <div className="prose prose-invert prose-lg max-w-none">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-teal-300 flex items-center !my-0">
                                <SparklesIcon className="w-6 h-6 mr-2" />
                                AI-Generated Analysis
                            </h2>
                            <button
                                onClick={handleOpenShareModal}
                                title="Share analysis"
                                aria-label="Share analysis"
                                className="relative inline-flex items-center justify-center p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
                            >
                                <ShareIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-700 whitespace-pre-wrap">{explanation}</div>
                    </div>
                </div>
            )
        }
        
        switch (mode) {
            case 'selection':
                return (
                    <div className="text-center animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-300 mb-6">How would you like to begin?</h2>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center">
                            <button onClick={() => setMode('upload')} className="flex-1 flex flex-col items-center p-8 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 hover:bg-gray-700/50 transition-all duration-200">
                                <UploadIcon />
                                <span className="mt-4 text-lg font-semibold">Analyze My Image</span>
                                <span className="mt-1 text-sm text-gray-400">Upload a satellite image</span>
                            </button>
                            <button onClick={() => setMode('historical')} className="flex-1 flex flex-col items-center p-8 bg-gray-800 rounded-lg border border-gray-700 hover:border-teal-500 hover:bg-gray-700/50 transition-all duration-200">
                                <CalendarDaysIcon className="w-12 h-12 text-gray-500" />
                                <span className="mt-4 text-lg font-semibold">Explore Historical Data</span>
                                <span className="mt-1 text-sm text-gray-400">View analysis for a past date</span>
                            </button>
                        </div>
                    </div>
                );
            case 'upload':
                return (
                    <div className="relative animate-fade-in">
                        {renderBackButton('selection')}
                        <div className="flex flex-col items-center pt-10">
                            {imageFile ? (
                                <div className="w-full max-w-xl text-center">
                                    <h3 className="text-xl font-semibold mb-4 text-teal-300">Image Preview</h3>
                                    <img src={`data:${imageFile.mimeType};base64,${imageFile.base64}`} alt="Preview" className="rounded-lg shadow-lg mb-6 mx-auto max-h-96" />
                                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                        <button onClick={handleUploadSubmit} disabled={isLoading} className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-all duration-200">
                                            {isLoading && <LoadingSpinner />}
                                            {isLoading ? 'Analyzing...' : 'Get Explanation'}
                                        </button>
                                        <button onClick={() => setImageFile(null)} className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border border-gray-600 text-base font-medium rounded-md text-gray-300 bg-transparent hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-all duration-200">
                                            Choose a different image
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full max-w-lg">
                                    <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/jpeg, image/png, image/webp, image/gif" />
                                    <div onClick={triggerFileSelect} className="mt-2 flex justify-center rounded-lg border-2 border-dashed border-gray-600 hover:border-blue-500 transition-colors duration-200 px-6 py-10 cursor-pointer">
                                        <div className="text-center">
                                            <UploadIcon />
                                            <p className="mt-4 text-sm leading-6 text-gray-400">Click to upload or drag and drop</p>
                                            <p className="text-xs leading-5 text-gray-500">PNG, JPG, GIF up to 10MB</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'historical':
                 return (
                    <div className="relative animate-fade-in">
                        {renderBackButton('selection')}
                        <div className="flex flex-col items-center pt-10">
                            <div className="w-full max-w-md text-center">
                                <CalendarDaysIcon className="w-12 h-12 mx-auto text-gray-500" />
                                <h2 className="mt-4 text-xl font-semibold text-teal-300">Select a Date</h2>
                                <p className="mt-1 text-sm text-gray-400 mb-6">Choose a past date to view its weather analysis.</p>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    max={getTodayString()}
                                    className="w-full px-4 py-2 rounded-md bg-gray-900 border border-gray-600 text-gray-200 focus:ring-teal-500 focus:border-teal-500 [color-scheme:dark]"
                                    aria-label="Date"
                                />
                                <button
                                    onClick={handleHistoricalSubmit}
                                    disabled={isLoading || !selectedDate}
                                    className="mt-6 w-full inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500 transition-all duration-200"
                                >
                                    {isLoading && <LoadingSpinner />}
                                    {isLoading ? 'Analyzing...' : 'Get Weather Analysis'}
                                </button>
                                <p className="mt-4 text-xs text-gray-500">Note: This is a demo and will show a placeholder image for any selected date.</p>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };


    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
                        AI Weather Explainer
                    </h1>
                    <p className="mt-2 text-lg text-gray-400">
                        Upload a satellite image or select a date to get an expert meteorological analysis.
                    </p>
                </header>

                <main className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 md:p-8 border border-gray-700">
                    {renderContent()}
                    {error && (
                        <ErrorAlert
                            message={error}
                            onDismiss={handleDismissError}
                            onRetry={lastActionIdentifier ? handleRetry : undefined}
                        />
                    )}
                </main>
                
                <ShareModal 
                    isOpen={isShareModalOpen}
                    onClose={handleCloseShareModal}
                    qrCodeDataUrl={qrCodeDataUrl}
                    onDownloadImage={handleDownloadImage}
                    onCopyText={() => handleCopy('text')}
                    onCopyLink={() => handleCopy('link')}
                    onWebShare={handleWebShare}
                    isDownloading={isDownloadingImage}
                    copyStatus={copyStatus}
                />
            </div>
        </div>
    );
};

export default App;
