import React, { useEffect, useState } from 'react';

export type ToastType = 'info' | 'success' | 'error';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Tunggu animasi selesai sebelum menghapus dari DOM
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const bgStyles = {
    info: 'bg-slate-900',
    success: 'bg-emerald-600',
    error: 'bg-red-600'
  };

  return (
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
      <div className={`${bgStyles[type]} text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 min-w-[280px] max-w-[90vw] border border-white/10`}>
        {type === 'error' && (
          <svg className="w-5 h-5 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {type === 'success' && (
          <svg className="w-5 h-5 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
        <p className="text-sm font-bold tracking-tight text-center flex-1">{message}</p>
      </div>
    </div>
  );
};

export default Toast;