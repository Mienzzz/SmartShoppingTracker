
import { useState, useEffect, useRef, useMemo } from 'react';
import { Receipt, ReceiptItem } from './types';
import { getDeviceId, getReceiptsFromNeon, saveReceiptToNeon, findHistoricalPrices, ensureSchema } from './lib/storage';
import { analyzeReceipts } from './services/geminiService';
import PriceHistoryModal from './components/PriceHistoryModal';

const App: React.FC = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemHistory, setSelectedItemHistory] = useState<{name: string, data: Receipt[]} | null>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  
  const [filterMonth, setFilterMonth] = useState<string>('all'); 
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [showCapturePreview, setShowCapturePreview] = useState(false);
  const [scannedData, setScannedData] = useState<Partial<Receipt> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const startup = async () => {
      try {
        // Pastikan tabel dan kolom ada sebelum load data
        await ensureSchema();
        await loadReceipts();
        setIsReady(true);
      } catch (e) {
        console.error("Startup error", e);
        setIsReady(true); 
      }
    };
    startup();
  }, []);

  const loadReceipts = async () => {
    try {
        const data = await getReceiptsFromNeon();
        setReceipts(data);
    } catch (err) {
        console.error("Gagal memuat data dari database:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setPendingImages(prev => [...prev, base64]);
      setShowCapturePreview(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleManualInput = () => {
    setScannedData({
      store_name: '',
      date: new Date().toISOString().split('T')[0],
      total_amount: 0,
      total_discount: 0,
      items: [{ name: '', qty: 1, unit_price: 0, discount: 0, total: 0 }]
    });
    setIsScanning(true);
  };

  const processAllImages = async () => {
    if (pendingImages.length === 0) return;

    setIsLoading(true);
    setShowCapturePreview(false);
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
      
      setUploadProgress(100);
      setTimeout(() => {
        setIsScanning(true);
        setIsLoading(false);
        setUploadProgress(0);
        setPendingImages([]);
      }, 500);
    } catch (error) {
      console.error("Analisa AI gagal:", error);
      alert("Gagal memindai struk. Pastikan foto jelas dan koneksi stabil.");
      setIsLoading(false);
      setUploadProgress(0);
      setShowCapturePreview(true);
    }
  };

  const updateManualItem = (index: number, field: keyof ReceiptItem, value: any) => {
    if (!scannedData || !scannedData.items) return;
    const newItems = [...scannedData.items];
    
    let newValue = value;
    if (field === 'qty' || field === 'unit_price' || field === 'discount') {
        newValue = Number(value) || 0;
    }

    newItems[index] = { ...newItems[index], [field]: newValue };
    const item = newItems[index];
    item.total = (item.qty * item.unit_price) - (item.discount || 0);

    const sumItems = newItems.reduce((sum, item) => sum + item.total, 0);
    const finalTotal = sumItems - (scannedData.total_discount || 0);
    
    setScannedData({
      ...scannedData,
      items: newItems,
      total_amount: finalTotal
    });
  };

  const handleGlobalDiscountChange = (val: number) => {
    if (!scannedData || !scannedData.items) return;
    const sumItems = scannedData.items.reduce((sum, item) => sum + item.total, 0);
    const finalTotal = sumItems - val;
    setScannedData({
      ...scannedData,
      total_discount: val,
      total_amount: finalTotal
    });
  };

  const addManualItem = () => {
    if (!scannedData || !scannedData.items) return;
    setScannedData({
      ...scannedData,
      items: [...scannedData.items, { name: '', qty: 1, unit_price: 0, discount: 0, total: 0 }]
    });
  };

  const removeManualItem = (index: number) => {
    if (!scannedData || !scannedData.items) return;
    const newItems = scannedData.items.filter((_, i) => i !== index);
    const sumItems = newItems.reduce((sum, item) => sum + item.total, 0);
    const finalTotal = sumItems - (scannedData.total_discount || 0);
    setScannedData({
      ...scannedData,
      items: newItems,
      total_amount: finalTotal
    });
  };

  const handleSaveReceipt = async () => {
    if (!scannedData || !scannedData.items || scannedData.items.length === 0) {
        alert("Bon harus berisi barang.");
        return;
    }
    
    setIsLoading(true);
    setUploadProgress(50);
    
    try {
      const deviceId = getDeviceId();
      const newReceiptData: Omit<Receipt, 'id'> = {
        date: scannedData.date || new Date().toISOString().split('T')[0],
        store_name: (scannedData.store_name || 'Toko Tanpa Nama').trim(),
        total_amount: Number(scannedData.total_amount) || 0,
        total_discount: Number(scannedData.total_discount) || 0,
        items: scannedData.items as ReceiptItem[],
        device_id: deviceId
      };

      // Simpan data
      await saveReceiptToNeon(newReceiptData);
      setUploadProgress(100);
      
      // Bersihkan state form SEGERA setelah save berhasil
      setScannedData(null);
      setIsScanning(false);
      
      // Refresh list
      await loadReceipts(); 
      
    } catch (error: any) {
      console.error("Gagal menyimpan:", error);
      alert(`Gagal menyimpan ke cloud: ${error.message || 'Cek koneksi internet Anda.'}`);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const checkPrice = async (itemName: string) => {
    const query = itemName.trim();
    if (!query) return;
    setIsLoading(true);
    try {
      const history = await findHistoricalPrices(query);
      setSelectedItemHistory({ name: query, data: history });
    } catch (e) {
      alert("Gagal mengambil riwayat harga.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedReceiptId(expandedReceiptId === id ? null : id);
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

  const getMonthName = (monthKey: string) => {
    const [m, y] = monthKey.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold tracking-tight">Menghubungkan Cloud...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-40 safe-area-bottom">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[60] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-xs space-y-6">
            <div className="relative w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-700 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                style={{ width: uploadProgress > 0 ? `${uploadProgress}%` : '40%' }}
              ></div>
            </div>
            <div className="space-y-2">
              <p className="text-slate-900 font-black text-xl tracking-tight animate-pulse uppercase">Memproses...</p>
              <p className="text-slate-500 text-sm font-medium">Mohon tunggu sebentar, sedang mengirim data.</p>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Capture Preview UI */}
      {showCapturePreview && !isLoading && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-xl flex flex-col p-6 overflow-y-auto no-scrollbar">
          <div className="max-w-md mx-auto w-full flex-1 flex flex-col space-y-6 py-8">
            <div className="text-center space-y-2">
              <h2 className="text-white text-2xl font-black tracking-tight">Konfirmasi Foto</h2>
              <p className="text-slate-400 text-sm">{pendingImages.length} bagian struk siap dianalisa.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {pendingImages.map((img, idx) => (
                <div key={idx} className="relative aspect-[3/4] bg-slate-800 rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                  <img src={`data:image/jpeg;base64,${img}`} className="w-full h-full object-cover" alt="Receipt part" />
                  <div className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-black w-7 h-7 flex items-center justify-center rounded-full shadow-lg border border-white/20">
                    {idx + 1}
                  </div>
                  <button 
                    onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-xl hover:bg-red-600 shadow-lg transition-all active:scale-90"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[3/4] border-2 border-dashed border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-blue-400 hover:border-blue-500/50 transition-all bg-slate-800/50 group"
              >
                <div className="p-4 bg-slate-700 rounded-full group-hover:bg-blue-900/30 transition-colors">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Tambah Bagian</span>
              </button>
            </div>

            <div className="space-y-4 pt-6">
              <button 
                onClick={processAllImages}
                className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-lg shadow-2xl hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/10"
              >
                Analisa Struk
              </button>
              <button 
                onClick={() => {
                  setPendingImages([]);
                  setShowCapturePreview(false);
                }}
                className="w-full text-slate-400 font-bold py-3 hover:text-white transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white px-6 pt-8 pb-6 shadow-sm sticky top-0 z-30 border-b border-slate-100">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Cek Bon</h1>
            <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Personal Shopper AI</p>
          </div>
          <div className="bg-slate-900 p-3 rounded-2xl shadow-lg">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Search */}
        <section className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100">
          <div className="relative flex items-center">
            <div className="absolute left-5 text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cari harga lama: Telur..."
              className="w-full pl-14 pr-24 py-5 bg-transparent rounded-2xl focus:outline-none text-slate-800 font-semibold placeholder:text-slate-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && checkPrice(searchQuery)}
            />
            <button 
              onClick={() => checkPrice(searchQuery)}
              className="absolute right-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
            >
              Cek
            </button>
          </div>
        </section>

        {/* Confirmation Modal */}
        {isScanning && scannedData && (
          <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-blue-50 animate-in fade-in zoom-in-95 duration-300 overflow-hidden relative">
             <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Konfirmasi</h2>
              <button onClick={() => setIsScanning(false)} className="p-2 bg-slate-50 rounded-full text-slate-400 active:bg-slate-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Toko</label>
                  <input 
                    type="text" 
                    value={scannedData.store_name} 
                    placeholder="Nama Toko"
                    onChange={e => setScannedData({...scannedData, store_name: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                  <input 
                    type="date" 
                    value={scannedData.date} 
                    onChange={e => setScannedData({...scannedData, date: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Daftar Barang</label>
                <div className="bg-slate-50 rounded-3xl p-3 space-y-2 max-h-80 overflow-y-auto no-scrollbar border border-slate-100">
                  {scannedData.items?.map((item, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4 relative group">
                      <button 
                        onClick={() => removeManualItem(idx)}
                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <input 
                        type="text" 
                        value={item.name} 
                        placeholder="Nama Barang"
                        onChange={e => updateManualItem(idx, 'name', e.target.value)}
                        className="w-full text-xs font-black text-slate-800 border-b border-slate-100 pb-1 focus:outline-none focus:border-blue-500 bg-transparent"
                      />
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                           <label className="text-[8px] font-bold text-slate-400 uppercase">Qty</label>
                           <input 
                            type="number" 
                            value={item.qty} 
                            onChange={e => updateManualItem(idx, 'qty', e.target.value)}
                            className="w-full text-xs font-bold text-slate-600 focus:outline-none bg-transparent"
                           />
                        </div>
                        <div>
                           <label className="text-[8px] font-bold text-slate-400 uppercase">Harga</label>
                           <input 
                            type="number" 
                            value={item.unit_price} 
                            onChange={e => updateManualItem(idx, 'unit_price', e.target.value)}
                            className="w-full text-xs font-bold text-slate-600 focus:outline-none bg-transparent"
                           />
                        </div>
                        <div>
                           <label className="text-[8px] font-bold text-red-400 uppercase">Disc</label>
                           <input 
                            type="number" 
                            value={item.discount} 
                            onChange={e => updateManualItem(idx, 'discount', e.target.value)}
                            className="w-full text-xs font-bold text-red-500 focus:outline-none bg-transparent"
                           />
                        </div>
                        <div className="text-right">
                           <label className="text-[8px] font-bold text-slate-400 uppercase">Total</label>
                           <p className="text-xs font-black text-blue-600">Rp {item.total.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={addManualItem}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-blue-300 hover:text-blue-500 transition-all bg-white/50"
                  >
                    + Tambah Item
                  </button>
                </div>
              </div>

              {/* Input Diskon Tambahan sebelum Total Akhir */}
              <div className="bg-red-50 p-4 rounded-3xl border border-red-100 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-red-600 uppercase tracking-widest ml-1">Diskon Tambahan / Voucher</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-red-400">- Rp</span>
                    <input 
                      type="number" 
                      value={scannedData.total_discount || 0}
                      onChange={e => handleGlobalDiscountChange(Number(e.target.value))}
                      className="w-24 bg-transparent text-right font-black text-red-600 focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <p className="text-[9px] text-red-400 italic font-medium">*Gunakan ini jika ada diskon akhir di bawah struk (poin/voucher).</p>
              </div>

              <div className="bg-slate-900 rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="flex justify-between items-center relative z-10">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Struk (Net)</span>
                  <div className="flex items-center gap-1.5 text-white">
                    <span className="text-slate-500 font-black text-sm">Rp</span>
                    <p className="text-2xl font-black">{Number(scannedData.total_amount).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSaveReceipt}
              className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl shadow-xl hover:bg-blue-700 active:scale-[0.98] transition-all mt-6 uppercase text-sm border border-white/20 tracking-widest"
            >
              Simpan Ke Cloud
            </button>
          </div>
        )}

        {/* Floating Action Menu */}
        {!isScanning && !showCapturePreview && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-4 w-full max-w-xs px-4">
             <button 
              onClick={handleManualInput}
              className="w-full bg-white text-slate-600 flex items-center justify-center gap-4 py-4 rounded-3xl shadow-lg active:scale-95 transition-all border border-slate-100"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="font-bold text-sm">Input Manual</span>
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-slate-900 text-white flex items-center justify-center gap-4 py-5 rounded-[2.5rem] shadow-2xl active:scale-95 transition-all border border-white/10 ring-4 ring-slate-50/50"
            >
              <div className="bg-blue-500 p-2 rounded-xl">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
              </div>
              <span className="font-black tracking-tight text-lg">Foto Bon Baru</span>
            </button>
            <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          </div>
        )}

        {/* History List */}
        {!isScanning && !showCapturePreview && (
          <section className="space-y-4 pb-48">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Riwayat Belanja</h2>
              
              <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm w-full sm:w-auto">
                <select 
                  className="bg-transparent text-xs font-black text-slate-700 outline-none w-full appearance-none pr-6 cursor-pointer"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                >
                  <option value="all">Semua Bulan</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{getMonthName(m)}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-4 text-slate-400 sm:relative sm:right-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {filteredReceipts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-slate-500 font-black tracking-tight">Belum Ada Belanja</p>
                <p className="text-slate-300 text-xs mt-2 px-8">Data Anda akan tersimpan aman di cloud.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReceipts.map((receipt) => {
                  const isExpanded = expandedReceiptId === receipt.id;
                  return (
                    <div key={receipt.id} className={`bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-2 ring-blue-500/20 shadow-xl' : ''}`}>
                      <div onClick={() => toggleExpand(receipt.id)} className={`p-6 flex justify-between items-center cursor-pointer active:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50/50' : 'bg-white'}`}>
                        <div className="flex-1">
                          <h3 className="font-black text-slate-900 uppercase tracking-tight line-clamp-1">{receipt.store_name}</h3>
                          <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">
                            {new Date(receipt.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right">
                           <p className="text-lg font-black text-blue-600 leading-none">Rp {receipt.total_amount.toLocaleString()}</p>
                           <p className="text-[10px] text-slate-400 font-black mt-1 uppercase">{receipt.items.length} Barang</p>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-6 pt-2 space-y-3 bg-slate-50/30 animate-in slide-in-from-top-4 duration-300">
                          <div className="h-px bg-slate-100 mb-4"></div>
                          {receipt.items.map((item, i) => (
                            <div key={i} className="flex justify-between items-start p-3 bg-white rounded-2xl shadow-sm cursor-pointer active:scale-95 transition-all" onClick={(e) => { e.stopPropagation(); checkPrice(item.name); }}>
                              <div className="flex-1">
                                <p className="text-sm font-black text-slate-700 line-clamp-2">{item.name}</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-[11px] text-slate-400 font-bold">Rp {item.unit_price.toLocaleString()}/pcs</p>
                                    {item.discount > 0 && (
                                        <p className="text-[10px] text-red-500 font-black tracking-tighter">(- Rp {item.discount.toLocaleString()})</p>
                                    )}
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-sm font-black text-slate-900">Rp {item.total.toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                          
                          {/* Footer Info: Global Discount if any */}
                          {receipt.total_discount > 0 && (
                             <div className="flex justify-between items-center p-3 border-t border-slate-200 mt-2">
                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Diskon Tambahan</p>
                                <p className="text-sm font-black text-red-600">- Rp {receipt.total_discount.toLocaleString()}</p>
                             </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {selectedItemHistory && (
        <PriceHistoryModal itemName={selectedItemHistory.name} history={selectedItemHistory.data} onClose={() => setSelectedItemHistory(null)} />
      )}
    </div>
  );
};

export default App;
