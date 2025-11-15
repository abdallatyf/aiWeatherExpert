
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Generates a weather explanation from a satellite image.
 * @param mimeType The MIME type of the image (e.g., 'image/jpeg').
 * @param imageData The Base64 encoded image data.
 * @returns A promise that resolves to the weather explanation text.
 */
export async function explainWeatherFromImage(mimeType: string, imageData: string): Promise<string> {
    try {
        const imagePart = {
            inlineData: {
                mimeType,
                data: imageData,
            },
        };

        const textPart = {
            text: "You are a meteorologist. Explain the weather patterns visible in this satellite image. Describe cloud formations, potential storm activity, wind direction, and the overall weather conditions for the geographical area shown. Be detailed and clear in your analysis."
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
        });

        return response.text;
    } catch (error) {
        console.error("Error generating content from Gemini:", error);
        if (error instanceof Error) {
            return `An error occurred while analyzing the image: ${error.message}`;
        }
        return "An unknown error occurred while analyzing the image.";
    }
}
