"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_PUBKEY } from "@/lib/anchor";

// Dynamically import WalletMultiButton with SSR disabled to prevent hydration errors
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function Home() {
  const { publicKey } = useWallet();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Only render wallet-dependent content on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect admin to admin page
  useEffect(() => {
    if (publicKey && publicKey.equals(ADMIN_PUBKEY)) {
      router.push("/admin");
    }
  }, [publicKey, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <div className="max-w-xl w-full px-6 py-8 border border-slate-800 rounded-2xl bg-slate-900/60 shadow-lg">
          <h1 className="text-3xl font-semibold mb-2">AuthNFT</h1>
          <p className="text-slate-300 mb-6">
            Blockchain-backed authenticity certificates for verified luxury goods & collectibles.
          </p>

          <div className="mb-4">
            {mounted && <WalletMultiButton />}
          </div>

          {mounted && publicKey ? (
            <p className="text-sm text-emerald-300 mt-2 mb-6">
              Connected as: <span className="font-mono">{publicKey.toBase58()}</span>
            </p>
          ) : mounted ? (
            <p className="text-sm text-slate-400 mt-2 mb-6">
              Connect your Solana wallet to start verifying items or viewing certificates.
            </p>
          ) : (
            <p className="text-sm text-slate-400 mt-2 mb-6">
              Loading...
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="/verify"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium text-center transition-colors"
            >
              Verify & Mint
            </a>
            <a
              href="/my-items"
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg font-medium text-center transition-colors"
            >
              My Certificates
            </a>
          </div>
        </div>
    </main>
  );
}
