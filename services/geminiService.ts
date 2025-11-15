import { GoogleGenAI, Type } from "@google/genai";

export interface WeatherAnalysis {
  explanation: string;
  windDirection: string;
  temperature: number;
  windSpeed: number;
  location: string;
}

/**
 * Generates a weather explanation from a satellite image.
 * @param mimeType The MIME type of the image (e.g., 'image/jpeg').
 * @param imageData The Base64 encoded image data.
 * @returns A promise that resolves to an object containing the weather explanation, wind direction, temperature, wind speed, and location.
 */
export async function explainWeatherFromImage(mimeType: string, imageData: string): Promise<WeatherAnalysis> {
    const API_KEY = process.env.API_KEY;

    if (!API_KEY) {
        throw new Error("API_KEY environment variable not set. Please set it up.");
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    try {
        const imagePart = {
            inlineData: {
                mimeType,
                data: imageData,
            },
        };

        const textPart = {
            text: "You are a meteorologist. Analyze the weather patterns in this satellite image. Provide a detailed explanation of cloud formations, potential storm activity, and overall conditions. Also, determine the primary wind direction, estimate the wind speed in kilometers per hour, and estimate the approximate surface temperature in Celsius. Finally, identify the geographic location of the weather system shown in the image. Respond with a JSON object containing five keys: 'explanation' (your detailed analysis), 'windDirection' (a cardinal direction like 'N', 'SW', 'E'), 'temperature' (the estimated temperature in Celsius as a number), 'windSpeed' (the estimated wind speed in km/h as a number), and 'location' (the geographic area, e.g., 'Gulf of Mexico near Florida')."
        };
        
        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            explanation: {
              type: Type.STRING,
              description: 'The detailed meteorological analysis of the image.'
            },
            windDirection: {
              type: Type.STRING,
              description: "The primary wind direction as a cardinal direction (e.g., N, NE, E, SE, S, SW, W, NW)."
            },
            temperature: {
              type: Type.NUMBER,
              description: "The estimated surface temperature in Celsius."
            },
            windSpeed: {
              type: Type.NUMBER,
              description: "The estimated wind speed in kilometers per hour (km/h)."
            },
            location: {
              type: Type.STRING,
              description: "The inferred geographic location of the weather system (e.g., 'Gulf of Mexico', 'Eastern Atlantic')."
            }
          },
          required: ['explanation', 'windDirection', 'temperature', 'windSpeed', 'location']
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
              responseMimeType: "application/json",
              responseSchema,
            }
        });

        const jsonResponse = JSON.parse(response.text);
        return jsonResponse;

    } catch (error) {
        console.error("Error generating content from Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`An error occurred while analyzing the image: ${error.message}`);
        }
        throw new Error("An unknown error occurred while analyzing the image.");
    }
}
