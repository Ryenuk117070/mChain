import { type Connection, type VersionedTransaction, SendTransactionError } from "@solana/web3.js"

type TxBuilder = () => Promise<VersionedTransaction> // builds + partial-signs with mint

export async function sendWithRebuildOnExpired(
  conn: Connection,
  buildTx: TxBuilder,
  walletSign: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  opts: { commitment?: "confirmed" | "finalized" } = {},
) {
  const commitment = opts.commitment ?? "confirmed"

  const tx = await buildTx()
  const signed = await walletSign(tx)

  try {
    const latest = await conn.getLatestBlockhash(commitment)
    const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 })
    await conn.confirmTransaction(
      { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      commitment,
    )
    return sig
  } catch (e: any) {
    const isBlockhashError =
      (e instanceof SendTransactionError && /Blockhash not found/i.test(e.message)) ||
      /Blockhash not found/i.test(String(e?.message ?? e))

    if (isBlockhashError) {
      console.log("[v0] Blockhash expired, rebuilding transaction with fresh blockhash...")

      const tx2 = await buildTx()
      const signed2 = await walletSign(tx2)
      const latest2 = await conn.getLatestBlockhash(commitment)
      const sig2 = await conn.sendRawTransaction(signed2.serialize(), { skipPreflight: false, maxRetries: 3 })
      await conn.confirmTransaction(
        { signature: sig2, blockhash: latest2.blockhash, lastValidBlockHeight: latest2.lastValidBlockHeight },
        commitment,
      )
      return sig2
    }

    if (e instanceof SendTransactionError) {
      try {
        console.error("[v0] On-chain logs:", await e.getLogs(conn))
      } catch {}
    }
    throw e
  }
}
