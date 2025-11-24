import React, { useState, useCallback, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { zlibSync, unzlibSync } from 'fflate';
import { ImageFile, AnalysisResult, SavedAnalysis, StorableImage } from './types';
import { explainWeatherFromImage, analyzeWeatherMotion } from './services/geminiService';
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

const ArrowUturnLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
    </svg>
);

const ArrowUturnRightIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
    </svg>
);

const ArrowPathIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.667 0l3.181-3.183m-4.991-2.691v4.992h-4.992m0 0-3.181-3.183a8.25 8.25 0 0 1 11.667 0l3.181 3.183" />
    </svg>
);

const FilmIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
);

const WindIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 7.5c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 0 1 3.75 3.75v1.5m-5.625 4.5c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 0 1 3.75 3.75v1.5m-5.625 4.5c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 0 1 3.75 3.75v1.5M19.5 7.5c0-1.036-.84-1.875-1.875-1.875h-.375a3.75 3.75 0 0 0-3.75 3.75v1.5m5.625 4.5c0-1.036-.84-1.875-1.875-1.875h-.375a3.75 3.75 0 0 0-3.75 3.75v1.5m5.625 4.5c0-1.036-.84-1.875-1.875-1.875h-.375a3.75 3.75 0 0 0-3.75 3.75v1.5" />
    </svg>
);

const ThermometerIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM13.5 9.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM13.5 12.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM13.5 15.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75h6v6h-6v-6Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a6 6 0 0 0 6-6V9a6 6 0 1 0-12 0v6a6 6 0 0 0 6 6Z" />
    </svg>
);

const CircleStackIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

const CloudRainIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Zm10 4.5v2m0-6v2m-3-2v2m-3-2v2m6 0v2m3-2v2" />
    </svg>
);

const DropIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 5.965-9 9.696-9 13.5a9 9 0 0 0 18 0c0-3.804-3.615-7.535-9-13.5Z" />
    </svg>
);

const WifiIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 19.5h7.5m-7.5 0a2.25 2.25 0 0 0 2.25 2.25h3a2.25 2.25 0 0 0 2.25-2.25m-7.5 0V18a2.25 2.25 0 0 1 2.25-2.25h3A2.25 2.25 0 0 1 15.75 18v1.5M12 12.75h.008v.008H12v-.008Zm0-3.75h.008v.008H12V9Zm0-3.75h.008v.008H12V5.25Zm0 15h.008v.008H12v-.008ZM2.25 12a9.75 9.75 0 0 1 19.5 0M5.25 9.75a6.75 6.75 0 0 1 13.5 0M9.75 12.75a2.25 2.25 0 0 1 4.5 0" />
    </svg>
);

const WifiSlashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M9.75 9.75a6.75 6.75 0 0 1 6.136 3.193M12 12.75a2.25 2.25 0 0 1 1.59 3.818m-7.94-8.818a9.75 9.75 0 0 1 13.504 2.818M2.25 12a9.75 9.75 0 0 1 2.25-6.19" />
    </svg>
);

const ScissorsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 11-5.196-3 3 3 0 015.196 3zm1.536.887a2.165 2.165 0 011.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 11-5.196 3 3 3 0 015.196-3zm1.536-.887a2.165 2.165 0 001.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863l2.077-1.199m0-3.328a4.323 4.323 0 012.068-1.379l5.325-1.628a4.5 4.5 0 012.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.331 4.331 0 0010.607 12m3.736 0l7.794 4.5-.802.215a4.5 4.5 0 01-2.48-.043l-5.326-1.629a4.324 4.324 0 01-2.068-1.379M14.343 12l-2.882 1.664" />
    </svg>
);

// --- SVG Data Structures ---

interface WindVectorData {
    d: string;
    speed: string;
    labelX: number;
    labelY: number;
    opacity: number;
    width: number;
}

interface TempData {
    cx: number;
    cy: number;
    temp: string;
    color: string;
}

interface PressureData {
    d: string;
    label: string;
    labelX: number;
    labelY: number;
}

