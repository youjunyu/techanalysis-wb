/**
 * Cron: Run watchdog health check.
 * Checks all tasks in task_registry for overdue execution.
 * Runs every 15 minutes.
 *
 * POST /api/cron/watchdog
 * Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { withJobTracking, verifyCronSecret, runWatchdog, logSystem } from "@/lib/cron";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { result } = await withJobTracking("watchdog", async () => {
      const overdue = await runWatchdog();

      const summary = {
        total_checked: overdue.length > 0 ? "some overdue" : "all healthy",
        overdue_count: overdue.length,
        overdue,
      };

      if (overdue.length > 0) {
        await logSystem("system", "warn", `Watchdog detected ${overdue.length} overdue tasks`, summary);
      }

      return summary;
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
