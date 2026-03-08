import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAi() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Please add it to your environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function analyzeVideoContent(videoDescription: string, frames?: string[]) {
  const model = "gemini-3-flash-preview";
  const ai = getAi();
  
  const parts: any[] = [
    { text: `Analyze this video content (based on description: ${videoDescription}) and provide:
    1. A catchy caption.
    2. An SEO-friendly title.
    3. A list of 5-10 trending hashtags.
    4. A safety check. You MUST detect if the content contains:
       - 18+ adult content or nudity
       - Graphic violence or gore
       - Hate speech or harassment
       - Illegal activities
    
    If any of these are detected, set isSafe to false and provide a clear safetyReason.
    
    Return the response in JSON format.` }
  ];

  if (frames && frames.length > 0) {
    frames.forEach(frame => {
      // Remove data:image/jpeg;base64, prefix if present
      const base64Data = frame.split(',')[1] || frame;
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      });
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
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
