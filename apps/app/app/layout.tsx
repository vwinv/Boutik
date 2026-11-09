import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { AuthBootstrap } from "../components/auth-bootstrap";
import { GlobalRequestLoading } from "../components/global-request-loading";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Espace professionnel — Boutik",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${outfit.className} antialiased`}>
        <AuthBootstrap>{children}</AuthBootstrap>
        <GlobalRequestLoading />
      </body>
    </html>
  );
}
