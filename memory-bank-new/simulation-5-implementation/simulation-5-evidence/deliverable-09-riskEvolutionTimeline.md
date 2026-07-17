**Title:** Risk Evolution Timeline

**Total Events:** 8

## Events

### Item 1

**Type:** DONOR_WITHDRAWAL

**Severity:** CRITICAL

**Financial Impact:** -180009

**Timeline Impact:** 0

## Districts

_(empty)_

**Description:** Major donor withdraws funding

**Key:** donor_withdrawal

**Day:** 55

**Timestamp:** 2026-07-16T18:06:51.665Z

**Is Cascade:** false



### Item 2

**Type:** FLOOD

**Severity:** HIGH

**Financial Impact:** -37004

**Timeline Impact:** 4

## Districts

- B
- C

**Description:** Heavy flooding closes roads and damages supplies

**Key:** flood

**Day:** 56

**Timestamp:** 2026-07-16T18:06:51.678Z

**Is Cascade:** false



### Item 3

**Key:** cascade_flood_0

**Type:** CASCADE_ROAD

**Severity:** HIGH

**Title:** Cascade 1: Road to District C becomes impassable

**Description:** Road to District C becomes impassable

**Affected Department:** Logistics

**Financial Impact:** -13078

**Timeline Impact:** 1

## Districts

- B
- C

**Day:** 57

**Is Cascade:** true

**Parent Event Key:** flood

**Cascade Stage:** 1

**Timestamp:** 2026-07-16T18:06:51.679Z



### Item 4

**Key:** cascade_flood_1

**Type:** CASCADE_SAM

**Severity:** HIGH

**Title:** Cascade 2: SAM treatment at risk due to RUTF shortage

**Description:** SAM treatment at risk due to RUTF shortage

**Affected Department:** Nutrition

**Financial Impact:** -8905

**Timeline Impact:** 3

## Districts

- B
- C

**Day:** 59

**Is Cascade:** true

**Parent Event Key:** flood

**Cascade Stage:** 2

**Timestamp:** 2026-07-16T18:06:51.679Z



### Item 5

**Key:** cascade_flood_2

**Type:** CASCADE_FAMILIES

**Severity:** CRITICAL

**Title:** Cascade 3: Families begin removing children from program

**Description:** Families begin removing children from program

**Affected Department:** Community

**Financial Impact:** -9270

**Timeline Impact:** 4

## Districts

- B
- C

**Day:** 60

**Is Cascade:** true

**Parent Event Key:** flood

**Cascade Stage:** 3

**Timestamp:** 2026-07-16T18:06:51.679Z



### Item 6

**Type:** GOOGLE_OUTAGE

**Severity:** MEDIUM

**Financial Impact:** -4906

**Timeline Impact:** 1

## Districts

_(empty)_

**Description:** Google Workspace unavailable for 24 hours

**Key:** google_outage

**Day:** 57

**Timestamp:** 2026-07-16T18:06:51.697Z

**Is Cascade:** false



### Item 7

**Type:** BREVO_OUTAGE

**Severity:** MEDIUM

**Financial Impact:** -2443

**Timeline Impact:** 1

## Districts

_(empty)_

**Description:** Email service Brevo goes down

**Key:** brevo_outage

**Day:** 58

**Timestamp:** 2026-07-16T18:06:51.716Z

**Is Cascade:** false



### Item 8

**Type:** GOOGLE_OUTAGE

**Severity:** MEDIUM

**Financial Impact:** -5284

**Timeline Impact:** 1

## Districts

_(empty)_

**Description:** Google Workspace unavailable for 24 hours

**Key:** google_outage

**Day:** 60

**Timestamp:** 2026-07-16T18:06:51.746Z

**Is Cascade:** false



## Cascades

### Item 1

**Cascade Id:** 7f2ebc39-d42f-479b-8173-e264b01c1336

**Simulation Day:** 31

**Parent Event:** cyber_attack

**Total Stages:** 3

**Stages:** 3



### Item 2

**Cascade Id:** 4067c215-7d88-411b-9208-2b2103124a6b

**Simulation Day:** 56

**Parent Event:** flood

**Total Stages:** 3

**Stages:** 3



