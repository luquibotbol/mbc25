"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { getAnchorProgram, TOKEN_METADATA_PROGRAM_ID, getStatePda, PROGRAM_ID, ADMIN_PUBKEY } from "@/lib/anchor";
import { uploadImage, createMetadata, saveMetadataReference } from "@/lib/supabase-storage";
import Link from "next/link";

// Dynamically import WalletMultiButton with SSR disabled to prevent hydration errors
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function VerifyPage() {
  const { publicKey, signTransaction, signAllTransactions, wallet, connected } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);

  // Debug wallet state
  useEffect(() => {
    console.log("[DEBUG] VerifyPage - Wallet state:", {
      connected,
      publicKey: publicKey?.toBase58(),
      hasSignTransaction: !!signTransaction,
      hasSignAllTransactions: !!signAllTransactions,
      walletName: wallet?.adapter?.name,
      walletReadyState: wallet?.adapter?.readyState,
      connectionEndpoint: connection?.rpcEndpoint,
    });
  }, [connected, publicKey, signTransaction, signAllTransactions, wallet, connection]);
  const [uploading, setUploading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [metadataUri, setMetadataUri] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    productId: "",
    brand: "",
    category: "",
    ownerAddress: "",
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setMetadataUri(null); // Reset metadata URI when image changes
    }
  };

  const handleUploadAndGenerateMetadata = async () => {
    if (!imageFile) {
      setError("Please select an image first");
      return;
    }

    if (!formData.productId || !formData.brand || !formData.category) {
      setError("Please fill in Product ID, Brand, and Category before uploading");
      return;
    }

    if (!publicKey) {
      setError("Please connect your wallet");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Step 1: Upload image
      const imageUrl = await uploadImage(imageFile);
      if (!imageUrl) {
        throw new Error("Failed to upload image");
      }

      // Step 2: Generate and upload metadata
      const metadataUrl = await createMetadata(
        formData.productId,
        formData.brand,
        formData.category,
        imageUrl,
        publicKey.toBase58()
      );

      if (!metadataUrl) {
        throw new Error("Failed to create metadata");
      }

      // Step 3: Save reference in database
      await saveMetadataReference(
        formData.productId,
        formData.brand,
        formData.category,
        metadataUrl,
        imageUrl,
        publicKey.toBase58()
      );

      setMetadataUri(metadataUrl);
      setSuccess(`Image and metadata uploaded successfully!`);
    } catch (err: any) {
      console.error("Error uploading:", err);
      setError(err.message || "Failed to upload image and generate metadata");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("[DEBUG] handleSubmit called");
    console.log("[DEBUG] Wallet state:", {
      hasPublicKey: !!publicKey,
      publicKey: publicKey?.toBase58(),
      hasSignTransaction: !!signTransaction,
      hasSignAllTransactions: !!signAllTransactions,
      signTransactionType: typeof signTransaction,
    });

    if (!publicKey || !signTransaction) {
      console.error("[DEBUG] Wallet validation failed in handleSubmit");
      setError("Please connect your wallet");
      return;
    }

    if (!metadataUri) {
      setError("Please upload an image and generate metadata first");
      return;
    }

    setLoading(true);
    setError(null);
    setTxSignature(null);
    setSuccess(null);

    try {
      console.log("[DEBUG] Creating wallet object for mint transaction");
      const walletObj = {
        publicKey: publicKey!,
        signTransaction: signTransaction!,
        signAllTransactions: signAllTransactions,
      };
      
      console.log("[DEBUG] Wallet object:", {
        hasPublicKey: !!walletObj.publicKey,
        hasSignTransaction: !!walletObj.signTransaction,
        hasSignAllTransactions: !!walletObj.signAllTransactions,
      });

      const program = getAnchorProgram(connection, walletObj as any);

      // Generate mint keypair
      const mintKeypair = Keypair.generate();
      const mintPubkey = mintKeypair.publicKey;

      // Get owner public key
      const ownerPubkey = new PublicKey(formData.ownerAddress || publicKey.toString());

      // Get associated token account
      const ownerTokenAccount = await splToken.getAssociatedTokenAddress(
        mintPubkey,
        ownerPubkey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Derive metadata PDA
      const [metadataPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mintPubkey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      // Derive master edition PDA
      const [masterEditionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mintPubkey.toBuffer(),
          Buffer.from("edition"),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      // Get state PDA
      const statePda = getStatePda();

      console.log("[DEBUG] Checking if state account exists...");
      console.log("[DEBUG] State PDA:", statePda.toBase58());
      console.log("[DEBUG] Connection endpoint:", connection.rpcEndpoint);
      
      // Check if state is initialized
      console.log("[DEBUG] Calling connection.getAccountInfo() - this might take a moment...");
      const stateAccount = await connection.getAccountInfo(statePda);
      console.log("[DEBUG] getAccountInfo completed, stateAccount exists:", !!stateAccount);
      
      if (!stateAccount) {
        // State not initialized - only admin can initialize
        if (!publicKey.equals(ADMIN_PUBKEY)) {
          throw new Error(
            `Only the admin (${ADMIN_PUBKEY.toBase58()}) can initialize the program. Please contact the admin to set up the program.`
          );
        }
        
        // Admin can initialize - but needs to specify an authorized verifier
        throw new Error(
          "Program not initialized. As admin, you need to initialize it first with an authorized verifier address. Go to /admin to initialize."
        );
      }
      
      // State exists - verify that the caller is in the authorized verifiers list
      const stateData = await (program.account as any).state.fetch(statePda);
      const verifiersList = stateData?.verifiers || [];
      
      // Convert verifiers to Pubkey array for comparison
      const verifierPubkeys = verifiersList.map((v: any) => {
        if (typeof v === 'string') {
          return new PublicKey(v);
        }
        return v;
      });
      
      const isAuthorized = verifierPubkeys.some((v: PublicKey) => v.equals(publicKey));
      
      if (!isAuthorized) {
        const verifierAddresses = verifierPubkeys.map((v: PublicKey) => v.toBase58()).join(", ");
        throw new Error(
          `You are not an authorized verifier. Authorized verifiers: ${verifierAddresses || 'none'}. Only authorized verifiers can mint NFTs.`
        );
      }

      console.log("[DEBUG] Building mint transaction:", {
        productId: formData.productId,
        mint: mintPubkey.toBase58(),
        owner: ownerPubkey.toBase58(),
        verifier: publicKey.toBase58(),
      });

      // Call mint_auth_nft
      const txBuilder = program.methods
        .mintAuthNft(
          formData.productId,
          formData.brand,
          formData.category,
          metadataUri
        )
        .accounts({
          state: statePda,
          verifier: publicKey,
          owner: ownerPubkey,
          mint: mintPubkey,
          ownerTokenAccount: ownerTokenAccount,
          metadata: metadataPda,
          masterEdition: masterEditionPda,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          associatedTokenProgram: splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        })
        .signers([mintKeypair]);

      console.log("[DEBUG] Transaction builder created");
      console.log("[DEBUG] Provider state before RPC:", {
        providerPublicKey: (program.provider as any).publicKey?.toBase58(),
        providerWallet: (program.provider as any).wallet ? Object.keys((program.provider as any).wallet) : null,
      });
      console.log("[DEBUG] Signers:", [mintKeypair.publicKey.toBase58()]);

      // Build transaction manually instead of using .rpc() to have better control
      console.log("[DEBUG] Building transaction manually...");
      const transaction = await txBuilder.transaction();
      
      console.log("[DEBUG] Transaction built, fetching recent blockhash...");
      // Get recent blockhash - required for transaction signing
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      
      // Set fee payer - required for transaction signing
      transaction.feePayer = publicKey;
      
      console.log("[DEBUG] Blockhash and fee payer set, adding signers...");
      transaction.partialSign(mintKeypair);
      
      console.log("[DEBUG] Transaction partially signed, requesting wallet signature...");
      console.log("[DEBUG] About to call signTransaction - Phantom should prompt now!");
      
      if (!signTransaction) {
        throw new Error("signTransaction is not available");
      }

      // Sign the transaction with the wallet
      const signedTx = await signTransaction(transaction);
      
      console.log("[DEBUG] Transaction signed by wallet, sending...");
      
      // Send the transaction
      const tx = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      
      console.log("[DEBUG] Transaction sent, confirming...");
      
      // Wait for confirmation
      await connection.confirmTransaction(tx, "confirmed");
      
      console.log("[DEBUG] Transaction confirmed:", tx);

      console.log("[DEBUG] Transaction sent successfully:", tx);
      setTxSignature(tx);
      setSuccess("NFT minted successfully!");
    } catch (err: any) {
      console.error("[DEBUG] Error minting NFT:", err);
      console.error("[DEBUG] Error details:", {
        message: err.message,
        name: err.name,
        stack: err.stack,
        logs: err.logs,
      });
      setError(err.message || "Failed to mint NFT");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-slate-400 hover:text-white">
            ← Back to Home
          </Link>
        </div>

        <div className="border border-slate-800 rounded-2xl bg-slate-900/60 shadow-lg p-8">
          <h1 className="text-3xl font-semibold mb-2">Verify & Mint Certificate</h1>
          <p className="text-slate-300 mb-6">
            Authenticate an item and mint an AuthNFT certificate
          </p>

          <div className="mb-6">
            <WalletMultiButton />
          </div>

          {!publicKey ? (
            <p className="text-slate-400">Please connect your wallet to continue</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image Upload Section */}
              <div>
                <label className="block text-sm font-medium mb-2">Product Image</label>
                <div className="space-y-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {imagePreview && (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full max-w-md h-64 object-cover rounded-lg border border-slate-700"
                      />
                    </div>
                  )}
                  {imageFile && !metadataUri && (
                    <button
                      type="button"
                      onClick={handleUploadAndGenerateMetadata}
                      disabled={uploading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                    >
                      {uploading ? "Uploading..." : "Upload Image & Generate Metadata"}
                    </button>
                  )}
                  {metadataUri && (
                    <div className="p-3 bg-emerald-900/20 border border-emerald-700 rounded-lg">
                      <p className="text-sm text-emerald-300 mb-1">✓ Metadata generated</p>
                      <a
                        href={metadataUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-400 hover:text-emerald-300 underline break-all"
                      >
                        {metadataUri}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Product ID</label>
                <input
                  type="text"
                  value={formData.productId}
                  onChange={(e) =>
                    setFormData({ ...formData, productId: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="SKU-1234"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Brand</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) =>
                    setFormData({ ...formData, brand: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Nike"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Sneaker"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Owner Address (leave empty to mint to yourself)
                </label>
                <input
                  type="text"
                  value={formData.ownerAddress}
                  onChange={(e) =>
                    setFormData({ ...formData, ownerAddress: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={publicKey?.toString()}
                />
              </div>

              {error && (
                <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 bg-emerald-900/20 border border-emerald-700 rounded-lg text-emerald-300">
                  {success}
                </div>
              )}

              {txSignature && (
                <div className="p-4 bg-emerald-900/20 border border-emerald-700 rounded-lg">
                  <p className="text-emerald-300 mb-2">✅ NFT minted successfully!</p>
                  <a
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline"
                  >
                    View on Solana Explorer
                  </a>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !metadataUri}
                className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {loading ? "Minting..." : "Mint AuthNFT Certificate"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
