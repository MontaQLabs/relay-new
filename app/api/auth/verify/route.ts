/**
 * API Route: Verify Wallet Signature and Issue JWT
 * 
 * This endpoint verifies the wallet signature and issues a JWT token
 * that can be used with Supabase for authenticated operations.
 * 
 * POST /api/auth/verify
 * Body: { walletAddress: string, signature: string, nonce: string }
 * Response: { token: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { cryptoWaitReady, signatureVerify } from '@polkadot/util-crypto';
import { createAuthMessage, isValidWalletAddress } from '@/app/utils/auth';

// Server-side Supabase client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// JWT secret from Supabase (found in Dashboard > Settings > API > JWT Secret)
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, signature, nonce } = body;

    // DEBUG: Log received inputs
    console.log('=== AUTH VERIFY DEBUG ===');
    console.log('Received walletAddress:', walletAddress);
    console.log('Received nonce:', nonce);
    console.log('Received signature:', signature);
    console.log('Signature length:', signature?.length);

    // Validate inputs
    if (!walletAddress || !signature || !nonce) {
      console.log('DEBUG: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, signature, nonce' },
        { status: 400 }
      );
    }

    if (!isValidWalletAddress(walletAddress)) {
      console.log('DEBUG: Invalid wallet address format');
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Ensure crypto is ready
    await cryptoWaitReady();
    console.log('DEBUG: Crypto ready');

    // Step 1: Verify the nonce exists and hasn't expired
    const { data: nonceRecord, error: nonceError } = await supabaseAdmin
      .from('auth_nonces')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('nonce', nonce)
      .gt('expires_at', new Date().toISOString())
      .single();

    console.log('DEBUG: Nonce query result:', { nonceRecord, nonceError });

    if (nonceError || !nonceRecord) {
      console.log('DEBUG: Nonce validation failed');
      return NextResponse.json(
        { error: 'Invalid or expired nonce. Please request a new one.' },
        { status: 401 }
      );
    }

    // Step 2: Use the stored message (not reconstructed, to preserve original timestamp)
    const message = nonceRecord.message;
    
    if (!message) {
      console.log('DEBUG: No message stored in nonce record! Falling back to reconstruction.');
      // Fallback for old nonce records without message field
      const reconstructedMessage = createAuthMessage(nonce, walletAddress);
      console.log('DEBUG: Reconstructed message:', reconstructedMessage);
      return NextResponse.json(
        { error: 'Nonce record missing message. Please request a new nonce.' },
        { status: 401 }
      );
    }
    
    console.log('DEBUG: Using stored message from nonce record');
    console.log('DEBUG: Message:', message);

    // Step 3: Verify the signature
    let isValid = false;
    try {
      console.log('DEBUG: Attempting signature verification...');
      console.log('DEBUG: Signature bytes (first 20):', Buffer.from(signature, 'hex').slice(0, 20));
      
      const result = signatureVerify(
        message,
        Buffer.from(signature, 'hex'),
        walletAddress
      );
      isValid = result.isValid;
      console.log('DEBUG: signatureVerify result:', result);
      console.log('DEBUG: isValid:', isValid);
    } catch (error) {
      console.error('DEBUG: Signature verification threw error:', error);
      return NextResponse.json(
        { error: 'Invalid signature format' },
        { status: 401 }
      );
    }

    if (!isValid) {
      console.log('DEBUG: Signature is NOT valid - authentication failed');
      return NextResponse.json(
        { error: 'Invalid signature. Authentication failed.' },
        { status: 401 }
      );
    }
    
    console.log('DEBUG: Signature verified successfully!');

    // Step 4: Delete the used nonce (one-time use)
    await supabaseAdmin
      .from('auth_nonces')
      .delete()
      .eq('id', nonceRecord.id);

    // Step 5: Upsert user in database
    const { error: userError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          wallet_address: walletAddress,
          last_login: new Date().toISOString(),
        },
        {
          onConflict: 'wallet_address',
        }
      );

    if (userError) {
      console.error('Failed to upsert user:', userError);
      // Continue anyway - user creation is not critical for auth
    }

    // Step 6: Generate a custom JWT for Supabase
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 60 * 60 * 24; // 24 hours

    // Create JWT using jose library (works in Edge runtime)
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT({
      wallet_address: walletAddress,
      role: 'authenticated',
      aud: 'authenticated',
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(walletAddress)
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .sign(secret);

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
