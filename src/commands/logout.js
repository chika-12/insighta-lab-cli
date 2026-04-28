import client from '../api/client.js';
import { clearTokens, hasTokens, getTokens } from '../auth/tokenStore.js';

export async function logoutAction() {
  if (!hasTokens()) {
    console.log('\nℹ  You are not currently logged in.\n');
    return;
  }

  try {
    const { refreshToken } = getTokens();
    await client.post('/auth/logout', { refreshToken });
  } catch {
    // Non-fatal — clear locally regardless
  } finally {
    clearTokens();
    console.log('\n✔  Logged out. Tokens cleared.\n');
  }
}
