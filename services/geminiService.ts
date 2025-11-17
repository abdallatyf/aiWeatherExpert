import { GoogleGenAI, Modality } from "@google/genai";
import { AnalysisResult } from '../types';

/**
 * Creates and returns a GoogleGenAI client instance.
 * It ensures the API key is available from the environment variables.
 * @throws {Error} if the API key is not configured.
 * @returns {GoogleGenAI} An instance of the GoogleGenAI client.
 */
function getGeminiClient(): GoogleGenAI {
    if (!process.env.API_KEY) {
        throw new Error("The Gemini API key is not configured. Please make sure it's set up correctly.");
    }
    // Directly use the environment variable as per the best practice guidelines.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

/**
 * Generates a weather explanation and a visual summary from a satellite image.
 * @param mimeType The MIME type of the image (e.g., 'image/jpeg').
 * @param imageData The Base64 encoded image data.
 * @returns A promise that resolves to an object containing the text explanation and the visual summary image.
 */
export async function explainWeatherFromImage(mimeType: string, imageData: string): Promise<AnalysisResult> {
    try {
        const ai = getGeminiClient();
        
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
        // Defensively access '.text' and check for a valid explanation, guarding against a nullish response object.
        const explanation = textResponse?.text;
        if (!explanation) {
            const finishReason = textResponse?.candidates?.[0]?.finishReason;
            const message = finishReason === 'SAFETY'
                ? "The analysis was blocked due to safety settings. Please try a different image."
                : "The AI did not return a textual analysis. The response may have been empty or incomplete.";
            throw new Error(message);
        }

        // --- Process Visual Response ---
        // Defensively parse the response to find the visual data, guarding against malformed or incomplete structures.
        const visualPart = visualResponse?.candidates?.[0]?.content?.parts?.find(
            (part) => part?.inlineData
        );
        
        const visualData = visualPart?.inlineData?.data;
        const visualMimeType = visualPart?.inlineData?.mimeType;

        if (!visualData || !visualMimeType) {
            const finishReason = visualResponse?.candidates?.[0]?.finishReason;
            const message = finishReason === 'SAFETY'
                ? "The visual summary was blocked due to safety settings. Please try a different image."
                : "The AI did not return a complete visual summary. The response may have been missing image data or a MIME type.";
            throw new Error(message);
        }

        const visualSummary = visualData;
        const visualSummaryMimeType = visualMimeType;

        return { explanation, visualSummary, visualSummaryMimeType };

    } catch (error) {
        console.error("Error generating content from Gemini:", error);

        let userMessage = "An unknown error occurred while analyzing the image. Please check the console for details.";

        if (error instanceof Error) {
            const errorMessage = error.message.toLowerCase();
            
            // Check for specific keywords from the Gemini API error messages
            if (errorMessage.includes('api key not valid') || errorMessage.includes('permission denied')) {
                userMessage = "API Key Error: The provided API key is invalid or lacks the necessary permissions. Please check your configuration.";
            } else if (errorMessage.includes('rate limit')) {
                userMessage = "Rate Limit Exceeded: Too many requests have been sent in a short period. Please wait a moment before trying again.";
            } else if (errorMessage.includes('network error') || errorMessage.includes('failed to fetch')) {
                userMessage = "Network Error: Could not connect to the analysis service. Please check your internet connection and try again.";
            } else if (errorMessage.includes('deadline exceeded') || errorMessage.includes('timeout')) {
                userMessage = "Request Timed Out: The analysis took too long to complete. This might be due to a server issue. Please try again later.";
            } else if (errorMessage.includes('resource exhausted')) {
                userMessage = "Resource Exhausted: The system is currently under heavy load. Please try again in a few moments.";
            } else {
                // Use the original error message if it's not one of the common cases but still informative.
                userMessage = error.message;
            }
        }

        throw new Error(userMessage);
    }
}

/**
 * Generates a weather motion analysis by comparing two sequential satellite images.
 * @param mimeType1 MIME type of the first image.
 * @param imageData1 Base64 data of the first image.
 * @param mimeType2 MIME type of the second image.
 * @param imageData2 Base64 data of the second image.
 * @returns A promise that resolves to an AnalysisResult.
 */
export async function analyzeWeatherMotion(
    mimeType1: string,
    imageData1: string,
    mimeType2: string,
    imageData2: string
): Promise<AnalysisResult> {
     try {
        const ai = getGeminiClient();
        
        const imagePart1 = { inlineData: { mimeType: mimeType1, data: imageData1 } };
        const imagePart2 = { inlineData: { mimeType: mimeType2, data: imageData2 } };

        // --- Step 1: Get Textual Motion Analysis ---
        const textAnalysisPrompt = `You are an expert meteorologist. Analyze the motion and changes between these two satellite images, which are sequential in time (Image 1 is the start, Image 2 is the end). Provide a detailed analysis covering:
1.  **Movement:** Describe the direction and estimated speed of the primary weather system (e.g., hurricane, storm front).
2.  **Intensity Change:** Has the system intensified or weakened? Look for changes in cloud top temperature, structure, and rotation.
3.  **Structural Change:** Describe any changes in the storm's size, shape, or features like the eye-wall or rain bands.
4.  **Forecast:** Based on the observed motion and changes, provide a short-term forecast of its likely path and intensity development.`;
        
        const textResponsePromise = ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart1, imagePart2, { text: textAnalysisPrompt }] },
        });

        // --- Step 2: Get Visual Motion Summary ---
        const visualSummaryPrompt = `You are an expert meteorologist. Generate a new image that visually summarizes the motion between the two provided satellite images. This new image must be the same size as the originals. On the SECOND image, draw meteorological symbols and annotations to illustrate the changes:
*   Use bold arrows to show the primary direction of movement of the storm's center or key features.
*   Draw a projected path line extending from the storm's current position.
*   Use color-coding or symbols to highlight areas of significant intensification (e.g., red circles) or weakening (e.g., blue circles).
*   Outline the storm's position from the FIRST image as a faint, dashed line on top of the second image to clearly show the displacement.`;

        const visualResponsePromise = ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart1, imagePart2, { text: visualSummaryPrompt }] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        // --- Await both promises concurrently ---
        const [textResponse, visualResponse] = await Promise.all([textResponsePromise, visualResponsePromise]);
        
        const explanation = textResponse?.text;
        if (!explanation) {
            throw new Error("The AI did not return a textual motion analysis.");
        }

        const visualPart = visualResponse?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!visualPart?.inlineData?.data || !visualPart?.inlineData?.mimeType) {
            throw new Error("The AI did not return a complete visual motion summary.");
        }

        return {
            explanation,
            visualSummary: visualPart.inlineData.data,
            visualSummaryMimeType: visualPart.inlineData.mimeType,
        };

    } catch (error) {
        console.error("Error analyzing weather motion from Gemini:", error);
        const userMessage = error instanceof Error ? error.message : "An unknown error occurred during motion analysis.";
        throw new Error(userMessage);
    }
}
