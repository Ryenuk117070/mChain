import { ExploreCard } from "@/components/explore-card"
import { createAdminClient } from "@/lib/supabase/admin"

export const revalidate = 60

export default async function RecentLaunches() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("project_launches")
    .select("name, symbol, description, image_url, mint, pump_url, dev_wallet, created_at")
    .order("created_at", { ascending: false })
    .limit(12)

  if (error) {
    return <div className="p-6 text-sm text-red-600">Failed to load recent launches: {error.message}</div>
  }

  if (!data?.length) {
    return (
      <div className="p-10 text-center">
        <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="text-lg font-medium">No launches yet.</div>
        <p className="mt-1 text-sm text-zinc-500">Launch a token to see it appear here.</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent launches</h2>
        <a
          href="/gitscreener"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white underline-offset-4 hover:underline"
        >
          View all ↗
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.map((p) => (
          <ExploreCard
            key={p.mint}
            name={p.name}
            symbol={p.symbol}
            imageUrl={p.image_url}
            mintAddress={p.mint}
            devWallet={p.dev_wallet}
            pumpUrl={p.pump_url}
            createdAt={p.created_at as any}
            description={p.description}
          />
        ))}
      </div>
    </div>
  )
}
