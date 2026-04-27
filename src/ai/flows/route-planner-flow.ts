'use server';
/**
 * @fileOverview An AI agent that optimizes a delivery route.
 */

import '@/lib/handlebars-helpers'; // Ensure custom helpers are registered, just in case.
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type {RoutePlannerInput, RoutePlannerAIOutput} from '@/lib/types';
import {StopSchema, RoutePlannerInputSchema, RoutePlannerAIOutputSchema} from '@/lib/types';

const plannerPrompt = ai.definePrompt(
  {
    name: 'routePlannerPrompt',
    // The input schema for the prompt now includes the pre-categorized arrays.
    input: {schema: RoutePlannerInputSchema.extend({
      timeSensitiveStops: z.array(StopSchema),
      standardStops: z.array(StopSchema),
      largeParcelStops: z.array(StopSchema),
    })},
    output: {schema: RoutePlannerAIOutputSchema},
    prompt: `You are a logistics and route optimization expert for Western Australia. Your task is to create the most efficient delivery route from a given list of stops, starting from a depot.

    Here are the details:
    - The route STARTS at the depot: {{startLocation}}
    - There are a total of {{stops.length}} stops.

    CRITICAL CONSTRAINTS (TIME SENSITIVE STOPS):
    You MUST prioritize the following stops to ensure they are visited near their requested time. Build the route skeleton around these first.
    {{#each timeSensitiveStops}}
      - MUST VISIT: {{this.address}} AT OR BEFORE {{this.description}}
    {{/each}}
    
    STANDARD & LARGE PARCEL STOPS:
    Fit these stops into the route efficiently around the priority stops.
     {{#each standardStops}}
      - {{this.address}} ({{this.description}})
    {{/each}}
    {{#each largeParcelStops}}
      - {{this.address}} ({{this.description}})
    {{/each}}

    Your instructions are:
    1.  **Start at the Depot:** The route begins at the 'startLocation'. All stops must be ordered based on the most efficient path *from* this starting point.
    2.  **Prioritize Time-Sensitive Stops:** Analyze the "Time Sensitive" stops. Place them into the sequence at logical points to meet their required times. Assume the route starts at 8:00 AM for planning purposes.
    3.  **Optimize the Route:** Weave the "Standard" and "Large Parcel" stops into the sequence around the time-sensitive ones. Group stops that are geographically close to each other.
    4.  **Provide Ordered Stops:** In the 'optimizedRoute' array, return the complete list of all stops in the most efficient final order. **DO NOT include the 'startLocation' depot in this list.**
    5.  **Provide Full Ordered Address List:** In the 'orderedAddresses' array, return a simple list of the full address strings in the correct, optimized order. The first item in this list MUST be the 'startLocation', followed by the optimized delivery addresses.
    6.  **Estimate Total Time:** Provide a realistic, high-level estimate of the total time the route will take, from leaving the depot to the final stop. Assume an average of 5-10 minutes of driving time between each stop and 3 minutes of handling time at each stop. Provide the result as a range (e.g., "2-3 hours").
    7.  **Identify Risks:** Analyze the route and identify any potential risks. For example, if two time-sensitive deliveries are far apart with little time in between, that is a risk. If there are many stops, mention that traffic could be a factor.
    
    Return the result in the specified JSON format. Do NOT generate the final Google Maps URL yourself.
    `,
  }
);

const routePlannerFlow = ai.defineFlow(
  {
    name: 'routePlannerFlow',
    inputSchema: RoutePlannerInputSchema,
    outputSchema: RoutePlannerAIOutputSchema,
  },
  async (input) => {
    // Pre-categorize stops before calling the prompt
    const timeSensitiveStops = input.stops.filter(stop => stop.type === "Time Sensitive");
    const standardStops = input.stops.filter(stop => stop.type === "Standard");
    const largeParcelStops = input.stops.filter(stop => stop.type === "Large Parcel");

    // Pass the categorized arrays to the prompt
    const {output} = await plannerPrompt({
        ...input,
        timeSensitiveStops,
        standardStops,
        largeParcelStops,
    });
    
    if (!output) {
      throw new Error('AI failed to generate a route plan.');
    }
    return output;
  }
);

export async function planRouteFlow(input: RoutePlannerInput): Promise<RoutePlannerAIOutput> {
    return await routePlannerFlow(input);
}
