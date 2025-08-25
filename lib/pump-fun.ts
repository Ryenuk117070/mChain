export type PumpPortalTx =
  | { kind: "bytes"; bytes: Uint8Array }
  | { kind: "transaction"; base64: string }
  | { kind: "message"; base64: string }

export interface TokenMetadata {
  name: string
  symbol: string
  description: string
  image: string
  external_url: string
  attributes: Array<{
    trait_type: string
    value: string
  }>
}

// Upload metadata to IPFS (using a service like Pinata or web3.storage)
export async function uploadMetadata(metadata: TokenMetadata): Promise<string> {
  try {
    // For demo purposes, we'll simulate IPFS upload
    // In production, you'd use a service like Pinata, web3.storage, or your own IPFS node
    const response = await fetch("/api/upload-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    })

    if (!response.ok) {
      throw new Error("Failed to upload metadata")
    }

    const { uri } = await response.json()
    return uri
  } catch (error) {
    console.error("Error uploading metadata:", error)
    throw error
  }
}

export async function requestPumpCreateTx(input: {
  name: string
  symbol: string
  description: string
  image: string // URL you already uploaded
  website: string // GitHub repo URL
  walletPubkey: string
  mintPubkey: string // Added mint public key parameter
  buyAmount: number
  priorityFee?: number // Added optional priority fee parameter for blockhash retry
}): Promise<PumpPortalTx> {
  const res = await fetch("/api/pump-fun/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      symbol: input.symbol,
      description: input.description,
      image: input.image,
      website: input.website,
      creator: input.walletPubkey,
      mintPubkey: input.mintPubkey, // Send mint public key to server
      buyAmount: input.buyAmount,
      priorityFee: input.priorityFee, // Pass priority fee to server for retry logic
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error("create route failed: " + errText)
  }

  const ct = res.headers.get("content-type") || ""
  if (ct.includes("application/octet-stream")) {
    const bytes = new Uint8Array(await res.arrayBuffer())
    return { kind: "bytes", bytes }
  }
  const json = await res.json()
  if (json.transaction) return { kind: "transaction", base64: json.transaction }
  if (json.message) return { kind: "message", base64: json.message }
  throw new Error("Unexpected create response shape")
}

// Get token info from Pump.fun
export async function getPumpFunTokenInfo(mintAddress: string) {
  try {
    const response = await fetch(`/api/pump-fun/token/${mintAddress}`)

    if (!response.ok) {
      throw new Error("Failed to fetch token info")
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching token info:", error)
    throw error
  }
}
