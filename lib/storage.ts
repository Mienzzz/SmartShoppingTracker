import { neon } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';
import { Receipt } from '../types';

const DATABASE_URL = 'postgresql://neondb_owner:npg_TveYL6pSQ1aU@ep-tiny-violet-ah8rr2da-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Pastikan variabel SQL hanya dibuat sekali
const sql = neon(DATABASE_URL);
const DEVICE_ID_KEY = 'smart_shopping_device_id';

export const getDeviceId = (): string => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

export const ensureSchema = async () => {
  try {
    // Jalankan perintah schema dasar
    await sql`
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        store_name TEXT NOT NULL,
        total_amount NUMERIC NOT NULL,
        total_discount NUMERIC DEFAULT 0,
        device_id TEXT NOT NULL
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS receipt_items (
        id SERIAL PRIMARY KEY,
        receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        qty NUMERIC NOT NULL,
        unit_price NUMERIC NOT NULL,
        discount NUMERIC DEFAULT 0,
        total NUMERIC NOT NULL
      );
    `;
  } catch (error) {
    console.error("Database Schema Error:", error);
    // Jangan lempar error agar aplikasi tetap bisa terbuka meski DB sedang bermasalah
  }
};

export const saveReceiptToNeon = async (receipt: Omit<Receipt, 'id'>) => {
  const deviceId = getDeviceId();
  const receiptRows = await sql`
    INSERT INTO receipts (date, store_name, total_amount, total_discount, device_id)
    VALUES (${receipt.date}, ${receipt.store_name}, ${receipt.total_amount}, ${receipt.total_discount || 0}, ${deviceId})
    RETURNING id;
  `;
  const receiptId = receiptRows[0].id;

  for (const item of receipt.items) {
    await sql`
      INSERT INTO receipt_items (receipt_id, name, qty, unit_price, discount, total)
      VALUES (${receiptId}, ${item.name}, ${item.qty}, ${item.unit_price}, ${item.discount || 0}, ${item.total});
    `;
  }
  return { ...receipt, id: receiptId };
};

export const getReceiptsFromNeon = async (): Promise<Receipt[]> => {
  const deviceId = getDeviceId();
  try {
    const receipts = await sql`
      SELECT id, date, store_name, total_amount, total_discount, device_id 
      FROM receipts 
      WHERE device_id = ${deviceId} 
      ORDER BY date DESC;
    `;
    if (receipts.length === 0) return [];
    
    const items = await sql`
      SELECT ri.id, ri.receipt_id, ri.name, ri.qty, ri.unit_price, ri.discount, ri.total 
      FROM receipt_items ri
      JOIN receipts r ON ri.receipt_id = r.id
      WHERE r.device_id = ${deviceId};
    `;

    return receipts.map(r => ({
      id: r.id,
      date: new Date(r.date).toISOString().split('T')[0],
      store_name: r.store_name,
      total_amount: Number(r.total_amount),
      total_discount: Number(r.total_discount || 0),
      device_id: r.device_id,
      items: items
        .filter(i => i.receipt_id === r.id)
        .map(i => ({
          id: i.id,
          name: i.name,
          qty: Number(i.qty),
          unit_price: Number(i.unit_price),
          discount: Number(i.discount),
          total: Number(i.total)
        }))
    })) as Receipt[];
  } catch (error) {
    console.error("Load Receipts Error:", error);
    return [];
  }
};

export const findHistoricalPrices = async (itemName: string): Promise<Receipt[]> => {
  const deviceId = getDeviceId();
  const searchPattern = `%${itemName.toLowerCase()}%`;
  try {
    const matchingReceipts = await sql`
      SELECT DISTINCT r.id, r.date, r.store_name, r.total_amount, r.total_discount, r.device_id 
      FROM receipts r
      JOIN receipt_items ri ON r.id = ri.receipt_id
      WHERE r.device_id = ${deviceId} 
      AND LOWER(ri.name) LIKE ${searchPattern}
      ORDER BY r.date DESC;
    `;
    if (matchingReceipts.length === 0) return [];
    const receiptIds = matchingReceipts.map(r => r.id);
    const items = await sql`
      SELECT id, receipt_id, name, qty, unit_price, discount, total 
      FROM receipt_items 
      WHERE receipt_id = ANY(${receiptIds});
    `;
    return matchingReceipts.map(r => ({
      id: r.id,
      date: new Date(r.date).toISOString().split('T')[0],
      store_name: r.store_name,
      total_amount: Number(r.total_amount),
      total_discount: Number(r.total_discount || 0),
      device_id: r.device_id,
      items: items
        .filter(i => i.receipt_id === r.id)
        .map(i => ({
          id: i.id,
          name: i.name,
          qty: Number(i.qty),
          unit_price: Number(i.unit_price),
          discount: Number(i.discount),
          total: Number(i.total)
        }))
    })) as Receipt[];
  } catch (error) {
    console.error("Search History Error:", error);
    return [];
  }
};