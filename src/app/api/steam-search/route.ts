import { NextResponse } from "next/server";
import { searchSteamApps } from "@/lib/steam/search";

/**
 * GET /api/steam-search?q=fc+26
 *
 * Public, no login required — this only reads Steam's own public search,
 * nothing account-specific or costly.
 *
 * Step 1 of "pick a game -> find its cheapest region": resolve a title to
 * its actual Steam App ID. Never assume the ID from the name — titles get
 * re-released and remastered under the same name with different app IDs.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing ?q=" }, { status: 400 });
  }

  try {
    const results = await searchSteamApps(query);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
