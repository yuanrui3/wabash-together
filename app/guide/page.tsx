import type { Metadata } from "next";
import { siteProfile } from "../../lib/site-profile";
import { WalkthroughPlayer } from "./walkthrough-player";

export const metadata: Metadata = {
  title: `How to use the board | ${siteProfile.title}`,
};

export default function Guide() {
  return (
    <main className="shell guide-page">
      <a href="/#board">Back to the board</a>
      <h1>How to use the board</h1>
      <WalkthroughPlayer />
    </main>
  );
}
