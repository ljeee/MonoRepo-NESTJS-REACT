// Base URL del backend desde .env (EXPO_PUBLIC_API_BASE_URL)
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

console.log('API_BASE_URL:', API_BASE_URL);
