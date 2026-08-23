/**
 * Health check endpoint.
 * GET /api/health
 */

import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
}
