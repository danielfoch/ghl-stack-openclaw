"use client";

import { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, WagmiProvider, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { WC_PROJECT_ID } from "../lib/config";

const queryClient = new QueryClient();

const config = createConfig({
  chains: [sepolia],
  connectors: [injected(), walletConnect({ projectId: WC_PROJECT_ID })],
  transports: { [sepolia.id]: http() },
});

export function WalletProvider({ children }: PropsWithChildren) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
