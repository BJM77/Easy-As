
'use server';

import { planRouteFlow } from '@/ai/flows/route-planner-flow';
import type { RoutePlannerInput, RoutePlannerOutput } from '@/lib/types';
import { logAiUsage } from '@/lib/aiUsage';

// Google Maps URL has a limit on waypoints, typically start + end + 8-9 waypoints.
// We'll use a safe number like 10 total points per URL.
const MAX_WAYPOINTS_PER_URL = 10;

export async function planRoute(
  input: RoutePlannerInput
): Promise<{summary: RoutePlannerOutput; usage: any}> {
  const aiOutput = await planRouteFlow(input);

  const addressesForUrl = aiOutput.orderedAddresses;
  let googleMapsUrl = `https://www.google.com/maps/dir/${addressesForUrl
    .map(addr => encodeURIComponent(addr))
    .join('/')}`;

  const routeSegments: string[] = [];
  if (addressesForUrl.length > MAX_WAYPOINTS_PER_URL) {
    for (let i = 0; i < addressesForUrl.length; i += MAX_WAYPOINTS_PER_URL - 1) {
      const chunk = addressesForUrl.slice(i, i + MAX_WAYPOINTS_PER_URL);
      if(chunk.length > 1) {
        const segmentUrl = `https://www.google.com/maps/dir/${chunk
          .map(addr => encodeURIComponent(addr))
          .join('/')}`;
        routeSegments.push(segmentUrl);
      }
    }
    // The main URL can be the first segment for simplicity or a link to the first stop.
    googleMapsUrl = routeSegments[0] || '';
  }


  const finalOutput: RoutePlannerOutput = {
    ...aiOutput,
    googleMapsUrl,
    routeSegments: routeSegments.length > 1 ? routeSegments : undefined,
  };

  const usage = {totalTokens: 1000, inputTokens: 500, outputTokens: 500}; // Placeholder usage
  await logAiUsage('Route Planner', usage);

  return {summary: finalOutput, usage};
}
