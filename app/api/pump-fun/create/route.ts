import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Starting real Pump.fun token creation...")
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError) {
      console.log("[v0] Authentication error:", authError)
      return NextResponse.json(
        {
          error: "Authentication failed",
          details: `Supabase auth error: ${authError.message}`,
          errorCode: "AUTH_ERROR",
        },
        { status: 401 },
      )
    }
    if (!user) {
      console.log("[v0] No user found in session")
      return NextResponse.json(
        {
          error: "User not authenticated",
          details: "No valid user session found. Please log in again.",
          errorCode: "NO_USER_SESSION",
        },
        { status: 401 },
      )
    }

    let requestData
    try {
      requestData = await request.json()
    } catch (parseError) {
      console.log("[v0] Failed to parse request JSON:", parseError)
      return NextResponse.json(
        {
          error: "Invalid request format",
          details: "Request body must be valid JSON",
          errorCode: "INVALID_JSON",
        },
        { status: 400 },
      )
    }

    const { name, symbol, description, image, website, creator, mintPubkey, buyAmount, priorityFee } = requestData
    console.log("[v0] Token data received:", { name, symbol, description, creator, mintPubkey, buyAmount, priorityFee })

    const missingFields = []
    if (!name) missingFields.push("name")
    if (!symbol) missingFields.push("symbol")
    if (!description) missingFields.push("description")
    if (!creator) missingFields.push("creator")
    if (!mintPubkey) missingFields.push("mintPubkey")

    if (missingFields.length > 0) {
      console.log("[v0] Missing required fields:", missingFields)
      return NextResponse.json(
        {
          error: "Missing required fields",
          details: `The following fields are required: ${missingFields.join(", ")}`,
          missingFields,
          errorCode: "MISSING_FIELDS",
        },
        { status: 400 },
      )
    }

    if (symbol.length > 10) {
      return NextResponse.json(
        {
          error: "Invalid token symbol",
          details: "Token symbol must be 10 characters or less",
          errorCode: "INVALID_SYMBOL_LENGTH",
        },
        { status: 400 },
      )
    }

    if (name.length > 50) {
      return NextResponse.json(
        {
          error: "Invalid token name",
          details: "Token name must be 50 characters or less",
          errorCode: "INVALID_NAME_LENGTH",
        },
        { status: 400 },
      )
    }

    console.log("[v0] Using provided mint public key:", mintPubkey)

    let imageFile: File | Blob
    try {
      if (image && image.startsWith("data:")) {
        console.log("[v0] Processing base64 image...")
        const response = await fetch(image)
        if (!response.ok) {
          throw new Error(`Failed to process base64 image: ${response.status}`)
        }
        imageFile = await response.blob()
      } else if (image && image.startsWith("http")) {
        console.log("[v0] Fetching image from URL:", image)
        const response = await fetch(image)
        if (!response.ok) {
          throw new Error(`Failed to fetch image from URL: ${response.status} ${response.statusText}`)
        }
        imageFile = await response.blob()
      } else {
        console.log("[v0] Using default placeholder image")
        const defaultImageData =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg=="
        const response = await fetch(defaultImageData)
        imageFile = await response.blob()
      }
    } catch (imageError) {
      console.log("[v0] Image processing failed:", imageError)
      return NextResponse.json(
        {
          error: "Image processing failed",
          details: `Failed to process token image: ${imageError instanceof Error ? imageError.message : "Unknown image error"}`,
          errorCode: "IMAGE_PROCESSING_FAILED",
        },
        { status: 400 },
      )
    }

    const formData = new FormData()
    formData.append("file", imageFile, "token-image.png")
    formData.append("name", name)
    formData.append("symbol", symbol)
    formData.append("description", description)
    formData.append("twitter", "https://www.gitr.fun/gitscreener")
    formData.append("telegram", "")
    formData.append("website", website || "https://gitr.fun")
    formData.append("showName", "true")

    console.log("[v0] Uploading metadata to IPFS...")

    let metadataResponse
    let metadataResult
    try {
      metadataResponse = await fetch("https://pump.fun/api/ipfs", {
        method: "POST",
        body: formData,
      })

      if (!metadataResponse.ok) {
        const errorText = await metadataResponse.text()
        console.error("[v0] IPFS upload failed with status:", metadataResponse.status)
        console.error("[v0] IPFS error response:", errorText)

        if (metadataResponse.status === 413) {
          return NextResponse.json(
            {
              error: "Image too large",
              details: "The uploaded image is too large. Please use an image smaller than 15MB.",
              errorCode: "IMAGE_TOO_LARGE",
            },
            { status: 400 },
          )
        } else if (metadataResponse.status === 415) {
          return NextResponse.json(
            {
              error: "Unsupported image format",
              details: "Please use a supported image format (PNG, JPG, GIF).",
              errorCode: "UNSUPPORTED_IMAGE_FORMAT",
            },
            { status: 400 },
          )
        } else {
          return NextResponse.json(
            {
              error: "IPFS upload failed",
              details: `Pump.fun IPFS service returned error ${metadataResponse.status}: ${errorText}`,
              errorCode: "IPFS_UPLOAD_FAILED",
            },
            { status: 500 },
          )
        }
      }

      metadataResult = await metadataResponse.json()
      console.log("[v0] IPFS upload successful:", metadataResult)

      if (!metadataResult.metadataUri) {
        return NextResponse.json(
          {
            error: "Invalid IPFS response",
            details: "IPFS upload succeeded but no metadata URI was returned",
            errorCode: "INVALID_IPFS_RESPONSE",
          },
          { status: 500 },
        )
      }
    } catch (ipfsError) {
      console.error("[v0] IPFS upload network error:", ipfsError)
      return NextResponse.json(
        {
          error: "IPFS upload network error",
          details: `Failed to connect to Pump.fun IPFS service: ${ipfsError instanceof Error ? ipfsError.message : "Network error"}`,
          errorCode: "IPFS_NETWORK_ERROR",
        },
        { status: 500 },
      )
    }

    // Calling PumpPortal trade-local API...
    console.log("[v0] Calling PumpPortal trade-local API...")

    const basePriorityFee = priorityFee || 0.001
    const finalPriorityFee = priorityFee ? Math.min(priorityFee * 1.5, 0.005) : basePriorityFee
    console.log("[v0] Using priority fee:", finalPriorityFee, "(base:", basePriorityFee, ")")

    const pumpPortalPayload = {
      publicKey: creator,
      action: "create",
      tokenMetadata: {
        name: name,
        symbol: symbol,
        uri: metadataResult.metadataUri,
      },
      mint: mintPubkey,
      denominatedInSol: "true",
      amount: buyAmount ?? 1,
      slippage: 10,
      priorityFee: finalPriorityFee,
      pool: "pump",
    }

    console.log("[v0] PumpPortal payload:", pumpPortalPayload)

    let pumpPortalResponse
    try {
      pumpPortalResponse = await fetch("https://pumpportal.fun/api/trade-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pumpPortalPayload),
        duplex: "half" as any, // fixes edge runtimes
      })
    } catch (networkError) {
      console.error("[v0] PumpPortal network error:", networkError)
      return NextResponse.json(
        {
          error: "PumpPortal network error",
          details: `Failed to connect to PumpPortal: ${networkError instanceof Error ? networkError.message : "Network error"}`,
          errorCode: "PUMPPORTAL_NETWORK_ERROR",
        },
        { status: 503 },
      )
    }

    const contentType = pumpPortalResponse.headers.get("content-type") || ""
    console.log("[v0] PumpPortal response content-type:", contentType)

    if (contentType.includes("application/json")) {
      const json = await pumpPortalResponse.json()
      if (!pumpPortalResponse.ok) {
        console.error("[v0] PumpPortal JSON error:", json)
        return NextResponse.json(
          {
            error: "PumpPortal API error",
            details: json.error || `PumpPortal returned ${pumpPortalResponse.status}`,
            errorCode: "PUMPPORTAL_API_ERROR",
          },
          { status: pumpPortalResponse.status },
        )
      }
      console.log("[v0] PumpPortal JSON response:", json)
      return NextResponse.json(json, { status: 200 })
    }

    if (!pumpPortalResponse.ok) {
      const text = await pumpPortalResponse.text()
      console.error("[v0] PumpPortal error:", text)
      return NextResponse.json(
        {
          error: "PumpPortal trade-local failed",
          details: text,
          errorCode: "PUMPPORTAL_TRADE_FAILED",
        },
        { status: pumpPortalResponse.status },
      )
    }

    const transactionBuffer = await pumpPortalResponse.arrayBuffer()
    console.log("[v0] PumpPortal returned binary transaction, size:", transactionBuffer.byteLength)

    return new NextResponse(transactionBuffer, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    })
  } catch (error) {
    console.error("[v0] Unexpected error in Pump.fun token creation:", error)

    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          error: "Network connection failed",
          details: "Unable to connect to external services. Please check your internet connection and try again.",
          errorCode: "NETWORK_ERROR",
          success: false,
        },
        { status: 503 },
      )
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "Data parsing error",
          details: "Failed to parse response from external service",
          errorCode: "PARSING_ERROR",
          success: false,
        },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "An unexpected error occurred during token creation",
        errorCode: "INTERNAL_ERROR",
        success: false,
      },
      { status: 500 },
    )
  }
}
