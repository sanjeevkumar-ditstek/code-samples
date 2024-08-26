import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
// Replace with your actual Google Client ID
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Initialize the OAuth2 client
const client = new OAuth2Client(CLIENT_ID);

// Define an interface for the function's return type
interface VerifyResult {
  valid: boolean;
  payload?: Record<string, any>;
  error?: string;
}

/**
 * Verifies a Google ID token.
 * @param {string} accessToken - The ID token to verify.
 * @returns {Promise<VerifyResult>} - A promise that resolves to the verification result.
 */
export async function verifyGoogleToken(
  accessToken: string
): Promise<VerifyResult> {
  try {
    // Verify the ID token
    const ticket = await client.getTokenInfo(accessToken);
    const response = await axios.get(process.env.USERINFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Extract profile information from the response
    const profile = response.data;
    const payload = {
      email: ticket?.email,
      sub: ticket?.sub,
      given_name: profile?.given_name,
      family_name: profile?.family_name
    }
    // // Return the user information
    return {
      valid: true,
      payload: payload
    };
  } catch (error) {
    // Handle the error
    return {
      valid: false,
      error: (error as Error).message
    };
  }
}
