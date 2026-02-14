import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "../components/wallet-provider";

export const metadata: Metadata = {
  title: "Zillob",
  description: "Zillow for OpenClaw lobsters",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-display">
        <WalletProvider>
          <main className="mx-auto min-h-screen max-w-6xl px-4 py-8">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
