
import React from 'react';
import { Receipt } from '../types';

interface PriceHistoryModalProps {
  itemName: string;
  history: Receipt[];
  onClose: () => void;
}

const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({ itemName, history, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="p-5 border-b flex justify-between items-center sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-lg text-slate-800">Riwayat Harga</h3>
            <p className="text-xs text-blue-600 font-medium">Mencari: "{itemName}"</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto space-y-4 bg-slate-50/30">
          {history.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-slate-400 font-medium">Tidak ada item yang cocok.</p>
            </div>
          ) : (
            history.map((receipt) => {
              // Get all items in this receipt that match the search term
              const matchedItems = receipt.items.filter(i => 
                i.name.toLowerCase().includes(itemName.toLowerCase())
              );

              return matchedItems.map((item, idx) => (
                <div key={`${receipt.id}-${idx}`} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm hover:border-blue-200 transition-all">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 truncate">{receipt.store_name}</p>
                    <p className="text-sm font-bold text-slate-800 line-clamp-1">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">
                        {new Date(receipt.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {item.qty > 1 && (
                        <span className="text-[10px] text-slate-400 font-medium italic">Beli {item.qty} pcs</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Harga Unit</p>
                    <p className="font-black text-blue-600 text-lg leading-none">Rp {item.unit_price.toLocaleString()}</p>
                  </div>
                </div>
              ));
            })
          )}
        </div>
        <div className="p-5 bg-white border-t sm:hidden">
          <button onClick={onClose} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">Tutup</button>
        </div>
      </div>
    </div>
  );
};

export default PriceHistoryModal;
