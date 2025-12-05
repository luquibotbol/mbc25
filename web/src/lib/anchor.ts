import { Program, AnchorProvider, Idl, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, Commitment } from "@solana/web3.js";
import idl from "./idl.json";

// Program ID - Deployed on devnet
const PROGRAM_ID = new PublicKey("PiPdvPTVMpMJ2W32Ce8uX8SLjBZ9CMDf4f9BoJBU46b");

// Metaplex Token Metadata Program ID
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Admin address - only this wallet can initialize and update authorized verifiers
export const ADMIN_PUBKEY = new PublicKey(
  "2LY2VTc5MjFW2wvJiMpuNZABWyScjfZw5pK8fXd9tPfp"
);

export function getAnchorProgram(
  connection: Connection,
  wallet: any,
  commitment: Commitment = "confirmed"
): Program<Idl> {
  console.log("[DEBUG] getAnchorProgram called with:", {
    hasConnection: !!connection,
    connectionEndpoint: connection?.rpcEndpoint,
    walletType: typeof wallet,
    walletKeys: wallet ? Object.keys(wallet) : null,
    hasPublicKey: !!wallet?.publicKey,
    publicKey: wallet?.publicKey?.toBase58?.() || null,
    hasSignTransaction: !!wallet?.signTransaction,
    hasSignAllTransactions: !!wallet?.signAllTransactions,
    signTransactionType: typeof wallet?.signTransaction,
    commitment,
  });

  const provider = new AnchorProvider(connection, wallet as Wallet, {
    commitment,
  });

  console.log("[DEBUG] AnchorProvider created:", {
    providerPublicKey: provider.publicKey?.toBase58?.() || null,
    providerWallet: provider.wallet ? Object.keys(provider.wallet) : null,
  });

  // Program constructor: (idl, provider) - program ID is read from IDL
  const program = new Program(idl as Idl, provider) as Program<Idl>;
  
  console.log("[DEBUG] Program created successfully");
  
  return program;
}

// Helper to derive state PDA with bump
export function getStatePda(): PublicKey {
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );
  return statePda;
}

// Helper to get state PDA with bump
export function getStatePdaWithBump(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );
}

export { PROGRAM_ID };

