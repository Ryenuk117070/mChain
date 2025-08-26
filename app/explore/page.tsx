import { Suspense } from "react"
import { createAdminClient } from "@/lib/supabase/admin"
import { ExploreCard } from "@/components/explore-card"
import { ExploreSkeleton } from "@/components/explore-skeleton"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function ExploreContent() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("project_launches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("[v0] Supabase error:", error)
      return (
        <div className="p-6 text-center">
          <div className="text-sm text-muted-foreground">Failed to load projects: {error.message}</div>
        </div>
      )
    }

    if (!data?.length) {
      return (
        <div className="p-6 text-center">
          <div className="text-sm text-muted-foreground">No projects launched yet.</div>
          <div className="text-xs text-muted-foreground/70 mt-1">Be the first to launch a token!</div>
        </div>
      )
    }

    return (
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Gitscreener</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((project: any) => (
            <ExploreCard
              key={`${project.mint || project.id}-${project.created_at}`}
              name={project.name || project.title || "Unnamed Token"}
              symbol={project.symbol || project.ticker || ""}
              description={project.description}
              imageUrl={project.image_url || project.image}
              mintAddress={project.mint || project.ca || ""}
              devWallet={project.dev_wallet || project.wallet || ""}
              createdAt={project.created_at}
              pumpUrl={project.pump_url || (project.mint ? `https://pump.fun/coin/${project.mint}` : undefined)}
            />
          ))}
        </div>
      </div>
    )
  } catch (error) {
    console.error("[v0] Database connection error:", error)
    return (
      <div className="p-6 text-center">
        <div className="text-sm text-muted-foreground">Unable to load projects at this time.</div>
        <div className="text-xs text-muted-foreground/70 mt-1">Please try again later.</div>
      </div>
    )
  }
}

function ExploreLoading() {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Gitscreener</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ExploreSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<ExploreLoading />}>
      <ExploreContent />
    </Suspense>
  )
}
