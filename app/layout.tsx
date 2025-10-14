import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import TRPCProvider from '../components/TRPCProvider'
import Footer from '../components/Footer'
import ErrorBoundary from '../components/ErrorBoundary'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Programming Helper AI",
  description: "AI-powered programming assistant",
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ErrorBoundary>
            <TRPCProvider>
              <div className="min-h-screen flex flex-col">
                <main className="flex-1">
                  {children}
                </main>
                <Footer />
              </div>
            </TRPCProvider>
          </ErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}
