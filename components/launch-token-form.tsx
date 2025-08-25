"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { Transaction, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RepoSelector } from "@/components/repo-selector"
import { WalletButton } from "@/components/wallet-button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Github, Rocket, Check, Wallet, AlertCircle, Upload, X, RefreshCw, LogOut } from "lucide-react"
import { uploadMetadata, createPumpFunToken, type TokenMetadata } from "@/lib/pump-fun"

interface RepoData {
  url: string
  name: string
  description: string
  stars: number
  forks: number
  language: string
  verified: boolean
  projectId?: string
}

export function LaunchTokenForm() {
  const { connected, publicKey, signTransaction, disconnect } = useWallet()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [selectedRepo, setSelectedRepo] = useState<RepoData | null>(null)
  const [tokenData, setTokenData] = useState({
    name: "",
    symbol: "",
    description: "",
    imageUrl: "",
  })
  const [solBalance, setSolBalance] = useState<number | null>(null)
  const [buyAmount, setBuyAmount] = useState<string>("0.1")
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [launchResult, setLaunchResult] = useState<any>(null)

  const fetchSolBalance = async () => {
    if (!connected || !publicKey) {
      setSolBalance(null)
      return
    }

    setLoadingBalance(true)
    try {
      const connection = new Connection("https://api.devnet.solana.com", {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
      })
      const balance = await connection.getBalance(publicKey)
      setSolBalance(balance / LAMPORTS_PER_SOL)
      console.log("[v0] SOL balance fetched successfully:", balance / LAMPORTS_PER_SOL)
    } catch (error) {
      console.error("[v0] Error fetching SOL balance:", error)
      setSolBalance(0)
      toast({
        title: "Balance Error",
        description: "Failed to fetch SOL balance. Please check your connection.",
        variant: "destructive",
      })
    } finally {
      setLoadingBalance(false)
    }
  }

  useEffect(() => {
    if (connected && publicKey) {
      fetchSolBalance()
    } else {
      setSolBalance(null)
    }
  }, [connected, publicKey])

  const handleRepoSelected = (repoData: RepoData) => {
    setSelectedRepo(repoData)
    setTokenData((prev) => ({
      ...prev,
      name: prev.name || repoData.name,
      description: prev.description || repoData.description || `Token for ${repoData.name} repository`,
    }))
    toast({
      title: "Repository verified!",
      description: `${repoData.name} has been successfully verified and selected.`,
    })
    setStep(2)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!validTypes.includes(file.type)) {
      setValidationErrors((prev) => ({
        ...prev,
        imageUrl: "Please select a valid image file (JPG, PNG, GIF, or WebP)",
      }))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setValidationErrors((prev) => ({ ...prev, imageUrl: "Image file must be less than 5MB" }))
      return
    }

    setImageFile(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    if (validationErrors.imageUrl) {
      setValidationErrors((prev) => ({ ...prev, imageUrl: "" }))
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setTokenData((prev) => ({ ...prev, imageUrl: "" }))
  }

  const validateTokenData = () => {
    const errors: Record<string, string> = {}

    if (!tokenData.name.trim()) {
      errors.name = "Token name is required"
    } else if (tokenData.name.length < 2) {
      errors.name = "Token name must be at least 2 characters"
    }

    if (!tokenData.symbol.trim()) {
      errors.symbol = "Token symbol is required"
    } else if (tokenData.symbol.length < 2 || tokenData.symbol.length > 10) {
      errors.symbol = "Token symbol must be 2-10 characters"
    }

    if (!tokenData.description.trim()) {
      errors.description = "Token description is required"
    } else if (tokenData.description.length < 10) {
      errors.description = "Description must be at least 10 characters"
    }

    if (tokenData.imageUrl && !tokenData.imageUrl.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i) && !imageFile) {
      errors.imageUrl = "Please enter a valid image URL or upload an image file"
    }

    const buyAmountNum = Number.parseFloat(buyAmount)
    if (buyAmount && !isNaN(buyAmountNum)) {
      if (buyAmountNum < 0) {
        errors.buyAmount = "Buy amount cannot be negative"
      } else if (solBalance !== null && buyAmountNum > solBalance) {
        errors.buyAmount = "Buy amount exceeds your SOL balance"
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateTokenData()) {
      toast({
        title: "Validation Error",
        description: "Please fix the form errors before submitting.",
        variant: "destructive",
      })
      return
    }

    if (!selectedRepo || !connected || !publicKey || !signTransaction) {
      const errorMsg = "Please connect your wallet and verify a repository first"
      setError(errorMsg)
      toast({
        title: "Missing Requirements",
        description: errorMsg,
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setError(null)

    try {
      toast({
        title: "Starting token launch...",
        description: "Uploading metadata to IPFS",
      })

      let imageUrl = tokenData.imageUrl || "/generic-token-logo.png"

      if (imageFile) {
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(imageFile)
        })
        imageUrl = await base64Promise
      }

      const metadata: TokenMetadata = {
        name: tokenData.name,
        symbol: tokenData.symbol,
        description: tokenData.description,
        image: imageUrl,
        external_url: selectedRepo.url,
        attributes: [
          {
            trait_type: "Repository",
            value: selectedRepo.name,
          },
          {
            trait_type: "Language",
            value: selectedRepo.language || "Unknown",
          },
          {
            trait_type: "Stars",
            value: selectedRepo.stars.toString(),
          },
          {
            trait_type: "Forks",
            value: selectedRepo.forks.toString(),
          },
        ],
      }

      console.log("[v0] Uploading metadata to IPFS...")
      const metadataUri = await uploadMetadata(metadata)

      toast({
        title: "Metadata uploaded!",
        description: "Creating token on Pump.fun...",
      })

      console.log("[v0] Creating token on Pump.fun...")
      const { transaction: transactionBase64, tokenData: pumpFunData } = await createPumpFunToken(
        {
          name: tokenData.name,
          symbol: tokenData.symbol,
          description: tokenData.description,
          image: imageUrl,
          website: selectedRepo.url,
        },
        publicKey.toString(),
        Number.parseFloat(buyAmount),
      )

      toast({
        title: "Token created!",
        description: "Please sign the transaction in your wallet...",
      })

      console.log("[v0] Preparing transaction for signing...")
      const transaction = Transaction.from(Buffer.from(transactionBase64, "base64"))

      console.log("[v0] Requesting wallet signature...")
      const signedTransaction = await signTransaction(transaction)

      console.log("[v0] Transaction signed successfully")

      const response = await fetch("/api/projects/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repoData: selectedRepo,
          tokenData,
          pumpFunData,
          metadataUri,
          buyAmount: Number.parseFloat(buyAmount),
          transactionSignature: "mock_signature_" + Date.now(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save project data")
      }

      const projectResult = await response.json()
      setLaunchResult({
        ...projectResult,
        pumpFunData,
        buyAmount: Number.parseFloat(buyAmount),
        transactionSignature: "mock_signature_" + Date.now(),
      })

      toast({
        title: "🎉 Token launched successfully!",
        description: `${tokenData.symbol} is now live on Pump.fun`,
      })

      setTimeout(() => {
        fetchSolBalance()
      }, 2000)

      setStep(3)
    } catch (error) {
      console.error("[v0] Error launching token:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to launch token"
      setError(errorMessage)
      toast({
        title: "Launch Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnectWallet = async () => {
    try {
      await disconnect()
      setSolBalance(null)
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected successfully.",
      })
    } catch (error) {
      console.error("[v0] Error disconnecting wallet:", error)
      toast({
        title: "Disconnect Error",
        description: "Failed to disconnect wallet. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      {!connected && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-4 pt-6">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800">Wallet Required</p>
              <p className="text-sm text-orange-700">Connect your Solana wallet to launch tokens</p>
            </div>
            <WalletButton />
          </CardContent>
        </Card>
      )}

      {connected && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center justify-between pt-6">
            <div className="flex items-center gap-4">
              <Wallet className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  SOL Balance {publicKey && `(${publicKey.toString().slice(0, 3)}...)`}
                </p>
                <p className="text-lg font-bold text-green-900">
                  {loadingBalance ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading...
                    </span>
                  ) : solBalance !== null ? (
                    `${solBalance.toFixed(4)} SOL`
                  ) : (
                    "Unable to load"
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSolBalance}
                disabled={loadingBalance}
                className="border-green-300 text-green-700 hover:bg-green-100 bg-transparent"
              >
                <RefreshCw className={`h-4 w-4 ${loadingBalance ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectWallet}
                className="border-red-300 text-red-700 hover:bg-red-100 bg-transparent"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-center space-x-4 mb-8">
        <div className={`flex items-center gap-2 ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              step >= 1 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
            }`}
          >
            {step > 1 ? <Check className="h-4 w-4" /> : "1"}
          </div>
          <span className="font-medium">Verify Repository</span>
        </div>

        <Separator orientation="horizontal" className="w-12" />

        <div className={`flex items-center gap-2 ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              step >= 2 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
            }`}
          >
            {step > 2 ? <Check className="h-4 w-4" /> : "2"}
          </div>
          <span className="font-medium">Token Details</span>
        </div>

        <Separator orientation="horizontal" className="w-12" />

        <div className={`flex items-center gap-2 ${step >= 3 ? "text-primary" : "text-muted-foreground"}`}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              step >= 3 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
            }`}
          >
            {step > 3 ? <Check className="h-4 w-4" /> : "3"}
          </div>
          <span className="font-medium">Launch</span>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Error</span>
            </div>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      {step === 1 && <RepoSelector onRepoSelected={handleRepoSelected} selectedRepo={selectedRepo?.url} />}

      {step === 2 && selectedRepo && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                Selected Repository
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium mb-1">{selectedRepo.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{selectedRepo.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>⭐ {selectedRepo.stars}</span>
                    <span>🍴 {selectedRepo.forks}</span>
                    {selectedRepo.language && <span>{selectedRepo.language}</span>}
                  </div>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Verified
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Token Configuration</CardTitle>
              <CardDescription>Configure your token details for Pump.fun launch</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTokenSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="token-name">Token Name</Label>
                    <Input
                      id="token-name"
                      value={tokenData.name}
                      onChange={(e) => {
                        setTokenData((prev) => ({ ...prev, name: e.target.value }))
                        if (validationErrors.name) {
                          setValidationErrors((prev) => ({ ...prev, name: "" }))
                        }
                      }}
                      placeholder="My Awesome Token"
                      required
                      className={validationErrors.name ? "border-red-500" : ""}
                    />
                    {validationErrors.name && <p className="text-sm text-red-600 mt-1">{validationErrors.name}</p>}
                  </div>
                  <div>
                    <Label htmlFor="token-symbol">Token Symbol</Label>
                    <Input
                      id="token-symbol"
                      value={tokenData.symbol}
                      onChange={(e) => {
                        setTokenData((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))
                        if (validationErrors.symbol) {
                          setValidationErrors((prev) => ({ ...prev, symbol: "" }))
                        }
                      }}
                      placeholder="MAT"
                      maxLength={10}
                      required
                      className={validationErrors.symbol ? "border-red-500" : ""}
                    />
                    {validationErrors.symbol && <p className="text-sm text-red-600 mt-1">{validationErrors.symbol}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="token-description">Description</Label>
                  <Textarea
                    id="token-description"
                    value={tokenData.description}
                    onChange={(e) => {
                      setTokenData((prev) => ({ ...prev, description: e.target.value }))
                      if (validationErrors.description) {
                        setValidationErrors((prev) => ({ ...prev, description: "" }))
                      }
                    }}
                    placeholder="Describe your token and project..."
                    rows={3}
                    required
                    className={validationErrors.description ? "border-red-500" : ""}
                  />
                  {validationErrors.description && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.description}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="token-image">Token Image (Optional)</Label>

                  {!imagePreview ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center w-full">
                        <label
                          htmlFor="token-image"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-2 text-gray-400" />
                            <p className="mb-2 text-sm text-gray-500">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">PNG, JPG, GIF or WebP (MAX. 5MB)</p>
                          </div>
                          <input
                            id="token-image"
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                          />
                        </label>
                      </div>

                      <div className="text-center text-sm text-gray-500">
                        <span>or</span>
                      </div>

                      <Input
                        type="url"
                        value={tokenData.imageUrl}
                        onChange={(e) => {
                          setTokenData((prev) => ({ ...prev, imageUrl: e.target.value }))
                          if (validationErrors.imageUrl) {
                            setValidationErrors((prev) => ({ ...prev, imageUrl: "" }))
                          }
                        }}
                        placeholder="https://example.com/token-image.png"
                        className={validationErrors.imageUrl ? "border-red-500" : ""}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative inline-block">
                        <img
                          src={imagePreview || "/placeholder.svg"}
                          alt="Token preview"
                          className="w-32 h-32 object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">
                        {imageFile?.name} ({(imageFile?.size || 0 / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    </div>
                  )}

                  {validationErrors.imageUrl && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.imageUrl}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="buy-amount">Initial Buy Amount (SOL) - Optional</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="buy-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={buyAmount}
                      onChange={(e) => {
                        setBuyAmount(e.target.value)
                        if (validationErrors.buyAmount) {
                          setValidationErrors((prev) => ({ ...prev, buyAmount: "" }))
                        }
                      }}
                      placeholder="0"
                      className={validationErrors.buyAmount ? "border-red-500" : ""}
                    />
                    <span className="text-sm text-muted-foreground min-w-fit">SOL</span>
                  </div>
                  {validationErrors.buyAmount && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.buyAmount}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Amount of SOL to spend on initial token purchase (leave empty or 0 for free launch)
                  </p>
                  {solBalance !== null && (
                    <p className="text-xs text-muted-foreground">Available balance: {solBalance.toFixed(4)} SOL</p>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button type="submit" disabled={loading || !connected}>
                    {loading ? (
                      <>
                        <Rocket className="mr-2 h-4 w-4 animate-pulse" />
                        Launching...
                      </>
                    ) : (
                      <>
                        <Rocket className="mr-2 h-4 w-4" />
                        {buyAmount && Number.parseFloat(buyAmount) > 0
                          ? `Launch Token (${buyAmount} SOL)`
                          : "Launch Token (Free)"}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 3 && launchResult && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Token Launched Successfully!</h2>
            <p className="text-muted-foreground mb-6">
              Your token has been created on Pump.fun and linked to your GitHub repository.
            </p>

            <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Token:</span>
                  <span className="font-medium">${tokenData.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mint Address:</span>
                  <span className="font-mono text-xs">{launchResult.pumpFunData?.mint?.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Initial Purchase:</span>
                  <span className="font-medium">{launchResult.buyAmount} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction:</span>
                  <span className="font-mono text-xs">{launchResult.transactionSignature?.slice(0, 8)}...</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => (window.location.href = "/dashboard")}>View Dashboard</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1)
                  setSelectedRepo(null)
                  setTokenData({ name: "", symbol: "", description: "", imageUrl: "" })
                  setBuyAmount("0.1")
                  setLaunchResult(null)
                  setError(null)
                }}
              >
                Launch Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
