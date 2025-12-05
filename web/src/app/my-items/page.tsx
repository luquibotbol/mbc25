"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import Link from "next/link";
import Image from "next/image";

// Dynamically import WalletMultiButton with SSR disabled to prevent hydration errors
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

interface NFTItem {
  mint: string;
  name: string;
  uri: string;
  image?: string;
  description?: string;
  attributes?: any[];
}

export default function MyItemsPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferModal, setTransferModal] = useState<{ open: boolean; nft: NFTItem | null }>({
    open: false,
    nft: null,
  });
  const [recipientAddress, setRecipientAddress] = useState("");
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    // Always show the hardcoded Louis Vuitton bag
    const louisVuittonBag: NFTItem = {
      mint: "LV-123451243",
      name: "Louis Vuitton Bag",
      uri: "",
      image: "/my-items/lv.jpg",
      description: "Louis Vuitton Bag - Product ID: LV-123451243",
      attributes: [
        { trait_type: "Brand", value: "Louis Vuitton" },
        { trait_type: "Product ID", value: "LV-123451243" },
      ],
    };
    setNfts([louisVuittonBag]);
    
    if (publicKey && connection) {
      fetchNFTs();
    }
  }, [publicKey, connection]);

  const fetchNFTs = async () => {
    if (!publicKey || !connection) return;

    setLoading(true);
    setError(null);

    try {
      // Use Solana RPC to fetch token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        {
          programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        }
      );

      // Filter for NFTs (tokens with 0 decimals and supply of 1)
      const nftPromises = tokenAccounts.value
        .filter((account) => {
          const parsedInfo = account.account.data.parsed.info;
          return parsedInfo.tokenAmount.decimals === 0 && 
                 parsedInfo.tokenAmount.amount === "1";
        })
        .map(async (account) => {
          try {
            const mintAddress = account.account.data.parsed.info.mint;
            
            // Derive metadata PDA
            const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
              "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
            );
            const [metadataPda] = PublicKey.findProgramAddressSync(
              [
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                new PublicKey(mintAddress).toBuffer(),
              ],
              TOKEN_METADATA_PROGRAM_ID
            );

            // Fetch metadata account
            const metadataAccount = await connection.getAccountInfo(metadataPda);
            if (!metadataAccount) {
              return {
                mint: mintAddress,
                name: `NFT ${mintAddress.slice(0, 8)}...`,
                uri: "",
              };
            }

            // Parse metadata URI from account data
            // Metadata account structure: [key(1), update_authority(32), mint(32), data_size(4), name(string), symbol(string), uri(string), ...]
            const data = metadataAccount.data;
            let uri = "";
            let name = "";
            
            try {
              // Skip key (1 byte) + update_authority (32 bytes) + mint (32 bytes) + data_size (4 bytes)
              let offset = 1 + 32 + 32 + 4;
              
              // Read name (string with 4-byte length prefix)
              const nameLength = data.readUInt32LE(offset);
              offset += 4;
              name = data.slice(offset, offset + nameLength).toString('utf8').replace(/\0/g, '');
              offset += nameLength;
              
              // Read symbol (string with 4-byte length prefix)
              const symbolLength = data.readUInt32LE(offset);
              offset += 4;
              offset += symbolLength;
              
              // Read URI (string with 4-byte length prefix)
              const uriLength = data.readUInt32LE(offset);
              offset += 4;
              uri = data.slice(offset, offset + uriLength).toString('utf8').replace(/\0/g, '');
              
              // Fetch JSON metadata from URI
              let image = "";
              let description = "";
              let attributes: any[] = [];
              
              if (uri) {
                try {
                  const metadataResponse = await fetch(uri);
                  const metadataJson = await metadataResponse.json();
                  image = metadataJson.image || "";
                  description = metadataJson.description || "";
                  attributes = metadataJson.attributes || [];
                  if (!name || name === "") {
                    name = metadataJson.name || `NFT ${mintAddress.slice(0, 8)}...`;
                  }
                } catch (fetchErr) {
                  console.error(`Error fetching metadata from ${uri}:`, fetchErr);
                }
              }
              
              return {
                mint: mintAddress,
                name: name || `NFT ${mintAddress.slice(0, 8)}...`,
                uri,
                image,
                description,
                attributes,
              };
            } catch (parseErr) {
              console.error(`Error parsing metadata:`, parseErr);
              return {
                mint: mintAddress,
                name: `NFT ${mintAddress.slice(0, 8)}...`,
                uri: "",
              };
            }
          } catch (err) {
            console.error(`Error loading NFT:`, err);
            return null;
          }
        });

      const nftResults = await Promise.all(nftPromises);
      const validNfts = nftResults.filter((nft) => nft !== null) as NFTItem[];
      
      // Keep the hardcoded Louis Vuitton bag and add fetched NFTs
      const louisVuittonBag: NFTItem = {
        mint: "LV-123451243",
        name: "Louis Vuitton Bag",
        uri: "",
        image: "/my-items/lv.jpg",
        description: "Louis Vuitton Bag - Product ID: LV-123451243",
        attributes: [
          { trait_type: "Brand", value: "Louis Vuitton" },
          { trait_type: "Product ID", value: "LV-123451243" },
        ],
      };
      
      // Filter out the hardcoded item if it was already added, then add it back at the beginning
      const otherNfts = validNfts.filter((nft) => nft.mint !== "LV-123451243");
      setNfts([louisVuittonBag, ...otherNfts]);
    } catch (err: any) {
      console.error("Error fetching NFTs:", err);
      setError(err.message || "Failed to fetch NFTs");
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!publicKey || !signTransaction || !transferModal.nft || !recipientAddress) {
      return;
    }

    // Skip transfer for hardcoded LV items
    if (transferModal.nft.mint.startsWith("LV-")) {
      setError("This is a demo item and cannot be transferred.");
      setTransferModal({ open: false, nft: null });
      return;
    }

    setTransferring(true);
    setError(null);

    try {
      // Validate recipient address
      const recipientPubkey = new PublicKey(recipientAddress);
      const mintPubkey = new PublicKey(transferModal.nft.mint);

      // Get source token account (current owner's ATA)
      const sourceTokenAccount = await splToken.getAssociatedTokenAddress(
        mintPubkey,
        publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Get or create destination token account (recipient's ATA)
      const destinationTokenAccount = await splToken.getAssociatedTokenAddress(
        mintPubkey,
        recipientPubkey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Check if destination token account exists, create if not
      const destinationAccountInfo = await connection.getAccountInfo(destinationTokenAccount);
      const transaction = new Transaction();

      if (!destinationAccountInfo) {
        // Create associated token account instruction
        transaction.add(
          splToken.createAssociatedTokenAccountInstruction(
            publicKey, // payer
            destinationTokenAccount, // ata
            recipientPubkey, // owner
            mintPubkey, // mint
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Add transfer instruction
      transaction.add(
        splToken.createTransferInstruction(
          sourceTokenAccount,
          destinationTokenAccount,
          publicKey,
          1, // amount (1 for NFT)
          [],
          splToken.TOKEN_PROGRAM_ID
        )
      );

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = publicKey;

      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature, "confirmed");

      // Refresh NFTs
      await fetchNFTs();
      
      // Close modal and reset
      setTransferModal({ open: false, nft: null });
      setRecipientAddress("");
      alert(`NFT transferred successfully! View on Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    } catch (err: any) {
      console.error("Transfer error:", err);
      setError(err.message || "Failed to transfer NFT");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-slate-400 hover:text-white">
            ← Back to Home
          </Link>
        </div>

        <div className="border border-slate-800 rounded-2xl bg-slate-900/60 shadow-lg p-8">
          <h1 className="text-3xl font-semibold mb-2">My AuthNFT Certificates</h1>
          <p className="text-slate-300 mb-6">
            View all authenticity certificates in your wallet
          </p>

          <div className="mb-6">
            <WalletMultiButton />
          </div>

          {!publicKey ? (
            <div>
              <p className="text-slate-400 mb-4">Please connect your wallet to view all your NFTs</p>
              {nfts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {nfts.map((nft) => (
                    <div
                      key={nft.mint}
                      className="border border-slate-800 rounded-xl bg-slate-900/40 p-6 hover:border-emerald-600 transition-colors"
                    >
                      {nft.image ? (
                        <div className="w-full h-48 relative rounded-lg mb-4 overflow-hidden">
                          <img
                            src={nft.image}
                            alt={nft.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-48 bg-slate-800 rounded-lg mb-4 flex items-center justify-center">
                          <span className="text-slate-500">No Image</span>
                        </div>
                      )}
                      <h3 className="text-xl font-semibold mb-2">{nft.name}</h3>
                      {nft.description && (
                        <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                          {nft.description}
                        </p>
                      )}
                      {nft.attributes && nft.attributes.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-slate-500 mb-2">Attributes:</p>
                          <div className="flex flex-wrap gap-2">
                            {nft.attributes.slice(0, 3).map((attr: any, idx: number) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-1 bg-slate-800 rounded"
                              >
                                {attr.trait_type}: {attr.value}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col gap-2 mt-4">
                        {nft.mint.startsWith("LV-") ? (
                          <div className="text-sm text-slate-400">
                            Product ID: <span className="font-mono text-emerald-400">{nft.mint}</span>
                          </div>
                        ) : (
                          <>
                            <a
                              href={`https://explorer.solana.com/address/${nft.mint}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-emerald-400 hover:text-emerald-300 underline"
                            >
                              View on Explorer
                            </a>
                            {publicKey && (
                              <button
                                onClick={() => setTransferModal({ open: true, nft })}
                                className="text-sm px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                              >
                                Transfer NFT
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : loading ? (
            <p className="text-slate-400">Loading your NFTs...</p>
          ) : error ? (
            <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
              {error}
            </div>
          ) : nfts.length === 0 ? (
            <p className="text-slate-400">No NFTs found in your wallet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nfts.map((nft) => (
                <div
                  key={nft.mint}
                  className="border border-slate-800 rounded-xl bg-slate-900/40 p-6 hover:border-emerald-600 transition-colors"
                >
                  {nft.image ? (
                    <div className="w-full h-48 relative rounded-lg mb-4 overflow-hidden">
                      <img
                        src={nft.image}
                        alt={nft.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-slate-800 rounded-lg mb-4 flex items-center justify-center">
                      <span className="text-slate-500">No Image</span>
                    </div>
                  )}
                  <h3 className="text-xl font-semibold mb-2">{nft.name}</h3>
                  {nft.description && (
                    <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {nft.description}
                    </p>
                  )}
                  {nft.attributes && nft.attributes.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-slate-500 mb-2">Attributes:</p>
                      <div className="flex flex-wrap gap-2">
                        {nft.attributes.slice(0, 3).map((attr: any, idx: number) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 bg-slate-800 rounded"
                          >
                            {attr.trait_type}: {attr.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 mt-4">
                    {nft.mint.startsWith("LV-") ? (
                      <div className="text-sm text-slate-400">
                        Product ID: <span className="font-mono text-emerald-400">{nft.mint}</span>
                      </div>
                    ) : (
                      <>
                        <a
                          href={`https://explorer.solana.com/address/${nft.mint}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-emerald-400 hover:text-emerald-300 underline"
                        >
                          View on Explorer
                        </a>
                        {publicKey && (
                          <button
                            onClick={() => setTransferModal({ open: true, nft })}
                            className="text-sm px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                          >
                            Transfer NFT
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {transferModal.open && transferModal.nft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-semibold mb-4">Transfer NFT</h2>
            <div className="mb-4">
              <p className="text-slate-300 mb-2">NFT: {transferModal.nft.name}</p>
              <p className="text-sm text-slate-400 font-mono">{transferModal.nft.mint}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-slate-300 mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Enter Solana address"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setTransferModal({ open: false, nft: null });
                  setRecipientAddress("");
                  setError(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                disabled={transferring}
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!recipientAddress || transferring}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {transferring ? "Transferring..." : "Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

