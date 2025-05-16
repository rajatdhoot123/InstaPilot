import { NextResponse } from 'next/server';
import { checkDbConnection } from '@/lib/db-utils';

export async function GET() {
  const isConnected = await checkDbConnection();
  if (isConnected) {
    return NextResponse.json({ status: 'ok', message: 'Database connection successful.' });
  } else {
    return NextResponse.json({ status: 'error', message: 'Database connection failed.' }, { status: 500 });
  }
} 