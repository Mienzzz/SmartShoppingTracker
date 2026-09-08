import React from 'react';

interface InstallOverlayProps {
  onClose: () => void;
  onDirectInstall?: () => void;
  canDirectInstall?: boolean;
}

const InstallOverlay: React.FC<InstallOverlayProps> = ({
  onClose,
  onDirectInstall,
  canDirectInstall = false
}) => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white text-slate-900 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col">
        {/* Header dengan Icon App */}
        <div className="bg-blue-600 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
            aria-label="Tutup"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="w-16 h-16 bg-white rounded-2xl mx-auto shadow-md flex items-center justify-center mb-3 overflow-hidden p-2">
            <img src="/icon-192.png" alt="Bill Capture" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-xl font-black italic tracking-tighter uppercase">Instal Bill Capture</h2>
          <p className="text-blue-100 text-xs font-medium mt-1">
            Pasang sebagai Aplikasi PWA Mandiri (Bukan Sekadar Shortcut)
          </p>
        </div>

        {/* Content Petunjuk */}
        <div className="p-6 space-y-4">
          {canDirectInstall && onDirectInstall && (
            <button
              onClick={() => {
                onDirectInstall();
                onClose();
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-6 rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Pasang Sekarang
            </button>
          )}

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
              {isIOS ? 'Cara Pasang di iPhone / iPad (Safari):' : 'Cara Pasang di Chrome:'}
            </h3>

            {isIOS ? (
              <ol className="text-xs space-y-3 font-semibold text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="bg-blue-100 text-blue-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <span>Sentuh tombol <strong className="text-blue-600">Bagikan (Share)</strong> di bar navigasi bawah Safari.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="bg-blue-100 text-blue-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <span>Gulir ke bawah dan pilih <strong className="text-blue-600">"Add to Home Screen"</strong> (Tambah ke Layar Utama).</span>
                </li>
              </ol>
            ) : (
              <ol className="text-xs space-y-3 font-semibold text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="bg-blue-100 text-blue-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <span>Buka menu <strong className="text-blue-600">Tiga Titik (⋮)</strong> di kanan atas browser Chrome.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="bg-blue-100 text-blue-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <span>Pilih opsi <strong className="text-blue-600">"Instal aplikasi"</strong> atau <strong className="text-blue-600">"Tambahkan ke Layar Utama"</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="bg-blue-100 text-blue-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <span>Aplikasi akan diinstal dengan icon penuh tanpa toolbar URL browser.</span>
                </li>
              </ol>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-wider text-center"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallOverlay;
