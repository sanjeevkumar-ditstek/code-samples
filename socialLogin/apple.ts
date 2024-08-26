import verifyAppleTokenLib from 'verify-apple-id-token';

const CLIENT_ID = process.env.APPLE_CLIENT_ID;
// Define an interface for the function's return type
interface VerifyResult {
  valid: boolean;
  payload?: Record<string, any>;
  error?: string;
}

/**
 * Verifies an Apple ID token.
 * @param {string} idToken - The Apple ID token to verify.
 * @returns {Promise<VerifyResult>} - A promise that resolves to the verification result.
 */
export async function verifyAppleToken(idToken: string): Promise<VerifyResult> {
  try {
    // Verify the ID token using the external library
    const payload = await verifyAppleTokenLib({
      idToken: idToken,
      clientId: CLIENT_ID, // The client ID of your app as registered with Apple
      nonce: 'nonce' // Nonce (optional); should match the one used when generating the token
    });

    // Return the user information if verification is successful
    return {
      valid: true,
      payload: payload
    };
  } catch (error) {
    console.log('error: ', error);
    // Return an error object if verification fails
    return {
      valid: false,
      error: (error as Error).message
    };
  }
}