interface PrecipitationData {
    type: 'rain' | 'snow';
    x: number;
    y: number;
    intensity: 'light' | 'heavy';
}

interface HumidityData {
    cx: number;
    cy: number;
    level: string; // e.g., "85%" or "High"
}

// Placeholder Data simulating parsed AI output
const MOCK_WIND_DATA: WindVectorData[] = [
    { d: "M 10,30 C 20,10 40,10 50,20", speed: "25mph", labelX: 52, labelY: 19, opacity: 0.8, width: 0.7 },
    { d: "M 20,80 C 10,70 10,50 20,40", speed: "30mph", labelX: 22, labelY: 39, opacity: 0.8, width: 0.7 },
    { d: "M 80,80 C 70,90 50,90 40,80", speed: "28mph", labelX: 38, labelY: 79, opacity: 0.8, width: 0.7 },
    { d: "M 80,30 C 90,40 90,60 80,70", speed: "35mph", labelX: 82, labelY: 71, opacity: 0.8, width: 0.7 },
    { d: "M 30,55 C 30,45 40,40 50,45", speed: "45mph", labelX: 52, labelY: 44, opacity: 0.9, width: 0.9 },
    { d: "M 65,65 C 55,70 45,70 40,60", speed: "50mph", labelX: 38, labelY: 59, opacity: 0.9, width: 0.9 },
    { d: "M 50,30 C 60,35 65,45 60,55", speed: "48mph", labelX: 62, labelY: 56, opacity: 0.9, width: 0.9 },
    { d: "M 5,5 L 20,10", speed: "15mph", labelX: 22, labelY: 10, opacity: 0.7, width: 0.6 },
    { d: "M 5,95 L 20,90", speed: "18mph", labelX: 22, labelY: 90, opacity: 0.7, width: 0.6 },
    { d: "M 95,5 L 80,10", speed: "20mph", labelX: 78, labelY: 10, opacity: 0.7, width: 0.6 },
    { d: "M 95,95 L 80,90", speed: "22mph", labelX: 78, labelY: 90, opacity: 0.7, width: 0.6 },
];

const MOCK_TEMP_DATA: TempData[] = [
    { cx: 30, cy: 45, temp: "32°C", color: "#ff4500" },
    { cx: 65, cy: 68, temp: "14°C", color: "#1e90ff" },
    { cx: 50, cy: 20, temp: "26°C", color: "#ff8c00" },
    { cx: 80, cy: 30, temp: "19°C", color: "#87ceeb" },
    { cx: 45, cy: 55, temp: "-5°C", color: "#ffffff" },
];

const MOCK_PRESSURE_DATA: PressureData[] = [
    { d: "M 10,10 C 40,50 60,0 90,40", label: "1012mb", labelX: 12, labelY: 10 },
    { d: "M 15,20 C 45,60 65,10 95,50", label: "1008mb", labelX: 17, labelY: 20 },
];

const MOCK_PRECIPITATION_DATA: PrecipitationData[] = [
    { type: 'rain', x: 25, y: 50, intensity: 'heavy' },
    { type: 'rain', x: 28, y: 55, intensity: 'light' },
    { type: 'rain', x: 35, y: 48, intensity: 'heavy' },
    { type: 'snow', x: 45, y: 60, intensity: 'light' },
    { type: 'snow', x: 42, y: 65, intensity: 'heavy' },
];

const MOCK_HUMIDITY_DATA: HumidityData[] = [
    { cx: 15, cy: 35, level: "85%" },
    { cx: 75, cy: 85, level: "92%" },
    { cx: 55, cy: 15, level: "45%" },
];


