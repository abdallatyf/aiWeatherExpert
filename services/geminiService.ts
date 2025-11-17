
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { AnalysisResult } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Generates a weather explanation and a visual summary from a satellite image.
 * @param mimeType The MIME type of the image (e.g., 'image/jpeg').
 * @param imageData The Base64 encoded image data.
 * @returns A promise that resolves to an object containing the text explanation and the visual summary image.
 */
export async function explainWeatherFromImage(mimeType: string, imageData: string): Promise<AnalysisResult> {
    try {
        const imagePart = {
            inlineData: {
                mimeType,
                data: imageData,
            },
        };

        // --- Step 1: Get Textual Analysis from Gemini Flash ---
        const textAnalysisPrompt = `You are an expert meteorologist. Provide a detailed, clear explanation of the weather patterns in this satellite image. Describe cloud formations, potential storm activity (like hurricanes or thunderstorms), wind direction, and the overall weather conditions. Be thorough.`;
        
        const textResponsePromise = ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: textAnalysisPrompt }] },
        });

        // --- Step 2: Get Visual Summary from Gemini Flash Image ---
        const visualSummaryPrompt = `You are an expert meteorologist. Generate a new image that visually summarizes your analysis of the provided satellite image. This new image must be the same size as the original. On this new image, draw meteorological symbols and annotations directly onto the original image. Include elements like:
*   Arrows to indicate primary wind directions.
*   Isobars (lines of equal pressure) if applicable.
*   Highlighting of significant storm cells or weather fronts.
*   If there's a hurricane or cyclone, draw its projected path with points indicating future positions and strength.
*   Label key features.`;

        const visualResponsePromise = ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, { text: visualSummaryPrompt }] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        // --- Await both promises concurrently ---
        const [textResponse, visualResponse] = await Promise.all([textResponsePromise, visualResponsePromise]);

        // --- Process Textual Response ---
        const explanation = textResponse.text;
        if (!explanation) {
            throw new Error("The AI did not return a textual analysis.");
        }

        // --- Process Visual Response ---
        let visualSummary = '';
        let visualSummaryMimeType = '';

        const visualPart = visualResponse.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        if (visualPart?.inlineData) {
            visualSummary = visualPart.inlineData.data;
            visualSummaryMimeType = visualPart.inlineData.mimeType;
        }

        if (!visualSummary) {
             throw new Error("The AI did not return a visual summary image.");
        }

        return { explanation, visualSummary, visualSummaryMimeType };

    } catch (error) {
        console.error("Error generating content from Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`An error occurred while analyzing the image: ${error.message}`);
        }
        throw new Error("An unknown error occurred while analyzing the image.");
    }
}
