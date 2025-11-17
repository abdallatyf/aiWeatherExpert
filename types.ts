
export interface StorableImage {
  base64: string;
  mimeType: string;
}

export interface ImageFile extends StorableImage {
  file: File;
}

export interface AnalysisResult {
  explanation: string;
  visualSummary: string; // Base64 encoded image
  visualSummaryMimeType: string;
}

export interface SavedAnalysis extends AnalysisResult {
  id: string; // e.g., timestamp
  date: string; // The user-selected date or the date of upload
  originalImage: StorableImage;
}
