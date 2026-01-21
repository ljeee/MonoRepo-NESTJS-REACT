// Detectar la URL del backend dinámicamente
const getApiBaseUrl = (): string => {
	// Si hay variable de entorno, usarla
	if (process.env.EXPO_PUBLIC_API_BASE_URL) {
		return process.env.EXPO_PUBLIC_API_BASE_URL;
	}

	// En navegador, usar el mismo host que la página actual
	if (typeof window !== 'undefined') {
		const hostname = window.location.hostname;
		// Si es localhost, asumir backend en puerto 3000
		if (hostname === 'localhost' || hostname === '127.0.0.1') {
			return 'http://localhost:3000';
		}
		// Si es otra IP (red local), usar esa IP con puerto 3000
		return `http://${hostname}:3000`;
	}

	// Fallback para desarrollo
	return 'http://localhost:3000';
};

export const API_BASE_URL = getApiBaseUrl();

console.log('API_BASE_URL:', API_BASE_URL);

