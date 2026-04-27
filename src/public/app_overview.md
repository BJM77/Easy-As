# FreightMate Application Overview

This document provides a comprehensive overview of the FreightMate application, its structure, and the calculation logic used on each page.

## Application Structure (Mind Map)

```
/ (Home Page)
|
+-- /calculator (Freight Calculator)
|   |--> (Exports to Proposal)
|
+-- /ai-guru (Perfect Plan)
|   |--> (Exports Rate Card to CSV)
|
+-- /rate-card (Rate Card Generator)
|   |--> (Exports to CSV)
|   |--> (Exports to Proposal)
|
+-- /sb-comparison (Spend Band Comparison)
|
+-- /rate-comparison (New/Old Rate Comparison)
|
+-- /competitor-comparison (CRC)
|
+-- /multi (Multi-Leg Calculator)
|
+-- /location-lookup (Depot/Agent/Zone Lookup)
|
+-- /problem-log (Service Problem Log)
|
+-- /info (Info Hub / Wiki)
|
+-- /settings (Admin Settings)
|   |--> /admin/rate-uploader (Session Rate Overrides)
|
+-- /proposal (Proposal Generator)
```

---

## Page-by-Page Breakdown

### 1. Home Page (`/`)

*   **Purpose**: Acts as the central navigation hub, providing access to all tools within the application.
*   **Functionality**: Displays a grid of cards, each linking to a different page/tool.

---

### 2. Freight Calculator (`/calculator`)

