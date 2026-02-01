import { NextRequest, NextResponse } from 'next/server';
import { analyzeWithClaude } from '@/lib/claude';
import { PSIResult } from '@/lib/psi';

export async function POST(request: NextRequest) {
  try {
    const { mobile, desktop } = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    const results: PSIResult[] = [];
    if (mobile) results.push(mobile);
    if (desktop) results.push(desktop);

    if (results.length === 0) {
      return NextResponse.json(
        { error: 'No PSI results provided' },
        { status: 400 }
      );
    }

    const analysis = await analyzeWithClaude(results, apiKey);

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('Claude analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate analysis' },
      { status: 500 }
    );
  }
}
