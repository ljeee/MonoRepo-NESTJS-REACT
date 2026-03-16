import React, { createContext, useContext } from 'react';
import type { Api } from '../services/api';

const ApiContext = createContext<Api | null>(null);

export interface ApiProviderProps {
  api: Api;
  children: React.ReactNode;
}

export function ApiProvider({ api, children }: ApiProviderProps) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) {
    throw new Error('useApi must be used within ApiProvider. Wrap your app with <ApiProvider api={...}>.');
  }
  return api;
}
