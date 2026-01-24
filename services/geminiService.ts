import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY belum diset di environment variables");
}

const ai = new GoogleGenAI({ apiKey });

export const analyzeReceipts = async (base64Images: string[]) => {
  const imageParts = base64Images.map(base64 => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: base64,
    },
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        ...imageParts,
        {
          text: `Anda adalah asisten ekstraksi struk belanja.

Kembalikan JSON:
{
  "store_name": "Nama Toko",
  "date": "YYYY-MM-DD",
  "total_amount": 0,
  "total_discount": 0,
  "items": [
    { "name": "Nama Barang", "qty": 1, "unit_price": 1000, "discount": 200, "total": 800 }
  ]
}`
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

  return JSON.parse(response.text);
};
