
export interface ImageFile {
  file: File;
  base64: string;
  mimeType: string;
}

export interface AnalysisResult {
  explanation: string;
  visualSummary: string; // Base64 encoded image
  visualSummaryMimeType: string;
}
