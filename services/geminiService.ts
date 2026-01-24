
import { GoogleGenAI, Type } from "@google/genai";

export const analyzeReceipts = async (base64Images: string[]) => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const imageParts = base64Images.map(base64 => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64,
    },
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          ...imageParts,
          {
            text: `Extract data from these receipt images into pure JSON. 
            RULES:
            - date MUST be in 'YYYY-MM-DD' format ONLY (e.g., 2024-10-25). No time, no dots, no slashes.
            - total_amount is the final price paid.
            - item.discount is numeric discount for that item (0 if none).
            - item.total is (qty * unit_price) - discount.
            - total_discount is the GLOBAL discount (voucher/points/final cut) found at the bottom of the receipt.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            store_name: { type: Type.STRING },
            date: { type: Type.STRING, description: "Format YYYY-MM-DD" },
            total_amount: { type: Type.NUMBER },
            total_discount: { type: Type.NUMBER },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  qty: { type: Type.NUMBER },
                  unit_price: { type: Type.NUMBER },
                  discount: { type: Type.NUMBER },
                  total: { type: Type.NUMBER }
                },
                required: ["name", "qty", "unit_price", "discount", "total"]
              }
            }
          },
          required: ["store_name", "date", "total_amount", "items"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("INVALID_JSON_FORMAT");
    
    return JSON.parse(jsonMatch[0]);
  } catch (error: any) {
    console.error("Gemini Scan Error:", error);
    throw error;
  }
};
