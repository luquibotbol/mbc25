"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

export function AppWalletProvider({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Devnet;

  // Initialize connection endpoint for Solana devnet
  // Using a more reliable RPC endpoint - you can also use Helius, QuickNode, or other providers
  const endpoint = useMemo(() => {
    // Try using a more reliable public RPC endpoint
    // You can replace this with your own RPC endpoint if you have one
    return "https://api.devnet.solana.com";
    // Alternative endpoints you can try:
    // return "https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY";
    // return clusterApiUrl("devnet"); // Default public endpoint
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      // you can add more wallets here
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

