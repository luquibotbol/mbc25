"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Home() {
  const { publicKey } = useWallet();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <div className="max-w-xl w-full px-6 py-8 border border-slate-800 rounded-2xl bg-slate-900/60 shadow-lg">
          <h1 className="text-3xl font-semibold mb-2">AuthNFT</h1>
          <p className="text-slate-300 mb-6">
            Blockchain-backed authenticity certificates for verified luxury goods & collectibles.
          </p>

          <div className="mb-4">
            <WalletMultiButton />
          </div>

          {publicKey ? (
            <p className="text-sm text-emerald-300 mt-2">
              Connected as: <span className="font-mono">{publicKey.toBase58()}</span>
            </p>
          ) : (
            <p className="text-sm text-slate-400 mt-2">
              Connect your Solana wallet to start verifying items or viewing certificates.
            </p>
          )}
        </div>
    </main>
  );
}
