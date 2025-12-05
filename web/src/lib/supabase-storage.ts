// Supabase storage utilities for uploading images and metadata

import { supabase } from './supabase';

// Upload image to Supabase Storage
export async function uploadImage(file: File, folder: string = 'nft-images'): Promise<string | null> {
  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Upload file
    const { data, error } = await supabase.storage
      .from('nft-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('nft-assets')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('Error in uploadImage:', err);
    return null;
  }
}

// Generate and store metadata JSON
export interface NFTMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
    creators: Array<{
      address: string;
      share: number;
    }>;
  };
}

export async function createMetadata(
  productId: string,
  brand: string,
  category: string,
  imageUrl: string,
  verifierAddress: string
): Promise<string | null> {
  try {
    // Generate metadata JSON
    const metadata: NFTMetadata = {
      name: `AuthNFT - ${brand} ${productId}`,
      symbol: 'AUTHNFT',
      description: `Official authenticity certificate for ${productId} by ${brand}. Verified on ${new Date().toLocaleDateString()}.`,
      image: imageUrl,
      attributes: [
        {
          trait_type: 'Product ID',
          value: productId
        },
        {
          trait_type: 'Brand',
          value: brand
        },
        {
          trait_type: 'Category',
          value: category
        },
        {
          trait_type: 'Verifier',
          value: verifierAddress
        },
        {
          trait_type: 'Issue Date',
          value: new Date().toISOString()
        }
      ],
      properties: {
        files: [
          {
            uri: imageUrl,
            type: 'image/png'
          }
        ],
        category: 'image',
        creators: [
          {
            address: verifierAddress,
            share: 100
          }
        ]
      }
    };

    // Convert to JSON string
    const metadataJson = JSON.stringify(metadata, null, 2);

    // Upload metadata JSON to Supabase Storage
    const fileName = `metadata_${Date.now()}_${Math.random().toString(36).substring(7)}.json`;
    const filePath = `metadata/${fileName}`;

    const { data, error } = await supabase.storage
      .from('nft-assets')
      .upload(filePath, metadataJson, {
        contentType: 'application/json',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading metadata:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('nft-assets')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('Error in createMetadata:', err);
    return null;
  }
}

// Store metadata reference in database for easy lookup
export async function saveMetadataReference(
  productId: string,
  brand: string,
  category: string,
  metadataUri: string,
  imageUrl: string,
  verifierAddress: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('nft_metadata')
      .insert({
        product_id: productId,
        brand,
        category,
        metadata_uri: metadataUri,
        image_url: imageUrl,
        verifier_address: verifierAddress,
        created_at: new Date().toISOString()
      });

    return !error;
  } catch (err) {
    console.error('Error saving metadata reference:', err);
    return false;
  }
}

