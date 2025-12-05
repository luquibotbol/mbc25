"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { getAnchorProgram, TOKEN_METADATA_PROGRAM_ID, getStatePda, PROGRAM_ID, ADMIN_PUBKEY } from "@/lib/anchor";
import { uploadImage, createMetadata, saveMetadataReference } from "@/lib/supabase-storage";
import Link from "next/link";

export default function VerifyPage() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
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
    if (!publicKey || !signTransaction) {
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
      const program = getAnchorProgram(connection, {
        publicKey: publicKey!,
        signTransaction: signTransaction!,
        signAllTransactions: signAllTransactions,
      } as any);

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

      // Check if state is initialized
      const stateAccount = await connection.getAccountInfo(statePda);
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
      
      // State exists - verify that the caller is the authorized verifier
      const stateData = await (program.account as any).state.fetch(statePda);
      // The field name in the IDL is "authorized_verifier" (snake_case)
      const authorizedVerifierPubkey = stateData?.authorized_verifier || stateData?.authorizedVerifier;
      if (!authorizedVerifierPubkey || !authorizedVerifierPubkey.equals(publicKey)) {
        throw new Error(
          `You are not an authorized verifier. Authorized verifier: ${authorizedVerifierPubkey?.toBase58() || 'unknown'}. Only authorized verifiers can mint NFTs.`
        );
      }

      // Call mint_auth_nft
      const tx = await program.methods
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
        .signers([mintKeypair])
        .rpc();

      setTxSignature(tx);
      setSuccess("NFT minted successfully!");
    } catch (err: any) {
      console.error("Error minting NFT:", err);
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
