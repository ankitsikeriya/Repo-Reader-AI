import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Reporeader AI - Chat with Your Code & Documents",
    template: "%s | Reporeader AI"
  },
  description: "Reporeader AI lets you chat with your GitHub repositories and PDF documents using advanced AI. Upload your code, ask questions, and get instant answers with citations. The ultimate RAG-powered research assistant.",
  keywords: [
    "AI code assistant",
    "chat with code",
    "GitHub AI assistant",
    "PDF chat",
    "RAG application",
    "repository analyzer",
    "document AI",
    "code understanding",
    "AI research assistant",
    "NotebookLM alternative",
    "codebase chat",
    "AI documentation tool"
  ],
  authors: [{ name: "Reporeader AI" }],
  creator: "Reporeader AI",
  publisher: "Reporeader AI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://reporeader.ai",
    siteName: "Reporeader AI",
    title: "Reporeader AI - Chat with Your Code & Documents",
    description: "Upload your GitHub repos and PDFs, then chat with them using AI. Get instant answers with citations. The ultimate RAG-powered research workspace.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Reporeader AI - Chat with Your Code & Documents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reporeader AI - Chat with Your Code & Documents",
    description: "Upload your GitHub repos and PDFs, then chat with them using AI. Get instant answers with citations.",
    images: ["/og-image.png"],
    creator: "@reporeader",
  },
  alternates: {
    canonical: "https://reporeader.ai",
  },
  category: "technology",
  verification: {
    google: "your-google-verification-code",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6495ED" },
    { media: "(prefers-color-scheme: dark)", color: "#6495ED" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Reporeader AI",
              "applicationCategory": "DeveloperApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "description": "AI-powered tool to chat with your GitHub repositories and PDF documents. Upload code, ask questions, get answers with citations.",
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "150"
              },
              "featureList": [
                "Chat with GitHub repositories",
                "Chat with PDF documents",
                "AI-powered code understanding",
                "Citation-backed answers",
                "Mind map visualization",
                "Multi-source workspace"
              ]
            })
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
