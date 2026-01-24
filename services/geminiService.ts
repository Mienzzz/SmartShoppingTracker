import { GoogleGenAI, Type } from "@google/genai";

export const analyzeReceipts = async (base64Images: string[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
            text: `Anda adalah asisten ekstraksi struk belanja. Ekstrak data dari gambar struk ini ke dalam format JSON murni.
            
            PENTING UNTUK DISKON:
            - Cari baris bertanda 'Disc', 'Promo', 'Potongan', atau angka negatif.
            - Jika ditemukan diskon per item, masukkan ke properti 'discount'.
            - 'unit_price' adalah harga asli sebelum diskon.
            - 'total' HARUS (qty * unit_price) - discount.
            - 'total_amount' adalah jumlah akhir yang dibayarkan.

            Format respons harus JSON murni tanpa markdown blocks.`
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
            total_discount: { type: Type.NUMBER, description: "Global discount if any" },
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

    let text = response.text;
    
    // Pembersihan ekstra: Hapus markdown code blocks jika model tidak mematuhi responseMimeType
    if (text.includes('```')) {
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Analysis Error Detail:", error);
    throw error;
  }
};