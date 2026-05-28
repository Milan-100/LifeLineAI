import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeSymptoms(symptoms: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an emergency medical assistant. Analyze the following symptoms and provide:
      1. Risk Level (Low, Medium, Critical)
      2. Immediate First Aid Steps (concise bullet points)
      3. Recommendation (e.g., Call ambulance, visit clinic, rest)
      
      Symptoms: ${symptoms}
      
      Respond in JSON format with keys: riskLevel, firstAidSteps (array), recommendation.`,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return {
      riskLevel: "Unknown",
      firstAidSteps: ["Stay calm", "Seek professional help if symptoms persist"],
      recommendation: "Consult a doctor immediately if you are unsure.",
    };
  }
}

export async function getChatResponse(message: string, history: { role: string; parts: { text: string }[] }[]) {
  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "You are a helpful, empathetic medical first aid chatbot. Provide quick, clear advice for medical emergencies. Always remind users to call emergency services for critical issues.",
      },
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Chat Error:", error);
    return "I'm having trouble connecting. Please call emergency services if this is urgent.";
  }
}
