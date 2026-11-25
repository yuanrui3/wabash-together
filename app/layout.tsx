import type { Metadata } from "next";
import "./globals.css";
import { siteProfile } from "../lib/site-profile";

export const metadata: Metadata = {
  title: `${siteProfile.title} | Carpool and car-share introductions`,
  description: siteProfile.description,
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
