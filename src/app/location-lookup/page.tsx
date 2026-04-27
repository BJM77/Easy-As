
import LocationLookupPageContent from "./page-content";
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: "Universal Lookup - BD Assist",
  description: "Search for depot, agent, zone, contact, and surcharge information.",
};

// A wrapper component to be able to use useSearchParams hook
function LocationLookupPageWrapper() {
  return <LocationLookupPageContent />;
}

export default function LocationLookupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LocationLookupPageWrapper />
    </Suspense>
  );
}
