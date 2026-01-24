import { GoogleGenAI, Type } from "@google/genai";

export const analyzeReceipts = async (base64Images: string[]) => {
  // Inisialisasi di dalam fungsi sesuai rekomendasi terbaru
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const imageParts = base64Images.map(base64 => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64,
    },
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        ...imageParts,
        {
          text: `Anda adalah asisten ekstraksi struk belanja. Ekstrak data dari gambar struk ini.
          
          PENTING UNTUK DISKON:
          - Cari baris bertanda 'Disc', 'Promo', 'Potongan', atau angka negatif di bawah/samping nama barang.
          - Jika ditemukan diskon, masukkan ke properti 'discount' (nominal uang).
          - 'unit_price' adalah harga asli per satu barang sebelum diskon.
          - 'total' HARUS hasil dari: (qty * unit_price) - discount.
          - Pastikan 'total_amount' adalah jumlah akhir yang benar-benar dibayarkan di struk.

          Kembalikan JSON:
          {
            "store_name": "Nama Toko",
            "date": "YYYY-MM-DD",
            "total_amount": 0,
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