
export interface ReceiptItem {
  id?: string;
  name: string;
  qty: number;
  unit_price: number;
  discount: number;
  total: number;
}

export interface Receipt {
  id: string;
  date: string;
  store_name: string;
  total_amount: number;
  total_discount: number;
  items: ReceiptItem[];
  device_id: string;
}

export interface HistoricalPrice {
  date: string;
  unit_price: number;
  store_name: string;
}
