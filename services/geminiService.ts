import { GoogleGenAI, Type } from "@google/genai";

export const analyzeReceipts = async (base64Images: string[]) => {
  const apiKey = process.env.API_KEY;
  
  // Deteksi jika API Key kosong (biasanya terjadi di Vercel jika belum di-set)
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
            text: `Ekstrak data dari struk belanja ini ke JSON murni. 
            Pastikan: 
            1. total_amount adalah angka akhir yang dibayar oleh pelanggan.
            2. item.discount adalah nominal diskon khusus per baris barang (0 jika tidak ada).
            3. item.total adalah (qty * unit_price) - discount.
            4. total_discount adalah total diskon global (seperti diskon member, voucher, atau potongan belanja langsung di akhir struk).`
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
    
    // Ekstraksi JSON yang lebih aman: ambil teks di antara kurung kurawal pertama dan terakhir
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("INVALID_JSON_FORMAT");
    
    return JSON.parse(jsonMatch[0]);
  } catch (error: any) {
    console.error("Gemini Scan Detail Error:", error);
    throw error;
  }
};