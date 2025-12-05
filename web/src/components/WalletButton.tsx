"use client";

import dynamic from "next/dynamic";

// Dynamically import WalletMultiButton with SSR disabled to prevent hydration errors
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default WalletMultiButton;

