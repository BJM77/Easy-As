import RoutingPageContent from "./page-content";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Route Planner - FreightAssist.Online",
  description: "Optimize multi-stop delivery routes.",
};

export default function RoutingPage() {
  return <RoutingPageContent />;
}
