import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Please configure your API key in the environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  targetConcept: string;
  solutionSnippet: string;
  testCode: string;
  level: number;
}

export async function generateExercises(level: number, topic?: string): Promise<Exercise[]> {
  const ai = getAI();
  const prompt = `Generate 10 distinct JavaScript exercises for level ${level} out of 100. 
  Level 1 is beginner, Level 100 is expert.
  ${topic ? `The topic should be related to: ${topic}.` : ""}
  For each exercise, provide:
  1. A clear title.
  2. A description of what the user needs to implement.
  3. The target concept being tested.
  4. A reference solution snippet.
  5. A 'testCode' string that will be executed to verify the user's code. 
     The test code should use an 'expect(actual).toBe(expected)' or 'expect(actual).toEqual(expected)' syntax.
     Assume 'expect' is globally available.
     Example test code: 
     const result = add(2, 3);
     expect(result).toBe(5);
  
  Return exactly 10 exercises in a list.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "A unique short ID for the exercise" },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            targetConcept: { type: Type.STRING },
            solutionSnippet: { type: Type.STRING },
            testCode: { type: Type.STRING, description: "JS code that runs tests using expect()" },
            level: { type: Type.NUMBER },
          },
          required: ["id", "title", "description", "targetConcept", "solutionSnippet", "testCode", "level"],
        },
      },
    },
  });

  return JSON.parse(response.text.trim());
}
