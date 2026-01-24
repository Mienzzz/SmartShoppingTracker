
import { GoogleGenAI, Type } from "@google/genai";

export const analyzeReceipts = async (base64Images: string[]) => {
  // Use process.env.API_KEY directly in the constructor as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
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
            text: `Ekstrak data dari struk belanja ini ke JSON murni. 
            Pastikan: 
            1. total_amount adalah angka akhir yang dibayar.
            2. item.discount adalah nominal potongan per item (0 jika tidak ada).
            3. item.total adalah (qty * unit_price) - discount.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            store_name: { type: Type.STRING },
            date: { type: Type.STRING },
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
    
    // Hilangkan blok markdown jika ada
    const cleanJson = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Gemini Scan Error:", error);
    throw error;
  }
};