// --- WeatherOverlay Component ---
// This component renders a data-driven SVG overlay.
const WeatherOverlay: React.FC<{ 
    showWind: boolean; 
    showTemp: boolean; 
    showPressure: boolean;
    showPrecipitation: boolean;
    showHumidity: boolean;
}> = ({ showWind, showTemp, showPressure, showPrecipitation, showHumidity }) => {
    return (
        <div className="absolute inset-0 pointer-events-none z-10">
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
                <defs>
                    <marker id="arrowhead" markerWidth="4" markerHeight="3" refX="0" refY="1.5" orient="auto">
                        <polygon points="0 0, 4 1.5, 0 3" fill="#00ffff" />
                    </marker>
                    <filter id="text-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" />
                        <feOffset dx="0.5" dy="0.5" result="offsetblur" />
                        <feComponentTransfer>
                            <feFuncA type="linear" slope="0.8" />
                        </feComponentTransfer>
                        <feMerge>
                            <feMergeNode />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Wind Vectors */}
                {showWind && (
                    <g className="wind-layer">
                        {MOCK_WIND_DATA.map((item, index) => (
                            <g key={`wind-${index}`}>
                                <path
                                    d={item.d}
                                    stroke="#00ffff"
                                    strokeOpacity={item.opacity}
                                    strokeWidth={item.width}
                                    fill="none"
                                    markerEnd="url(#arrowhead)"
                                    vectorEffect="non-scaling-stroke"
                                />
                                <text
                                    x={item.labelX}
                                    y={item.labelY}
                                    fontSize="2.5"
                                    fill="#00ffff"
                                    className="font-sans font-semibold"
                                    filter="url(#text-shadow)"
                                    style={{ textAnchor: 'middle' }}
                                >
                                    {item.speed}
                                </text>
                            </g>
                        ))}
                    </g>
                )}

                {/* Temperature Readings */}
                {showTemp && (
                    <g className="temp-layer">
                        {MOCK_TEMP_DATA.map((item, index) => (
                            <g key={`temp-${index}`}>
                                <circle cx={item.cx} cy={item.cy} r="4" fill={item.color} fillOpacity="0.4" stroke="white" strokeWidth="0.2" />
                                <text
                                    x={item.cx}
                                    y={item.cy}
                                    dy="1.2"
                                    fontSize="2.5"
                                    fill="white"
                                    className="font-bold"
                                    filter="url(#text-shadow)"
                                    style={{ textAnchor: 'middle' }}
                                >
                                    {item.temp}
                                </text>
                            </g>
                        ))}
                    </g>
                )}

                {/* Pressure Isobars */}
                {showPressure && (
                    <g className="pressure-layer">
                        {MOCK_PRESSURE_DATA.map((item, index) => (
                            <g key={`pressure-${index}`}>
                                <path
                                    d={item.d}
                                    stroke="white"
                                    strokeWidth="0.4"
                                    strokeDasharray="2,1"
                                    fill="none"
                                    vectorEffect="non-scaling-stroke"
                                />
                                <text
                                    x={item.labelX}
                                    y={item.labelY}
                                    fontSize="2"
                                    fill="white"
                                    filter="url(#text-shadow)"
                                >
                                    {item.label}
                                </text>
                            </g>
                        ))}
                    </g>
                )}

                {/* Precipitation */}
                {showPrecipitation && (
                    <g className="precip-layer">
                        {MOCK_PRECIPITATION_DATA.map((item, index) => {
                            const isHeavy = item.intensity === 'heavy';
                            const scale = isHeavy ? 0.8 : 0.4;
                            const rainColor = isHeavy ? "#2563eb" : "#93c5fd"; // Darker blue for heavy
                            const snowSize = isHeavy ? "7" : "4";

                            return (
                                <g key={`precip-${index}`} transform={`translate(${item.x}, ${item.y})`}>
                                    {item.type === 'rain' ? (
                                         <path 
                                            d="M0,0 c-1.5,3 -2.5,4.5 -2.5,6.5 a2.5,2.5 0 0,0 5,0 c0,-2 -1,-3.5 -2.5,-6.5 Z" 
                                            fill={rainColor} 
                                            stroke="white" 
                                            strokeWidth="0.2" 
                                            transform={`scale(${scale})`} 
                                            filter="url(#text-shadow)"
                                        />
                                    ) : (
                                         <text 
                                            x="0" 
                                            y="0" 
                                            fontSize={snowSize} 
                                            fill="white" 
                                            filter="url(#text-shadow)"
                                        >
                                            ❄️
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </g>
                )}

                {/* Humidity */}
                {showHumidity && (
                    <g className="humidity-layer">
                        {MOCK_HUMIDITY_DATA.map((item, index) => (
                             <g key={`humid-${index}`} transform={`translate(${item.cx}, ${item.cy})`}>
                                 <circle cx="0" cy="0" r="3" fill="#14b8a6" fillOpacity="0.4" stroke="white" strokeWidth="0.2"/>
                                 <path d="M0,-2 c-1.5,1.5 -2,2.5 -2,3.5 a2,2 0 0,0 4,0 c0,-1 -0.5,-2 -2,-3.5 Z" fill="#ccfbf1" transform="translate(0, -1) scale(0.6)" />
                                 <text x="0" y="3" fontSize="2" fill="white" textAnchor="middle" filter="url(#text-shadow)">{item.level}</text>
                             </g>
                        ))}
                    </g>
                )}
            </svg>
        </div>
    );
};

// --- Extracted Components ---

interface ImageUploaderProps {
    imageFile: ImageFile | null;
    onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    title: string;
    id: string;
    inputRef: React.RefObject<HTMLInputElement>;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ imageFile, onImageChange, title, id, inputRef }) => (
    <div className="flex-1">
        <h3 className="text-lg font-medium text-center text-gray-300">{title}</h3>
        <div className="mt-2 flex justify-center rounded-lg border-2 border-dashed border-gray-600 px-6 py-10 hover:border-gray-500 transition-colors">
            <div className="text-center">
                <UploadIcon />
                <div className="mt-4 flex text-sm leading-6 text-gray-400">
                    <label htmlFor={id} className="relative cursor-pointer rounded-md font-semibold text-orange-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 hover:text-orange-300">
                        <span>Upload a file</span>
                        <input id={id} name={id} type="file" className="sr-only" onChange={onImageChange} accept="image/png, image/jpeg, image/webp, image/gif" ref={inputRef} />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs leading-5 text-gray-500">PNG, JPG, GIF, WEBP up to 10MB</p>
            </div>
        </div>
        {imageFile && (
            <div className="mt-4 text-center">
                <img src={`data:${imageFile.mimeType};base64,${imageFile.base64}`} alt="Preview" className="mx-auto max-h-32 rounded-lg shadow-lg" />
                <p className="mt-2 text-sm text-gray-400 truncate">{imageFile.file.name}</p>
            </div>
        )}
    </div>
);

const ImageLoadingSpinner = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
        <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

interface OverlayControlsProps {
    showWind: boolean;
    setShowWind: (v: boolean) => void;
    showTemp: boolean;
    setShowTemp: (v: boolean) => void;
    showPressure: boolean;
    setShowPressure: (v: boolean) => void;
    showPrecipitation: boolean;
    setShowPrecipitation: (v: boolean) => void;
    showHumidity: boolean;
    setShowHumidity: (v: boolean) => void;
}

const OverlayControls: React.FC<OverlayControlsProps> = ({ 
    showWind, setShowWind, 
    showTemp, setShowTemp, 
    showPressure, setShowPressure,
    showPrecipitation, setShowPrecipitation,
    showHumidity, setShowHumidity
}) => {
    const buttonClass = (isActive: boolean) => `p-2 rounded-full transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-900/70 text-gray-300 hover:bg-gray-700'}`;
    return (
        <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2">
            <button onClick={() => setShowWind(!showWind)} className={buttonClass(showWind)} title="Toggle Wind Speed">
                <WindIcon className="w-5 h-5" />
            </button>
            <button onClick={() => setShowTemp(!showTemp)} className={buttonClass(showTemp)} title="Toggle Temperature">
                <ThermometerIcon className="w-5 h-5" />
            </button>
            <button onClick={() => setShowPressure(!showPressure)} className={buttonClass(showPressure)} title="Toggle Pressure">
                <CircleStackIcon className="w-5 h-5" />
            </button>
            <button onClick={() => setShowPrecipitation(!showPrecipitation)} className={buttonClass(showPrecipitation)} title="Toggle Precipitation">
                <CloudRainIcon className="w-5 h-5" />
            </button>
            <button onClick={() => setShowHumidity(!showHumidity)} className={buttonClass(showHumidity)} title="Toggle Humidity">
                <DropIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

const RegionSelector: React.FC<{
    imageSrc: string;
    onAnalyze: (processedImageBase64: string) => void;
    onCancel: () => void;
}> = ({ imageSrc, onAnalyze, onCancel }) => {
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
    const [selection, setSelection] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    const getRelCoords = (e: MouseEvent | React.MouseEvent) => {
        if (!imageRef.current) return { x: 0, y: 0 };
        const rect = imageRef.current.getBoundingClientRect();
        const clientX = e.clientX;
        const clientY = e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        // Clamp to image bounds
        return {
            x: Math.max(0, Math.min(x, rect.width)),
            y: Math.max(0, Math.min(y, rect.height))
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const coords = getRelCoords(e);
        setStartPos(coords);
        setCurrentPos(coords);
        setIsDragging(true);
        setSelection(null); // Reset selection on new drag
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const coords = getRelCoords(e);
            setCurrentPos(coords);
            
            const x = Math.min(startPos.x, coords.x);
            const y = Math.min(startPos.y, coords.y);
            const w = Math.abs(coords.x - startPos.x);
            const h = Math.abs(coords.y - startPos.y);
            
            setSelection({ x, y, w, h });
        };

        const handleMouseUp = () => {
            if (isDragging) setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, startPos]);

    const handleCropAndAnalyze = () => {
        if (!selection || selection.w < 10 || selection.h < 10 || !imageRef.current) {
            // If selection is too small or non-existent, just analyze the whole image
            onAnalyze(imageSrc);
            return;
        }

        const canvas = document.createElement('canvas');
        const img = imageRef.current;
        const scaleX = img.naturalWidth / img.width;
        const scaleY = img.naturalHeight / img.height;

        const realX = selection.x * scaleX;
        const realY = selection.y * scaleY;
        const realW = selection.w * scaleX;
        const realH = selection.h * scaleY;

        canvas.width = realW;
        canvas.height = realH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw cropped image
        ctx.drawImage(img, realX, realY, realW, realH, 0, 0, realW, realH);
        
        const croppedBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
        onAnalyze(croppedBase64);
    };

    return (
        <div className="flex flex-col h-full w-full items-center justify-center bg-black/90 p-4 relative">
             <div className="absolute top-4 left-0 right-0 text-center pointer-events-none z-20">
                 <span className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm border border-gray-600">
                    Drag to select a region to analyze
                 </span>
            </div>
            
            <div 
                ref={containerRef} 
                className="relative cursor-crosshair max-w-full max-h-[70vh]"
                onMouseDown={handleMouseDown}
            >
                <img 
                    ref={imageRef}
                    src={`data:image/jpeg;base64,${imageSrc}`} 
                    alt="Capture to crop" 
                    className="max-w-full max-h-[70vh] object-contain select-none"
                    draggable={false}
                />
                
                {/* Overlay for unselected areas (simple version: just the selection box) */}
                {selection && (
                    <div 
                        className="absolute border-2 border-cyan-400 bg-cyan-400/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] z-10"
                        style={{
                            left: selection.x,
                            top: selection.y,
                            width: selection.w,
                            height: selection.h
                        }}
                    >
                         {/* Dimensions label */}
                         <div className="absolute -top-6 left-0 bg-cyan-600 text-xs text-white px-1 rounded">
                             {Math.round(selection.w)} x {Math.round(selection.h)}
                         </div>
                    </div>
                )}
            </div>

            <div className="mt-6 flex space-x-4 z-20">
                <button 
                    onClick={onCancel}
                    className="px-6 py-2 rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 font-medium transition-colors"
                >
                    Retake
                </button>
                <button 
                    onClick={() => onAnalyze(imageSrc)}
                    className="px-6 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 font-medium transition-colors"
                >
                    Analyze Full Screen
                </button>
                <button 
                    onClick={handleCropAndAnalyze}
                    disabled={!selection || selection.w < 10}
                    className={`px-6 py-2 rounded-md text-white font-medium transition-colors flex items-center ${(!selection || selection.w < 10) ? 'bg-gray-600 cursor-not-allowed opacity-50' : 'bg-purple-600 hover:bg-purple-700'}`}
                >
                    <ScissorsIcon className="w-5 h-5 mr-2"/> Analyze Selection
                </button>
            </div>
        </div>
    );
};

const ImageViewer: React.FC<{ original: StorableImage, summary: StorableImage }> = ({ original, summary }) => {
    const [viewMode, setViewMode] = useState<'side-by-side' | 'toggle'>('side-by-side');
    const [showSummaryInToggle, setShowSummaryInToggle] = useState(true);
    const [isOriginalLoaded, setOriginalLoaded] = useState(false);
    const [isSummaryLoaded, setSummaryLoaded] = useState(false);
    
    // Toggle States
    const [showWind, setShowWind] = useState(false);
    const [showTemp, setShowTemp] = useState(false);
    const [showPressure, setShowPressure] = useState(false);
    const [showPrecipitation, setShowPrecipitation] = useState(false);
    const [showHumidity, setShowHumidity] = useState(false);

    const showLoader = !isOriginalLoaded || !isSummaryLoaded;

    const overlayProps = { showWind, showTemp, showPressure, showPrecipitation, showHumidity };

    return (
        <div className="relative w-full aspect-square border border-gray-700 rounded-lg overflow-hidden bg-black">
            {showLoader && <ImageLoadingSpinner />}
            <OverlayControls
                showWind={showWind} setShowWind={setShowWind}
                showTemp={showTemp} setShowTemp={setShowTemp}
                showPressure={showPressure} setShowPressure={setShowPressure}
                showPrecipitation={showPrecipitation} setShowPrecipitation={setShowPrecipitation}
                showHumidity={showHumidity} setShowHumidity={setShowHumidity}
            />

            {viewMode === 'toggle' ? (
                <div className="absolute inset-0 w-full h-full">
                    <img
                        src={`data:${original.mimeType};base64,${original.base64}`}
                        alt="Original satellite"
                        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${showSummaryInToggle ? 'opacity-0' : 'opacity-100'}`}
                        onLoad={() => setOriginalLoaded(true)}
                    />
                    <div className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${showSummaryInToggle ? 'opacity-0' : 'opacity-100'}`}>
                        <WeatherOverlay {...overlayProps} />
                    </div>

                    <img
                        src={`data:${summary.mimeType};base64,${summary.base64}`}
                        alt="AI visual summary"
                        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${showSummaryInToggle ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={() => setSummaryLoaded(true)}
                    />
                    <div className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${showSummaryInToggle ? 'opacity-100' : 'opacity-0'}`}>
                        <WeatherOverlay {...overlayProps} />
                    </div>
                </div>
            ) : (
                <div className="absolute inset-0 flex h-full w-full">
                    <div className="relative w-1/2 h-full border-r border-gray-600/50">
                        <img
                            src={`data:${original.mimeType};base64,${original.base64}`}
                            alt="Original satellite"
                            className="w-full h-full object-contain"
                            onLoad={() => setOriginalLoaded(true)}
                        />
                        <WeatherOverlay {...overlayProps} />
                        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">Original</div>
                    </div>
                    <div className="relative w-1/2 h-full">
                        <img
                            src={`data:${summary.mimeType};base64,${summary.base64}`}
                            alt="AI visual summary"
                            className="w-full h-full object-contain"
                            onLoad={() => setSummaryLoaded(true)}
                        />
                        <WeatherOverlay {...overlayProps} />
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">AI Summary</div>
                    </div>
                </div>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-2 z-10">
                <div className="bg-gray-900/70 backdrop-blur-sm p-1 rounded-full flex items-center space-x-1">
                    <button onClick={() => setViewMode('side-by-side')} className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${viewMode === 'side-by-side' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Compare</button>
                    <button onClick={() => setViewMode('toggle')} className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${viewMode === 'toggle' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Toggle</button>
                </div>

                {viewMode === 'toggle' && (
                    <div className="bg-gray-900/70 backdrop-blur-sm p-1 rounded-full flex items-center space-x-1 animate-fade-in">
                        <button onClick={() => setShowSummaryInToggle(false)} className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${!showSummaryInToggle ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Original</button>
                        <button onClick={() => setShowSummaryInToggle(true)} className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${showSummaryInToggle ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>AI Summary</button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface PermissionModalProps {
    onCancel: () => void;
    onConfirm: () => void;
}

const PermissionModal: React.FC<PermissionModalProps> = ({ onCancel, onConfirm }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full text-center border border-yellow-600/50">
            <ComputerDesktopIcon className="w-16 h-16 mx-auto text-yellow-400" />
            <h2 id="modal-title" className="mt-4 text-2xl font-bold text-white">Permission Required</h2>
            <p className="mt-2 text-gray-400">
                To analyze the live map, this app needs permission to view your screen.
                This is a one-time capture and is not recorded.
            </p>
            <div className="mt-6 flex justify-center gap-4">
                <button
                    onClick={onCancel}
                    className="px-6 py-2 rounded-md text-base font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-all"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className="px-6 py-2 rounded-md text-base font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500 transition-all"
                >
                    Grant Permission
                </button>
            </div>
        </div>
    </div>
);


// --- Main App Component ---

type AppMode = 'home' | 'upload' | 'historical' | 'viewing' | 'sharing' | 'saved' | 'webCapture' | 'motion';
const DEFAULT_MAP_URL = 'https://zoom.earth/maps/satellite/#view=7.389094,124.063201,9z/overlays=radar';

export default function App() {
    const [mode, setMode] = useState<AppMode>('home');
    const [imageFile, setImageFile] = useState<ImageFile | null>(null);
    const [imageFile1, setImageFile1] = useState<ImageFile | null>(null); // For motion analysis
    const [imageFile2, setImageFile2] = useState<ImageFile | null>(null); // For motion analysis
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
    const [isMapInteracted, setIsMapInteracted] = useState(false);
    const [lastFailedAction, setLastFailedAction] = useState<(() => Promise<void>) | null>(null);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [liveMapUrlInput, setLiveMapUrlInput] = useState<string>(DEFAULT_MAP_URL);
    const [currentIframeUrl, setCurrentIframeUrl] = useState<string>(DEFAULT_MAP_URL);
    const [isIframeLoading, setIsIframeLoading] = useState(false);
    const [iframeLoadError, setIframeLoadError] = useState<string | null>(null);
    
    // Capture & Crop State
    const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    
    // Offline Support State
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [offlineSnapshot, setOfflineSnapshot] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileInput1Ref = useRef<HTMLInputElement>(null);
    const fileInput2Ref = useRef<HTMLInputElement>(null);
    const iframeLoadTimeoutRef = useRef<number | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);


    // --- Data Persistence ---
    const saveAnalysis = useCallback((analysis: SavedAnalysis) => {
        setSavedAnalyses(prev => {
            // Check if it already exists
            if (prev.some(a => a.id === analysis.id)) {
                return prev;
            }

            // Prepend the new analysis to the list
            let updatedAnalyses = [analysis, ...prev];

            const attemptToSave = (analysesToSave: SavedAnalysis[]): boolean => {
                try {
                    localStorage.setItem('savedAnalyses', JSON.stringify(analysesToSave));
                    return true;
                } catch (e) {
                    // Check for QuotaExceededError across browsers
                    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                        return false;
                    }
                    console.error("An unexpected error occurred while saving to localStorage:", e);
                    setError("Could not save the analysis due to an unexpected storage error.");
                    return true; // Stop trying on unexpected errors
                }
            };

            // First attempt to save the full list
            if (attemptToSave(updatedAnalyses)) {
                if (error?.startsWith("Storage is full")) setError(null); // Clear any previous storage warnings
                return updatedAnalyses;
            }

            // If it fails, start evicting old analyses
            console.warn("LocalStorage quota exceeded. Evicting oldest analyses.");
            const warningMessage = "Storage is full. Removing oldest analysis to make space...";
            setError(warningMessage);

            // Make a mutable copy to pop from
            const analysesForEviction = [...updatedAnalyses];
            
            // Loop until we can save or we only have the new item left
            while (analysesForEviction.length > 1) {
                analysesForEviction.pop(); // Remove the oldest item
                if (attemptToSave(analysesForEviction)) {
                    // Success! Update the state.
                    setTimeout(() => {
                        // Clear the warning only if it hasn't been replaced by another error
                        setError(currentError => currentError === warningMessage ? null : currentError);
                    }, 3000);
                    return analysesForEviction;
                }
            }

            // If we're here, we couldn't even save the single new analysis
            setError("Could not save analysis. The image data is too large for browser storage.");
            // We failed to save the new one, so revert to the previous state.
            return prev;
        });
    }, [error]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('savedAnalyses');
            if (stored) {
                setSavedAnalyses(JSON.parse(stored));
            }
            // Load offline snapshot
            const storedSnapshot = localStorage.getItem('offlineMapSnapshot');
            if (storedSnapshot) {
                setOfflineSnapshot(storedSnapshot);
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

    // --- Network Status Listener ---
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // --- Event Handlers ---

    const handleBack = () => {
        if (mode === 'upload' || mode === 'historical' || mode === 'saved' || mode === 'webCapture' || mode === 'motion') {
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
        setIsCropping(false);
        setCapturedImageBase64(null);
    };

    const handleImageFileChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        setImage: React.Dispatch<React.SetStateAction<ImageFile | null>>,
        inputRef: React.RefObject<HTMLInputElement>
    ) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const supportedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
            const maxSizeInMB = 10;
            const maxSize = maxSizeInMB * 1024 * 1024;

            const resetAndError = (message: string) => {
                setError(message);
                setImage(null);
                setLastFailedAction(null);
                if (inputRef.current) {
                    inputRef.current.value = '';
                }
            };

            if (!supportedTypes.includes(file.type)) {
                resetAndError(`Unsupported file type: '${file.type}'. Please upload a PNG, JPG, WEBP, or GIF.`);
                return;
            }

            if (file.size > maxSize) {
                resetAndError(`File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Please upload an image under ${maxSizeInMB} MB.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    const base64 = (event.target.result as string).split(',')[1];
                    setImage({ file: file, base64, mimeType: file.type });
                    setError(null);
                    setLastFailedAction(null);
                }
            };
            reader.onerror = () => {
                resetAndError("Could not read the selected file. It might be corrupted.");
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
                // NOTE: We no longer auto-save here. User must click "Save Analysis".
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

    }, [imageFile]);

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
                // NOTE: We no longer auto-save here. User must click "Save Analysis".
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
    }, [selectedDate]);
    
    // Updated function to start the capture and then show the crop UI
    const handleStartCapture = useCallback(async () => {
        if (!isOnline) {
            setError("You cannot capture a new analysis while offline.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setLastFailedAction(null);
        setAnalysisResult(null);
        setShowPermissionModal(false); 

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
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
            
            // Cache locally immediately in case they refresh
            try {
                localStorage.setItem('offlineMapSnapshot', base64);
                setOfflineSnapshot(base64);
            } catch (e) {
                console.warn("Could not save offline snapshot due to storage quota.");
            }

            setCapturedImageBase64(base64);
            setIsCropping(true); // Switch to crop mode

        } catch (err) {
            if (err instanceof DOMException && err.name === 'NotAllowedError') {
                setShowPermissionModal(true);
            } else {
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during capture.";
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    }, [isOnline]);


    const handleFinalizeAnalysis = useCallback(