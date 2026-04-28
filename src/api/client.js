import axios from 'axios';
import { getTokens, saveTokens, clearTokens } from '../auth/tokenStore.js';
const BASE_URL = 'https://hngintern-production-7bfd.up.railway.app';

const client = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const tokens = getTokens();
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      const tokens = getTokens();

      if (!tokens?.refreshToken) {
        clearTokens();
        console.error('\n✖  Session expired. Please run: insighta login\n');
        process.exit(1);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
          refreshToken: tokens.refreshToken,
        });
        saveTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? tokens.refreshToken,
        });
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return client(original);
      } catch {
        clearTokens();
        console.error('\n✖  Session expired. Please run: insighta login\n');
        process.exit(1);
      }
    }

    return Promise.reject(error);
  }
);
export default client;