*   **Purpose**: To calculate the estimated price for a single freight consignment based on origin, destination, item details, and selected surcharges.
*   **Core Calculation Logic (`calculateAllFreightPrices`)**:
    1.  **Chargeable Weight**:
        *   Calculates the total "dead weight" (sum of all items' weight).
        *   If not a satchel (`globalNoCubic` is false), it calculates the "cubic weight" for each item: `(L x W x H in cm) / 1,000,000 * CubicFactor`.
        *   The `CubicFactor` is **250** for non-pallet services and **333** for pallet services.
        *   The final `ChargeableWeight` is the **higher** of the total dead weight and total cubic weight, rounded up to the nearest whole number.
    2.  **Base Freight Calculation (per service)**: This is the most complex step and varies by `ServiceName`. The system finds a rate entry in a specific JSON file using a constructed lookup key.
        *   **B2B Std**:
            *   **File**: `b2brdex.json`
            *   **Key**: `Parcel{Origin.IPEC}{Destination.IPEC}` (e.g., `ParcelM0S0`)
            *   **Formula**: `MAX( (B[SB] + (K[SB] * ChargeableWeight)), M[SB] )` where `[SB]` is the selected Spend Band.
        *   **B2B Priority**:
            *   **File**: `b2b_priority.json`
            *   **Key**: `02 02{Origin.PRIO}{Destination.PRIO}` (e.g., `02 02MELSYD`)
            *   **Formula**: `B[SB] + (K[SB] * ChargeableWeight)`. The minimum (M) rate is not used.
        *   **B2B Pallets (Express & General Tiered)**:
            *   **File**: `pallet[SB].json` (e.g., `pallet3.json` for SB3)
            *   **Key**: `{OriginPEZone}{DestinationPEZone}Express`. The PE Zone is looked up from `PEZones.json` using the Suburb and Postcode.
            *   **Formula**: Tiered calculation. A kilo rate is selected based on `ChargeableWeight` (e.g., `E250`, `G750`). The final rate is `MAX( (Basic + (TierKiloRate * ChargeableWeight)), Min )`. `E` fields are for Express, `G` fields for General.
        *   **B2C (Std & Priority)**:
            *   **Step 1 (Lookup)**: File `regionallookup.json`, Key ` {Origin.PRIO}{Destination.PRIO}` to get a `Journey` identifier.
            *   **Step 2 (Rate)**: File `b2c.json`, Key `[SB]{Journey}`.
            *   **Formula**: Tiered rate based on `ChargeableWeight`. E.g., for B2C Std, if weight is 2.5kg, it uses the `b2c3` field. If over 5kg, it's `b2c5 + ((Weight - 5) * kg)`. `b2cp` fields are used for Priority.
        *   **LCP Services**: These are spend-band independent.
            *   **LCP Std**: File `lcprdex.json`, Key `{Origin.IPEC}{Destination.IPEC}`. Formula `(LCPRDEXKilo * Weight) + LCPRDEXBasic`.
            *   **LCP Priority**: File `lcpprio.json`, Key `LCPPrio{Origin.PRIO}{Destination.PRIO}`. Formula `(LCPPrioKg * Weight) + LCPPrioBasic`.
            *   **LCP GO**: File `lcpgo.json`, Key `GoOffPeak/GoPriority{Origin.PRIO}{Destination.PRIO}`. Tiered rate based on **Dead Weight**. Fails if dead weight > 10.01kg.
    3.  **Surcharges Application**:
        *   **Fuel Surcharge**: `BaseFreight * FuelSurchargePercent`. The percentage is taken from Settings based on the service type (Standard, Priority, Pallet).
        *   **Security Surcharge**: `BaseFreight * SecuritySurchargePercent`. Only applies to specific services (mainly Priority and B2C).
        *   **Other Surcharges**: Calculates fees for oversize items, manual handling, DG, etc., based on toggles and item properties. The values for these fees are defined in Settings.
    4.  **Final Price Assembly**:
        *   `Subtotal = BaseFreight + TotalSurcharges + GlobalExtras`
        *   `MarkupAmount = Subtotal * MarkupPercentage` (if any)
        *   `PriceBeforeGST = Subtotal + MarkupAmount`
        *   `FinalPrice = PriceBeforeGST * 1.10` (if GST applied)

---

### 3. AI-Powered "Perfect Plan" (`/ai-guru`)

*   **Purpose**: To guide a sales professional through a new customer opportunity, providing spend band analysis and generating a reciprocal rate card.
*   **Core Calculation Logic**:
    1.  **Spend Analysis**:
        *   Calculates an estimated weekly spend: `(Pallets * PalletRate) + (Parcels * ParcelRate) + (Satchels * SatchelRate)`.
        *   The base rates (`PalletRate`, etc.) are configured on the Settings page.
        *   This is extrapolated to a monthly and annual spend to recommend a Spend Band. It prioritizes user-entered spend if it's within 10% of the calculated value.
    2.  **Pricing Comparison**:
        *   For each destination the user enters, it runs the **same logic as the main calculator** (`calculateAllFreightPrices`) for multiple services using the recommended spend band.
        *   It then calculates the `Variance` by subtracting the TGE calculated price from the user's provided `TargetPrice`.
    3.  **Reciprocal Rate Card Generation**:
        *   For selected services, it iterates through all possible destination zones (IPEC, PRIO, or PE depending on the service).
        *   For each zone, it finds a sample postcode.
        *   It then directly looks up the **raw rate components** (e.g., `B3`, `K3`, `M3` for B2B Std SB3) from the relevant JSON files for that Origin-Destination zone pair.
        *   It performs this lookup for both outbound (customer -> zone) and return (zone -> customer) legs to create a full rate card. It does **not** calculate a final price, but presents the core rate components.

---

### 4. Rate Card Generator (`/rate-card`)

*   **Purpose**: To generate a detailed, exportable rate card for specific sending locations and services.
*   **Core Calculation Logic**: This page uses the exact same rate lookup logic as the **"Reciprocal Rate Card Generation"** step in the AI Guru. It looks up the raw rate components from the JSON files based on the user-selected sending locations, services, and spend band, iterating through all possible destination zones.

---

### 5. SB Comparison (`/sb-comparison`)

*   **Purpose**: To compare the price of a single consignment across all available spend bands for multiple services simultaneously.
*   **Core Calculation Logic**:
    *   For each service selected by the user, it loops through every available Spend Band (1-6).
    *   Inside the loop, it calls the main `calculateAllFreightPrices` function, passing the consignment details and the current spend band.
    *   It then aggregates the results, showing a row for each service and a column for each spend band's calculated final price.

---

### 6. New/Old Rate Comparison (`/rate-comparison`)

*   **Purpose**: To compare legacy TGE rate cards (RDEX/Prio) against the new Spend Band system for a given lane.
*   **Core Calculation Logic**:
    *   **Old Rate Cost**: It calculates a cost based on the user-uploaded or pasted rate card data (`OldBasic + (OldKilo * SampleWeight)`), applying a fuel surcharge from Settings.
    *   **New Rate Cost**: It runs the main `calculateAllFreightPrices` logic for the corresponding new service (e.g., `B2B Std` for RDEX) using the same lane and sample weight.
    *   It then displays the old cost, new cost, and the variance side-by-side for each lane.

---

### 7. Competitor Rate Comparison (CRC) (`/competitor-comparison`)

*   **Purpose**: To benchmark a list of competitor freight legs (origin, destination, weight, price) against TGE's rates.
*   **Core Calculation Logic**:
    *   For each competitor leg provided, it loops through all user-selected TGE services.
    *   For each service, it loops through all available Spend Bands (1-6).
    *   Inside the loop, it calls the main `calculateAllFreightPrices` function to get the TGE price for that specific service and spend band.
    *   It then analyzes the results to find:
        *   **Competitive SB**: The Spend Band where the TGE price is within a +/- 2% tolerance of the competitor's price.
        *   **Closest SB**: If no competitive band is found, it identifies the spend band with the smallest price difference.
        *   **Discount Needed**: It calculates the percentage discount required on the closest TGE price to match the competitor's price.
    *   **AI Analysis**: The structured results are sent to a Genkit AI flow (`analyze-competitor-rates-flow`) which provides a qualitative summary, strategic recommendations, and a customer-facing email draft.

---

### 8. Multi-Leg Calculator (`/multi`)

*   **Purpose**: To compare the cost of a direct freight route against a multi-leg route via a hub.
*   **Core Calculation Logic**:
    *   It runs the `calculateAllFreightPrices` function three times (or more if a second hub is used):
        1.  **Direct Leg**: Origin -> Destination
        2.  **Hub Leg A**: Origin -> Via Hub
        3.  **Hub Leg B**: Via Hub -> Destination
    *   It then sums the costs of Leg A and Leg B to get the total multi-leg cost.
    *   Finally, it displays the Direct Price, Multi-Leg Price, and the savings for each applicable service.

---

### Other Pages

*   **/location-lookup**: Fetches and displays data from `locations.json` and `postcodes.json` to show agent/depot details and associated zone information.
*   **/problem-log**: A simple CRUD (Create, Read, Update) interface that interacts with `/api/problems` to save and retrieve issue logs from `problems.json`.
*   **/info**: Displays static, hardcoded information about services and surcharges. It reads surcharge defaults from the Settings context.
*   **/settings**: Manages application-wide settings stored in the browser's localStorage. This includes fuel/security surcharges, custom surcharge definitions, and email templates. These settings are then consumed by the calculation logic on other pages.
*   **/proposal**: A tool to assemble a customer-facing proposal document. It pulls calculated data from the Calculator or Rate Card pages (via localStorage) and combines it with editable text sections. It does not perform any calculations itself.
