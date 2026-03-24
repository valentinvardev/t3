import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import Sidebar from "~/components/sidebar";

export const metadata: Metadata = {
  title: "Noted",
  description: "A modern notes and checklist app",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="flex h-screen overflow-hidden bg-zinc-950 font-sans antialiased">
        <TRPCReactProvider>
          <Sidebar />
          <main className="flex flex-1 flex-col overflow-y-auto bg-zinc-950">
            {children}
          </main>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
