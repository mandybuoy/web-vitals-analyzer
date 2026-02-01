import { NextRequest, NextResponse } from 'next/server';
import { fetchPSI, PSIResult } from '@/lib/psi';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PSI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google PSI API key not configured' },
        { status: 500 }
      );
    }

    // Fetch both mobile and desktop in parallel
    const [mobileResult, desktopResult] = await Promise.all([
      fetchPSI(url, 'mobile', apiKey),
      fetchPSI(url, 'desktop', apiKey),
    ]);

    return NextResponse.json({
      mobile: mobileResult,
      desktop: desktopResult,
    });
  } catch (error: any) {
    console.error('PSI fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch PageSpeed data' },
      { status: 500 }
    );
  }
}
