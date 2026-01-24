import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Elemen root tidak ditemukan!");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Render Error:", error);
    rootElement.innerHTML = `
      <div style="padding: 40px; font-family: sans-serif; text-align: center; color: #333;">
        <h2 style="color: #ef4444;">Aplikasi Gagal Dimuat</h2>
        <p>Terjadi kesalahan teknis saat menjalankan kode.</p>
        <div style="text-align: left; background: #f1f5f9; padding: 15px; border-radius: 12px; margin-top: 20px; font-size: 12px; overflow: auto;">
          <code>${error instanceof Error ? error.message : String(error)}</code>
        </div>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">
          Coba Lagi
        </button>
      </div>
    `;
  }
}

// Menangkap error yang tidak tertangani di luar lifecycle React
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error:", message, error);
};