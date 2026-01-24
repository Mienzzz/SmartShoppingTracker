import { useState, useEffect, useRef, useMemo } from 'react';
import { Receipt, ReceiptItem } from './types';
import { getDeviceId, getReceiptsFromNeon, saveReceiptToNeon, findHistoricalPrices, ensureSchema } from './lib/storage';
import { analyzeReceipts } from './services/geminiService';
import PriceHistoryModal from './components/PriceHistoryModal';
import Toast, { ToastType } from './components/Toast';
import InstallOverlay from './components/InstallOverlay';

const App: React.FC = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemHistory, setSelectedItemHistory] = useState<{name: string, data: Receipt[]} | null>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState<string>('all'); 
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [showCapturePreview, setShowCapturePreview] = useState(false);
  const [scannedData, setScannedData] = useState<Partial<Receipt> | null>(null);
  const [toast, setToast] = useState<{message: string, type: ToastType} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://') ||
        window.location.search.includes('source=pwa');
      
      setIsStandalone(isStandaloneMode);
    };

    const startup = async () => {
      try {
        await ensureSchema();
        await loadReceipts();
      } catch (e) {
        console.error("Startup error", e);
      } finally {
        setIsReady(true);
      }
    };

    checkStandalone();
    startup();
  }, []);

  const loadReceipts = async () => {
    try {
        const data = await getReceiptsFromNeon();
        setReceipts(data || []);
    } catch (err) {
        console.error("Load receipts error:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("Foto terlalu besar (maks 5MB)", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setPendingImages(prev => [...prev, base64]);
      setShowCapturePreview(true);
      showToast("Foto berhasil diambil", "success");
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  const processAllImages = async () => {
    if (pendingImages.length === 0) return;

    setIsLoading(true);
    setUploadProgress(20);
    
    try {
      setUploadProgress(40);
      const data = await analyzeReceipts(pendingImages);
      setUploadProgress(90);
      
      const validatedDate = (data.date && !isNaN(Date.parse(data.date))) 
        ? data.date 
        : new Date().toISOString().split('T')[0];

      setScannedData({
        ...data,
        date: validatedDate,
        total_discount: data.total_discount || 0
      });
      
      setIsScanning(true);
      setShowCapturePreview(false);
      setPendingImages([]);
      showToast("Data berhasil diekstrak", "success");
    } catch (error: any) {
      console.error("Processing failed:", error);
      let msg = "Gagal memproses foto. Pastikan tulisan jelas.";
      if (error.message === "API_KEY_MISSING") msg = "Error: API_KEY belum di-set di Vercel.";
      showToast(msg, "error");
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleSaveReceipt = async () => {
    if (!scannedData?.items?.length) {
        showToast("Tambahkan barang terlebih dahulu", "error");
        return;
    }
    
    setIsLoading(true);
    try {
      const deviceId = getDeviceId();
      const newReceiptData: Omit<Receipt, 'id'> = {
        date: scannedData.date || new Date().toISOString().split('T')[0],
        store_name: (scannedData.store_name || 'Toko Baru').trim(),
        total_amount: Number(scannedData.total_amount) || 0,
        total_discount: Number(scannedData.total_discount) || 0,
        items: scannedData.items as ReceiptItem[],
        device_id: deviceId
      };

      await saveReceiptToNeon(newReceiptData);
      setScannedData(null);
      setIsScanning(false);
      await loadReceipts(); 
      showToast("Berhasil disimpan!", "success");
    } catch (error: any) {
      showToast("Gagal menyimpan ke cloud", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const checkPrice = async (name: string) => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      const history = await findHistoricalPrices(name);
      setSelectedItemHistory({ name, data: history });
    } catch (error) {
      showToast("Gagal mencari riwayat", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedReceiptId(expandedReceiptId === id ? null : id);
  };

  const removeManualItem = (index: number) => {
    if (!scannedData?.items) return;
    const newItems = scannedData.items.filter((_, i) => i !== index);
    const sumItems = newItems.reduce((sum, item) => sum + item.total, 0);
    setScannedData({
      ...scannedData,
      items: newItems,
      total_amount: sumItems - (scannedData.total_discount || 0)
    });
  };

  const addManualItem = () => {
    const newItem: ReceiptItem = {
      name: '',
      qty: 1,
      unit_price: 0,
      discount: 0,
      total: 0
    };
    const currentItems = scannedData?.items || [];
    setScannedData({
      ...scannedData,
      items: [...currentItems, newItem]
    } as Partial<Receipt>);
  };

  const handleManualInput = () => {
    setScannedData({
      store_name: '',
      date: new Date().toISOString().split('T')[0],
      total_amount: 0,
      total_discount: 0,
      items: []
    });
    setIsScanning(true);
  };

  // Improved numeric input update to prevent leading zeros
  const updateManualItem = (index: number, field: keyof ReceiptItem, rawValue: string) => {
    if (!scannedData?.items) return;
    const newItems = [...scannedData.items];
    
    let value: any = rawValue;
    if (field !== 'name') {
      // Force conversion to number and remove non-digits if necessary
      value = Number(rawValue.replace(/[^0-9]/g, '')) || 0;
    }
    
    newItems[index] = { ...newItems[index], [field]: value };
    const item = newItems[index];
    item.total = (item.qty * item.unit_price) - (item.discount || 0);

    const sumItems = newItems.reduce((sum, item) => sum + item.total, 0);
    setScannedData({
      ...scannedData,
      items: newItems,
      total_amount: sumItems - (scannedData.total_discount || 0)
    });
  };

  const updateTotalDiscount = (val: string) => {
    if (!scannedData) return;
    const discount = Number(val.replace(/[^0-9]/g, '')) || 0;
    const sumItems = (scannedData.items || []).reduce((sum, item) => sum + item.total, 0);
    setScannedData({
      ...scannedData,
      total_discount: discount,
      total_amount: sumItems - discount
    });
  };

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    receipts.forEach(r => {
      const d = new Date(r.date);
      const key = `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      months.add(key);
    });
    return Array.from(months).sort().reverse();
  }, [receipts]);

  const filteredReceipts = useMemo(() => {
    if (filterMonth === 'all') return receipts;
    return receipts.filter(r => {
      const d = new Date(r.date);
      const key = `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      return key === filterMonth;
    });
  }, [receipts, filterMonth]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isStandalone) {
    return <InstallOverlay />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-40">
      <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {isLoading && (
        <div className="fixed inset-0 z-[70] bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-xs">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-slate-900 font-black text-lg uppercase tracking-tight">Memproses...</p>
            {uploadProgress > 0 && (
               <div className="w-full h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all duration-300" style={{width: `${uploadProgress}%`}}></div>
               </div>
            )}
          </div>
        </div>
      )}

      {showCapturePreview && (
        <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col p-6 overflow-y-auto">
          <div className="max-w-md mx-auto w-full flex-1 flex flex-col py-10">
            <h2 className="text-white text-2xl font-black text-center mb-8 italic uppercase">Review Foto</h2>
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
                <span className="text-[10px] font-black uppercase">Tambah Foto</span>
              </button>
            </div>
            <button onClick={processAllImages} className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-xl shadow-2xl mb-4">MULAI PINDAI</button>
            <button onClick={() => {setPendingImages([]); setShowCapturePreview(false);}} className="w-full text-slate-500 font-bold py-2">Batal</button>
          </div>
        </div>
      )}

      <header className="bg-white px-6 pt-12 pb-6 border-b border-slate-100 sticky top-0 z-30">
        <div className="flex justify-between items-end max-w-2xl mx-auto">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none italic">CEK BON</h1>
            <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] mt-2">PWA Private Cloud</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Bulan Ini</p>
            <p className="text-lg font-black text-slate-900 leading-none">
              Rp {filteredReceipts.reduce((acc, curr) => acc + curr.total_amount, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 md:p-6">
        <div className="bg-white p-1 rounded-3xl shadow-sm border border-slate-100 flex items-center mb-6">
          <input type="text" placeholder="Cari item di riwayat..." className="flex-1 px-5 py-4 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && checkPrice(searchQuery)} />
          <button onClick={() => checkPrice(searchQuery)} className="mr-1 bg-slate-900 text-white px-6 py-4 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">CEK</button>
        </div>

        {isScanning && scannedData && (
          <div className="bg-white rounded-[2.5rem] p-6 border border-blue-100 shadow-2xl mb-6 relative">
             <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600 rounded-t-[2.5rem]"></div>
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-slate-900 italic">KOREKSI DATA</h2>
                <button onClick={() => setIsScanning(false)} className="text-slate-300"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3"/></svg></button>
             </div>
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-slate-50 p-3 rounded-2xl">
                      <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Nama Toko</span>
                      <input value={scannedData.store_name} onChange={e => setScannedData({...scannedData, store_name: e.target.value})} className="w-full bg-transparent text-sm font-bold outline-none" />
                   </div>
                   <div className="bg-slate-50 p-3 rounded-2xl">
                      <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Tanggal</span>
                      <input type="date" value={scannedData.date} onChange={e => setScannedData({...scannedData, date: e.target.value})} className="w-full bg-transparent text-sm font-bold outline-none" />
                   </div>
                </div>
                
                <div className="bg-slate-50 p-2 rounded-3xl border border-slate-100">
                   <div className="max-h-60 overflow-y-auto no-scrollbar space-y-2 p-1">
                      {scannedData.items?.map((item, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 relative">
                           <input value={item.name} onChange={e => updateManualItem(idx, 'name', e.target.value)} className="w-full text-xs font-black mb-2 outline-none" />
                           <div className="grid grid-cols-3 gap-2">
                              <div className="text-[9px] font-bold">
                                <span className="text-slate-300">Qty:</span> 
                                <input 
                                  type="number" 
                                  value={item.qty === 0 ? "" : item.qty} 
                                  onChange={e => updateManualItem(idx, 'qty', e.target.value)}
                                  className="w-full bg-transparent outline-none" 
                                />
                              </div>
                              <div className="text-[9px] font-bold">
                                <span className="text-slate-300">Rp</span> 
                                <input 
                                  type="number" 
                                  value={item.unit_price === 0 ? "" : item.unit_price} 
                                  onChange={e => updateManualItem(idx, 'unit_price', e.target.value)}
                                  className="w-full bg-transparent outline-none" 
                                />
                              </div>
                              <div className="text-[9px] font-black text-blue-600 text-right pt-1">Rp {item.total.toLocaleString()}</div>
                           </div>
                           <button onClick={() => removeManualItem(idx)} className="absolute top-2 right-2 text-red-300"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3"/></svg></button>
                        </div>
                      ))}
                   </div>
                   <button onClick={addManualItem} className="w-full py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">+ Item</button>
                </div>

                <div className="bg-blue-50/50 p-4 rounded-[2rem] border border-blue-100/50">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-blue-400 uppercase">Diskon Tambahan</span>
                    <div className="flex items-center gap-1 font-black text-blue-600 italic">
                      <span>Rp</span>
                      <input 
                        type="number" 
                        value={scannedData.total_discount === 0 ? "" : scannedData.total_discount} 
                        onChange={e => updateTotalDiscount(e.target.value)}
                        placeholder="0"
                        className="bg-transparent outline-none text-right w-24 placeholder:text-blue-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-900 p-6 rounded-[2rem] text-white">
                   <span className="text-[10px] font-black text-slate-400 uppercase">Total Bayar</span>
                   <p className="text-2xl font-black italic">Rp {Number(scannedData.total_amount).toLocaleString()}</p>
                </div>
                <button onClick={handleSaveReceipt} className="w-full bg-blue-600 text-white font-black py-5 rounded-[2rem] shadow-xl uppercase tracking-widest text-sm">SIMPAN DATA</button>
             </div>
          </div>
        )}

        {!isScanning && !showCapturePreview && (
          <div className="space-y-4">
             {filteredReceipts.map(receipt => (
                <div key={receipt.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                  <div onClick={() => toggleExpand(receipt.id)} className="p-5 flex justify-between items-center cursor-pointer active:bg-slate-50">
                    <div className="flex-1 truncate pr-4">
                      <h4 className="font-black text-slate-800 text-sm uppercase truncate">{receipt.store_name}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {new Date(receipt.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-blue-600 text-sm">Rp {receipt.total_amount.toLocaleString()}</p>
                      <p className="text-[8px] font-black text-slate-300 uppercase mt-0.5">{receipt.items.length} Item</p>
                    </div>
                  </div>
                  {expandedReceiptId === receipt.id && (
                    <div className="px-5 pb-5 pt-1 bg-slate-50/50 space-y-2">
                      {receipt.items.map((item, i) => (
                        <div key={i} onClick={() => checkPrice(item.name)} className="flex justify-between p-3 bg-white rounded-2xl shadow-sm border border-slate-50 active:scale-95 transition-all">
                          <span className="text-xs font-black text-slate-700 truncate pr-4">{item.name}</span>
                          <span className="text-xs font-black text-slate-900 flex-shrink-0">Rp {item.total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
             ))}
          </div>
        )}
      </main>

      {!isScanning && !showCapturePreview && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 z-40 bg-white/80 backdrop-blur-xl p-3 rounded-[3rem] shadow-2xl border border-white/50">
          <button onClick={handleManualInput} className="p-5 bg-slate-100 text-slate-400 rounded-full active:scale-90 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2.5"/></svg>
          </button>
          <button onClick={triggerCamera} className="bg-slate-900 text-white p-6 rounded-full shadow-2xl ring-8 ring-blue-600/10 active:scale-95 transition-all">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth="3"/></svg>
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