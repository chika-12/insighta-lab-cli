import http from 'http';
import open from 'open';
import { saveTokens } from '../auth/tokenStore.js';
const BASE_URL = 'https://hngstage3-production.up.railway.app';
const CALLBACK_PORT = 4242;
export async function loginAction() {
  const authUrl = `${BASE_URL}/api/v1/auth/github?source=cli`;

  console.log('\n🔐  Opening GitHub login in your browser…');
  console.log(`    If it doesn't open automatically:\n    ${authUrl}\n`);

  await open(authUrl);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);

      if (url.pathname !== '/') {
        res.end('Not found');
        return;
      }

      const accessToken = url.searchParams.get('accessToken');
      const refreshToken = url.searchParams.get('refreshToken');

      if (!accessToken || !refreshToken) {
        res.writeHead(400);
        res.end('<h2>Login failed. Missing tokens. Please try again.</h2>');
        server.close();
        reject(new Error('Missing tokens in callback'));
        return;
      }

      saveTokens({ accessToken, refreshToken });

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html><body style="font-family:sans-serif;padding:2rem;text-align:center">
          <h2>✅ Login successful!</h2>
          <p>You can close this tab and return to your terminal.</p>
        </body></html>
      `);

      server.close();
      console.log('✔  Logged in successfully!\n');
      resolve();
    });

    server.listen(CALLBACK_PORT);
  });
}
