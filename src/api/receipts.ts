import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  const data = await sql`SELECT * FROM receipts ORDER BY date DESC`;
  return Response.json(data);
}
