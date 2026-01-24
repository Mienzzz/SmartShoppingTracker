
import React, { useState, useEffect, useRef } from 'react';
import { Receipt, ReceiptItem } from './types';
import { getDeviceId, getReceiptsFromNeon, saveReceiptToNeon, findHistoricalPrices, ensureSchema } from './lib/storage';
import { analyzeReceipts } from './services/geminiService';
import PriceHistoryModal from './components/PriceHistoryModal';
import Toast, { ToastType } from './components/Toast';

const SplashScreen: React.FC = () => (
  <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col items-center justify-center p-6 overflow-hidden">
    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-700">
      <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none italic mb-2">BILL CAPTURE</h1>
      <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.4em] mb-12">Private Cloud Storage</p>
      
      <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden relative">
        <div className="absolute inset-0 bg-blue-600 w-1/3 rounded-full animate-[loading_1.5s_infinite_ease-in-out]"></div>
      </div>
    </div>
    <style>{`
      @keyframes loading {
        0% { transform: translateX(-100%); }
        50% { transform: translateX(100%); }
        100% { transform: translateX(-100%); }
      }
    `}</style>
  </div>
);

const App: React.FC = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemHistory, setSelectedItemHistory] = useState<{name: string, data: Receipt[]} | null>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [showCapturePreview, setShowCapturePreview] = useState(false);
  const [scannedData, setScannedData] = useState<Partial<Receipt> | null>(null);
  const [toast, setToast] = useState<{message: string, type: ToastType} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const startup = async () => {
      try {
        await ensureSchema();
        await loadReceipts();
      } finally {
        setTimeout(() => setIsReady(true), 1500);
      }
    };
    startup();
  }, []);

  const loadReceipts = async () => {
    const data = await getReceiptsFromNeon();
    setReceipts(data || []);
  };

  // Fungsi utilitas untuk mengompres gambar sebelum disimpan ke state
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; // Cukup besar untuk dibaca AI, cukup kecil untuk RAM
          const MAX_HEIGHT = 1600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Export sebagai JPEG dengan kualitas 0.7 (menghemat memori sangat banyak)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl.split(',')[1]); // Kembalikan base64 murni
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const normalizeDate = (dateStr: string | undefined): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const clean = dateStr.replace(/[^0-9\-.]/g, '-').split('-')[0];
    if (dateStr.includes('.')) {
      const parts = dateStr.split(/[.\-]/);
      if (parts.length >= 3) {
        let day = parts[0].padStart(2, '0');
        let month = parts[1].padStart(2, '0');
        let year = parts[2].substring(0, 4);
        if (year.length === 2) year = "20" + year;
        return `${year}-${month}-${day}`;
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    try {
      // Kompres gambar SEBELUM menyimpannya ke state pendingImages
      const compressedBase64 = await compressImage(file);
      setPendingImages(prev => [...prev, compressedBase64]);
      setShowCapturePreview(true);
    } catch (error) {
      console.error("Compression error:", error);
      showToast("Gagal memproses gambar. Coba lagi.", "error");
    } finally {
      setIsLoading(false);
      e.target.value = ''; // Reset input agar bisa ambil gambar yang sama
    }
  };

  const triggerCamera = () => fileInputRef.current?.click();

  const processAllImages = async () => {
    if (pendingImages.length === 0) return;
    setIsLoading(true);
    try {
      const data = await analyzeReceipts(pendingImages);
      setScannedData({
        ...data,
        date: normalizeDate(data.date),
        total_discount: data.total_discount || 0
      });
      setIsScanning(true);
      setShowCapturePreview(false);
      setPendingImages([]);
    } catch (error) {
      showToast("Gagal memproses struk.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveReceipt = async () => {
    if (!scannedData?.items?.length) return;
    setIsLoading(true);
    try {
      const cleanedData = {
        date: normalizeDate(scannedData.date),
        store_name: (scannedData.store_name || 'Toko Baru').trim(),
        total_amount: Number(scannedData.total_amount) || 0,
        total_discount: Number(scannedData.total_discount) || 0,
        items: (scannedData.items as ReceiptItem[]).map(item => ({
          ...item,
          qty: Number(item.qty) || 0,
          unit_price: Number(item.unit_price) || 0,
          discount: Number(item.discount) || 0,
          total: Number(item.total) || 0
        })),
        device_id: getDeviceId()
      };

      await saveReceiptToNeon(cleanedData);
      setScannedData(null);
      setIsScanning(false);
      await loadReceipts(); 
      showToast("Tersimpan!", "success");
    } catch (error: any) {
      console.error("Save error:", error);
      showToast("Gagal simpan: format data salah", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const updateManualItem = (index: number, field: keyof ReceiptItem, rawValue: string) => {
    if (!scannedData?.items) return;
    const newItems = [...scannedData.items];
    let value: any = rawValue;
    if (field !== 'name') {
      const sanitized = rawValue.replace(/[^0-9]/g, '');
      value = sanitized === "" ? 0 : Number(sanitized);
    }
    newItems[index] = { ...newItems[index], [field]: value };
    newItems[index].total = (newItems[index].qty * newItems[index].unit_price) - (newItems[index].discount || 0);
    
    recalculateTotal(newItems, scannedData.total_discount || 0);
  };

  const updateTotalDiscount = (rawValue: string) => {
    if (!scannedData) return;
    const sanitized = rawValue.replace(/[^0-9]/g, '');
    const discount = sanitized === "" ? 0 : Number(sanitized);
    recalculateTotal(scannedData.items || [], discount);
  };

  const recalculateTotal = (items: ReceiptItem[], discount: number) => {
    const sumItems = items.reduce((sum, item) => sum + (item.total || 0), 0);
    setScannedData({
      ...scannedData,
      items: items,
      total_discount: discount,
      total_amount: sumItems - discount
    });
  };

  const checkPrice = async (name: string) => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      const history = await findHistoricalPrices(name);
      setSelectedItemHistory({ name, data: history });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isReady) return <SplashScreen />;

  return (
    <div className="min-h-screen bg-slate-50 pb-40">
      <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {isLoading && (
        <div className="fixed inset-0 z-[70] bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-900 font-black text-xs uppercase tracking-widest">Processing...</p>
        </div>
      )}

      {showCapturePreview && (
        <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col p-6 overflow-y-auto">
          <div className="max-w-md mx-auto w-full flex-1 flex flex-col py-10">
            <h2 className="text-white text-2xl font-black text-center mb-8 italic uppercase tracking-tighter">Review Bill</h2>
            <div className="grid grid-cols-2 gap-4 mb-10">
              {pendingImages.map((img, idx) => (
                <div key={idx} className="relative aspect-[3/4] rounded-3xl overflow-hidden border-2 border-slate-800">
                  <img src={`data:image/jpeg;base64,${img}`} className="w-full h-full object-cover" />
                  <button onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-xl">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3"/></svg>
                  </button>
                </div>
              ))}
              <button onClick={triggerCamera} className="aspect-[3/4] border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-600 bg-slate-900/50">
                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5"/></svg>
                <span className="text-[10px] font-black uppercase">Tambah</span>
              </button>
            </div>
            <button onClick={processAllImages} className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-xl shadow-2xl mb-4 uppercase tracking-widest">PROCESS</button>
            <button onClick={() => {setPendingImages([]); setShowCapturePreview(false);}} className="w-full text-slate-500 font-bold py-2">Batal</button>
          </div>
        </div>
      )}

      <header className="bg-white px-6 pt-12 pb-6 border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic">BILL CAPTURE</h1>
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Private Cloud Storage</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <div className="bg-white p-1 rounded-3xl shadow-sm border border-slate-100 flex items-center mb-6">
          <input type="text" placeholder="Cari barang..." className="flex-1 px-5 py-4 text-sm font-bold text-slate-800 focus:outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && checkPrice(searchQuery)} />
          <button onClick={() => checkPrice(searchQuery)} className="mr-1 bg-blue-600 text-white px-8 py-4 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest active:scale-95">CEK</button>
        </div>

        {isScanning && scannedData && (
          <div className="bg-white rounded-[2.5rem] p-6 border border-blue-100 shadow-2xl mb-6 relative animate-in slide-in-from-bottom duration-500">
             <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600 rounded-t-[2.5rem]"></div>
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-slate-900 italic uppercase tracking-tighter">Koreksi Data</h2>
                <button onClick={() => setIsScanning(false)} className="text-slate-300 p-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3"/></svg></button>
             </div>
             
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-slate-50 p-3 rounded-2xl">
                      <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Toko</span>
                      <input value={scannedData.store_name || ''} onChange={e => setScannedData({...scannedData, store_name: e.target.value})} className="w-full bg-transparent text-sm font-bold outline-none" />
                   </div>
                   <div className="bg-slate-50 p-3 rounded-2xl">
                      <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Tgl (YYYY-MM-DD)</span>
                      <input type="text" value={scannedData.date || ''} onChange={e => setScannedData({...scannedData, date: e.target.value})} className="w-full bg-transparent text-sm font-bold outline-none" />
                   </div>
                </div>
                
                <div className="bg-slate-50 p-2 rounded-3xl border border-slate-100">
                   <div className="max-h-[40vh] overflow-y-auto no-scrollbar space-y-3 p-1">
                      {scannedData.items?.map((item, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm relative border border-slate-100">
                           <input value={item.name} onChange={e => updateManualItem(idx, 'name', e.target.value)} className="w-full text-xs font-black mb-3 outline-none focus:text-blue-600" placeholder="Nama Barang" />
                           <div className="grid grid-cols-4 gap-2">
                              <div><span className="text-[8px] font-bold text-slate-300 block mb-1">Qty</span> 
                                <input type="number" value={item.qty || ""} onChange={e => updateManualItem(idx, 'qty', e.target.value)} className="w-full bg-slate-50 rounded-lg p-2 font-bold text-xs outline-none" />
                              </div>
                              <div><span className="text-[8px] font-bold text-slate-300 block mb-1">Rp/u</span> 
                                <input type="number" value={item.unit_price || ""} onChange={e => updateManualItem(idx, 'unit_price', e.target.value)} className="w-full bg-slate-50 rounded-lg p-2 font-bold text-xs outline-none" />
                              </div>
                              <div><span className="text-[8px] font-bold text-blue-300 block mb-1">Disc</span> 
                                <input type="number" value={item.discount || ""} onChange={e => updateManualItem(idx, 'discount', e.target.value)} className="w-full bg-blue-50 text-blue-600 rounded-lg p-2 font-bold text-xs outline-none" placeholder="0" />
                              </div>
                              <div className="text-right"><span className="text-[8px] font-bold text-slate-300 block mb-1">Subtotal</span><span className="text-[10px] font-black text-slate-900 block mt-2">Rp {item.total?.toLocaleString()}</span></div>
                           </div>
                           <button onClick={() => setScannedData({...scannedData, items: scannedData.items?.filter((_, i) => i !== idx)})} className="absolute -top-2 -right-2 bg-white border border-slate-100 p-1.5 rounded-full text-red-400 shadow-sm"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3"/></svg></button>
                        </div>
                      ))}
                   </div>
                   <button onClick={() => setScannedData({...scannedData, items: [...(scannedData.items || []), {name: '', qty: 1, unit_price: 0, discount: 0, total: 0}]})} className="w-full py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600">+ Item Baru</button>
                </div>

                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex justify-between items-center">
                  <span className="text-[10px] font-black text-blue-400 uppercase">Potongan / Diskon Akhir</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-black text-blue-600 italic">Rp</span>
                    <input 
                      type="number" 
                      value={scannedData.total_discount || ""} 
                      onChange={e => updateTotalDiscount(e.target.value)} 
                      placeholder="0"
                      className="bg-transparent text-right font-black text-blue-600 outline-none w-24"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-900 p-6 rounded-[2rem] text-white">
                   <span className="text-[10px] font-black text-slate-400 uppercase">Total Akhir</span>
                   <p className="text-2xl font-black italic tracking-tighter">Rp {Number(scannedData.total_amount || 0).toLocaleString()}</p>
                </div>
                <button onClick={handleSaveReceipt} className="w-full bg-blue-600 text-white font-black py-5 rounded-[2rem] shadow-xl uppercase tracking-widest text-sm active:scale-95 transition-all">SAVE</button>
             </div>
          </div>
        )}

        {!isScanning && (
          <div className="space-y-4">
             {receipts.map(receipt => (
                <div key={receipt.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden transition-all">
                  <div onClick={() => setExpandedReceiptId(expandedReceiptId === receipt.id ? null : receipt.id)} className="p-5 flex justify-between items-center active:bg-slate-50">
                    <div className="flex-1 truncate pr-4">
                      <h4 className="font-black text-slate-800 text-sm uppercase truncate tracking-tight">{receipt.store_name}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase mt-1">
                        {new Date(receipt.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <p className="font-black text-blue-600 text-sm italic">Rp {receipt.total_amount.toLocaleString()}</p>
                  </div>
                  {expandedReceiptId === receipt.id && (
                    <div className="px-5 pb-5 pt-1 bg-slate-50/50 space-y-2 border-t border-slate-50">
                      {receipt.items.map((item, i) => (
                        <div key={i} onClick={(e) => { e.stopPropagation(); checkPrice(item.name); }} className="flex justify-between p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200">
                          <div className="flex-1 min-w-0 pr-4">
                            <span className="text-xs font-black text-slate-700 truncate block">{item.name}</span>
                            <span className="text-[9px] font-bold text-slate-300 uppercase block mt-0.5">{item.qty} x {item.unit_price.toLocaleString()}</span>
                          </div>
                          <span className="text-xs font-black text-slate-900 self-center">Rp {item.total.toLocaleString()}</span>
                        </div>
                      ))}
                      {receipt.total_discount > 0 && (
                        <div className="flex justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                          <span className="text-[10px] font-black text-blue-400 uppercase">Potongan</span>
                          <span className="text-[10px] font-black text-blue-600">- Rp {receipt.total_discount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
             ))}
          </div>
        )}
      </main>

      {!isScanning && !showCapturePreview && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 z-40 bg-white/90 backdrop-blur-xl p-4 rounded-[3.5rem] shadow-2xl border border-white/50 ring-1 ring-slate-200/50">
          <button onClick={() => {
            setScannedData({ store_name: '', date: new Date().toISOString().split('T')[0], total_amount: 0, total_discount: 0, items: [] });
            setIsScanning(true);
          }} className="p-5 bg-white text-blue-600 rounded-full active:scale-90 transition-all shadow-sm border border-slate-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
          </button>

          <button onClick={triggerCamera} className="bg-blue-600 text-white p-6 rounded-full shadow-[0_20px_50px_rgba(37,99,235,0.3)] ring-4 ring-white active:scale-95 transition-all flex items-center justify-center overflow-hidden">
            <svg 
              className="w-8 h-8" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          
          <div className="w-16"></div>
        </div>
      )}

      {selectedItemHistory && (
        <PriceHistoryModal itemName={selectedItemHistory.name} history={selectedItemHistory.data} onClose={() => setSelectedItemHistory(null)} />
      )}
    </div>
  );
};

export default App;
