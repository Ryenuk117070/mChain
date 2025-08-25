// Pump.fun API integration
import { Connection, VersionedTransaction, VersionedMessage } from "@solana/web3.js"

export interface PumpFunTokenData {
  name: string
  symbol: string
  description: string
  image: string
  twitter?: string
  telegram?: string
  website: string // This will be the GitHub repo URL
}

export interface PumpFunCreateResponse {
  mint: string
  bondingCurve: string
  associatedBondingCurve: string
  metadata: string
  metadataUri: string
}

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

// Create token on Pump.fun
export async function createPumpFunToken(
  tokenData: PumpFunTokenData,
  creatorPublicKey: string,
  buyAmount = 0,
): Promise<{ transaction: string; tokenData: PumpFunCreateResponse }> {
  try {
    console.log("[v0] Calling real Pump.fun API with data:", tokenData)

    const response = await fetch("/api/pump-fun/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...tokenData,
        creator: creatorPublicKey,
        buyAmount: buyAmount,
        walletPubkey: creatorPublicKey,
        mintPubkey: `mint_${Date.now()}`, // This will be generated server-side
        metadataUri: `ipfs://metadata_${Date.now()}`, // This will be generated server-side
      }),
    })

    console.log("[v0] Pump.fun API response status:", response.status)

    if (!response.ok) {
      const errorData = await response.json()
      console.error("[v0] Pump.fun API error:", errorData)
      throw new Error(errorData.details || `Failed to create token on Pump.fun: ${response.status}`)
    }

    const contentType = response.headers.get("content-type") || ""
    let transaction: VersionedTransaction

    if (contentType.includes("application/octet-stream")) {
      console.log("[v0] Received binary transaction data")
      const rawTransaction = new Uint8Array(await response.arrayBuffer())
      transaction = VersionedTransaction.deserialize(rawTransaction)
    } else {
      console.log("[v0] Received JSON response")
      const json = await response.json()

      if (json.transaction) {
        const rawTransaction = Buffer.from(json.transaction, "base64")
        transaction = VersionedTransaction.deserialize(rawTransaction)
      } else if (json.message) {
        const messageBytes = Buffer.from(json.message, "base64")
        const message = VersionedMessage.deserialize(messageBytes)
        transaction = new VersionedTransaction(message)
      } else {
        throw new Error("Unexpected create-tx response shape")
      }
    }

    console.log("[v0] Transaction deserialized successfully")

    if (!window.solana) {
      throw new Error("Phantom wallet not found")
    }

    console.log("[v0] Signing transaction with wallet...")
    const signedTransaction = await window.solana.signTransaction(transaction)

    console.log("[v0] Sending transaction to network...")
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "/api/solana", "confirmed")

    const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: true,
    })

    console.log("[v0] Transaction sent, signature:", signature)

    await connection.confirmTransaction(signature, "confirmed")
    console.log("[v0] Transaction confirmed")

    return {
      transaction: signature,
      tokenData: {
        mint: "generated_mint_address", // This would come from the transaction
        bondingCurve: "generated_bonding_curve",
        associatedBondingCurve: "generated_associated_bonding_curve",
        metadata: "metadata_uri",
        metadataUri: "metadata_uri",
      },
    }
  } catch (error) {
    console.error("[v0] Error in createPumpFunToken:", error)
    throw error
  }
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
