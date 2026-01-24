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
    console.error("Gagal merender aplikasi:", error);
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; text-align: center;">
        <h2>Waduh, ada masalah saat memuat aplikasi.</h2>
        <p>Coba segarkan halaman atau hubungi pengembang.</p>
        <pre style="text-align: left; background: #eee; padding: 10px; border-radius: 5px;">${error}</pre>
      </div>
    `;
  }
}