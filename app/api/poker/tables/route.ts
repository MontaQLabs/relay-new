/**
 * GET /api/poker/tables
 * Returns a list of recent PokerArena tables (scanned from chain).
 *
 * GET /api/poker/tables?state=0      → only OPEN tables
 * GET /api/poker/tables?tableId=42   → single table
 */

import { NextRequest, NextResponse } from "next/server";
import { getTableInfo, getAgentInfo, getTotalBetPool } from "@/app/services/poker";

const MAX_SCAN = 200; // scan from table 0 up to MAX_SCAN

export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const stateFilter = params.get("state");
    const singleId = params.get("tableId");

    // Single table fetch
    if (singleId !== null) {
        const tid = Number(singleId);
        const table = await getTableInfo(tid);
        if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

        // Enrich with agents
        const agents = [];
        for (let s = 0; s < table.agentCount; s++) {
            const ai = await getAgentInfo(tid, s);
            if (ai) agents.push(ai);
        }
        const betPool = await getTotalBetPool(tid);

        return NextResponse.json({ table: { ...table, agents, betPoolEth: String(betPool) } });
    }

    // Scan recent tables
    const tables = [];
    for (let tid = 0; tid < MAX_SCAN; tid++) {
        const table = await getTableInfo(tid);
        if (!table) break; // contract reverts on missing tables → stop
        if (stateFilter !== null && table.state !== Number(stateFilter)) continue;
        tables.push(table);
    }

    // Return newest-first
    tables.reverse();
    return NextResponse.json({ tables });
}
