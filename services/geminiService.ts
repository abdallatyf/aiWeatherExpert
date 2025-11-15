import { GoogleGenAI, Type, Modality } from "@google/genai";

export interface StormTrackPoint {
  hours: number;
  intensity: string;
  x: number;
  y: number;
}

export interface AnomalyStreak {
  points: {x: number; y: number}[];
  description: string;
}

export interface StormSurgeForecast {
  surgeHeight: number;
  affectedArea: {x: number; y: number}[];
}

export interface WeatherAnalysis {
  explanation: string;
  windDirection: string;
  temperature: number;
  windSpeed: number;
  location: string;
  chanceOfPrecipitation: number;
  humidity: number;
  uvIndex: number;
  stormTrack?: StormTrackPoint[];
  anomalyStreaks?: AnomalyStreak[];
  stormSurge?: StormSurgeForecast;
}

/**
 * Generates a weather explanation from a satellite image.
 * @param mimeType The MIME type of the image (e.g., 'image/jpeg').
 * @param imageData The Base64 encoded image data.
 * @returns A promise that resolves to an object containing the weather explanation and various data points.
 */
export async function explainWeatherFromImage(mimeType: string, imageData: string): Promise<WeatherAnalysis> {
    const API_KEY = "AIzaSyACjqYWF14Uc1ucaG3FTLhhNdhPS89eb0s";

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
            text: "You are a meteorologist. Analyze the weather patterns in this satellite image. Provide a detailed explanation of cloud formations and overall conditions. Determine the primary wind direction, estimate wind speed in km/h, surface temperature in Celsius, chance of precipitation (%), humidity (%), and UV index. Identify the geographic location. Additionally, if there is a trackable storm system (like a hurricane), provide a predicted track for the next 48 hours as a 'stormTrack' array. Each point in the array should contain 'hours' (forecast hour, e.g., 12), 'intensity' (e.g., 'Category 1 Hurricane'), and its 'x' and 'y' coordinates as a percentage of the image dimensions (0-100). If there are any significant atmospheric anomalies like shear lines, dry air intrusions, or unusual convective bursts, identify them as 'anomalyStreaks'. Also, look for smaller-scale phenomena like potential microbursts or localized downdrafts, describing them with more granular detail. Each streak should be a polygon represented by an array of 'points' (with 'x' and 'y' coordinates as percentages) and a brief 'description'. If a major coastal storm or hurricane is detected, also provide a 'stormSurge' forecast, including 'surgeHeight' in meters and an 'affectedArea' polygon (an array of {x, y} percentage coordinates) outlining the threatened coastline. If no significant surge is expected, this field can be omitted. If no trackable storm or anomalies are present, return empty arrays for 'stormTrack' and 'anomalyStreaks'. If the image is not a weather map, set 'explanation' to 'ERROR: Not a weather map' and other fields to default values."
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
            },
            chanceOfPrecipitation: {
              type: Type.NUMBER,
              description: "The estimated chance of precipitation as a percentage (0-100)."
            },
            humidity: {
              type: Type.NUMBER,
              description: "The estimated relative humidity as a percentage (0-100)."
            },
            uvIndex: {
              type: Type.NUMBER,
              description: "The estimated UV index (e.g., a number from 0 to 11+)."
            },
            stormTrack: {
              type: Type.ARRAY,
              description: "An array of predicted storm track points for the next 48 hours. Empty if no storm is detected.",
              items: {
                type: Type.OBJECT,
                properties: {
                  hours: { type: Type.NUMBER, description: "Forecast hour from now (e.g., 12, 24)." },
                  intensity: { type: Type.STRING, description: "Predicted storm intensity (e.g., 'Tropical Storm', 'Category 3 Hurricane')." },
                  x: { type: Type.NUMBER, description: "Predicted X coordinate as a percentage of image width." },
                  y: { type: Type.NUMBER, description: "Predicted Y coordinate as a percentage of image height." }
                },
                required: ['hours', 'intensity', 'x', 'y']
              }
            },
            anomalyStreaks: {
              type: Type.ARRAY,
              description: "An array of detected atmospheric anomalies, including large-scale streaks (shear lines, etc.) and smaller-scale phenomena like microbursts or localized downdrafts. Empty if none are detected.",
              items: {
                type: Type.OBJECT,
                properties: {
                  points: {
                    type: Type.ARRAY,
                    description: "An array of {x, y} coordinates defining the polygon of the anomaly.",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        x: { type: Type.NUMBER, description: "X coordinate as a percentage of image width." },
                        y: { type: Type.NUMBER, description: "Y coordinate as a percentage of image height." }
                      },
                      required: ['x', 'y']
                    }
                  },
                  description: { type: Type.STRING, description: "A brief description of the anomaly." }
                },
                required: ['points', 'description']
              }
            },
            stormSurge: {
              type: Type.OBJECT,
              description: "A forecast for storm surge if a major coastal storm is detected. Omitted if not applicable.",
              properties: {
                surgeHeight: { type: Type.NUMBER, description: "The estimated maximum storm surge height in meters." },
                affectedArea: {
                  type: Type.ARRAY,
                  description: "A polygon representing the coastal area affected by the surge.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER, description: "X coordinate as a percentage of image width." },
                      y: { type: Type.NUMBER, description: "Y coordinate as a percentage of image height." }
                    },
                    required: ['x', 'y']
                  }
                }
              },
              required: ['surgeHeight', 'affectedArea']
            }
          },
          required: ['explanation', 'windDirection', 'temperature', 'windSpeed', 'location', 'chanceOfPrecipitation', 'humidity', 'uvIndex', 'stormTrack', 'anomalyStreaks']
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

export async function generateVisualSummaryImage(
  base64ImageData: string,
  mimeType: string,
  analysis: WeatherAnalysis,
): Promise<string> {
    const API_KEY = "AIzaSyACjqYWF14Uc1ucaG3FTLhhNdhPS89eb0s";
    if (!API_KEY) throw new Error("API_KEY environment variable not set.");

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    let prompt = `Reflect and enhance this weather visualization. The analysis provides the following context:\n- Explanation: ${analysis.explanation.substring(0, 200)}...\n`;

    if (analysis.stormTrack && analysis.stormTrack.length > 0) {
      prompt += `- A storm is being tracked. Its path is highlighted.\n`;
    }
    if (analysis.anomalyStreaks && analysis.anomalyStreaks.length > 0) {
      prompt += `- The following anomalies are highlighted: ${analysis.anomalyStreaks.map(s => s.description).join(', ')}\n`;
    }
    if (analysis.stormSurge) {
        prompt += `- A storm surge of ${analysis.stormSurge.surgeHeight}m is forecast for the highlighted coastal area.\n`;
    }
    prompt += `Make the highlighted storm track, anomaly streaks, and storm surge areas appear more photorealistic and integrated into the satellite imagery, as if they are glowing energy patterns on the map. For each anomaly streak, embed its description as a clean, readable text overlay near its corresponding highlighted area. Return only the enhanced image.`;

    const imagePart = {
      inlineData: {
        data: base64ImageData,
        mimeType: mimeType,
      },
    };

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
      });

      const firstPart = response.candidates?.[0]?.content?.parts?.[0];
      if (firstPart && firstPart.inlineData) {
        return firstPart.inlineData.data;
      } else {
        throw new Error("No image was generated by the model.");
      }
    } catch (error) {
        console.error("Error generating visual summary:", error);
        throw new Error("Failed to generate visual summary image.");
    }
}