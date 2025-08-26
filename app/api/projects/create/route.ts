import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export const runtime = "nodejs"

function toHttpFromIpfs(u?: string) {
  if (!u) return u
  if (u.startsWith("ipfs://")) return u.replace("ipfs://", "https://ipfs.io/ipfs/")
  return u
}

export async function POST(req: NextRequest) {
  try {
    const { name, symbol, description, mint, devWallet, imageUrl } = await req.json()

    if (!name || !symbol || !mint || !devWallet || !imageUrl) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 })
    }

    const pumpUrl = `https://pump.fun/coin/${mint}`
    const supabase = createAdminClient()

    const { error } = await supabase.from("projects").insert({
      name,
      symbol,
      description: description ?? null,
      mint,
      dev_wallet: devWallet,
      image_url: toHttpFromIpfs(imageUrl)!,
      pump_url: pumpUrl,
    })

    if (error) return NextResponse.json({ error: "db_insert_failed", detail: error.message }, { status: 500 })

    try {
      revalidatePath("/explore")
    } catch {}

    return NextResponse.json({ ok: true, pumpUrl }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: "server_error", detail: String(e?.message ?? e) }, { status: 500 })
  }
}
