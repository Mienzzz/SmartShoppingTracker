import React from 'react';

const InstallOverlay: React.FC = () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  return (
    <div className="fixed inset-0 z-[100] bg-blue-600 flex flex-col items-center justify-center p-8 text-center text-white">
      <div className="bg-white/20 p-6 rounded-[3rem] mb-8">
        <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      
      <h1 className="text-3xl font-black italic mb-4 tracking-tighter uppercase">Instal Bill Capture</h1>
      <p className="text-blue-100 font-medium mb-12 max-w-xs">
        Aplikasi ini didesain sebagai aplikasi cloud privat. Silakan instal ke layar utama untuk pengalaman terbaik dan fitur kamera yang stabil.
      </p>

      <div className="bg-white text-blue-900 p-6 rounded-[2.5rem] w-full max-w-sm shadow-2xl">
        <h2 className="font-black text-sm uppercase mb-4 tracking-widest">Cara Instal:</h2>
        
        {isIOS ? (
          <ol className="text-left text-sm space-y-4 font-bold">
            <li className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">1</span>
              <span>Klik tombol <span className="text-blue-600 italic">"Share"</span> (kotak dengan panah atas) di navigasi bawah Safari.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">2</span>
              <span>Pilih menu <span className="text-blue-600 italic">"Add to Home Screen"</span>.</span>
            </li>
          </ol>
        ) : (
          <ol className="text-left text-sm space-y-4 font-bold">
            <li className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">1</span>
              <span>Klik ikon <span className="text-blue-600 italic">"Tiga Titik"</span> di pojok kanan atas Chrome.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">2</span>
              <span>Pilih <span className="text-blue-600 italic">"Install App"</span> atau <span className="text-blue-600 italic">"Tambahkan ke Layar Utama"</span>.</span>
            </li>
          </ol>
        )}
      </div>

      <p className="mt-8 text-[10px] font-black uppercase tracking-[0.3em] opacity-50">Bill Capture v1.0 • PWA Cloud</p>
    </div>
  );
};

export default InstallOverlay;