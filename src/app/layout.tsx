import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StacksProvider } from "@/context/StacksContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stacks Blind Auction",
  description: "Decentralized blind auction platform built on Stacks using @stacks/connect and @stacks/transactions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StacksProvider>
          {children}
        </StacksProvider>
      </body>
    </html>
  );
}
