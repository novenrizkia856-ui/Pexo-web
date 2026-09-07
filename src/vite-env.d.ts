/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * WalletConnect (Reown) project id. Optional: without it the app still runs,
   * and simply does not offer the WalletConnect connector. See `src/lib/chain.ts`.
   */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
