import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeVideoContent(videoDescription: string) {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `Analyze this video content (based on description: ${videoDescription}) and provide:
    1. A catchy caption.
    2. An SEO-friendly title.
    3. A list of 5-10 trending hashtags.
    4. A safety check. You MUST detect if the content contains:
       - 18+ adult content or nudity
       - Graphic violence or gore
       - Hate speech or harassment
       - Illegal activities
    
    If any of these are detected, set isSafe to false and provide a clear safetyReason.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          caption: { type: Type.STRING },
          seoTitle: { type: Type.STRING },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          isSafe: { type: Type.BOOLEAN },
          safetyReason: { type: Type.STRING }
        },
        required: ["caption", "seoTitle", "hashtags", "isSafe"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
