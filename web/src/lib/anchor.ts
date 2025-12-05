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
  const provider = new AnchorProvider(connection, wallet as Wallet, {
    commitment,
  });

  // Program constructor: (idl, provider) - program ID is read from IDL
  return new Program(idl as Idl, provider) as Program<Idl>;
}

// Helper to derive state PDA
export function getStatePda(): PublicKey {
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );
  return statePda;
}

export { PROGRAM_ID };

