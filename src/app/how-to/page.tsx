import HowToPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "How-To Guide - Just Easy",
  description: "A comprehensive guide on how to use the Just Easy Business Development Assistant.",
};

export default function HowToPage() {
  return <HowToPageContent />;
}
