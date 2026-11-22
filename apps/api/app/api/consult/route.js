import { NextResponse } from 'next/server';
import { consultVehicle } from '../../../lib/consult.js';

export const dynamic = 'force-dynamic';

// GET /api/consult?plate=ABC1D23&uf=SP
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const plate = searchParams.get('plate');
  const uf = searchParams.get('uf');

  const report = await consultVehicle(plate, uf);
  return NextResponse.json(report, { status: report.ok ? 200 : 400 });
}
