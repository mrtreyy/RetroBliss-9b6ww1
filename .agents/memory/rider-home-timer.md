---
name: RiderHome search timer pattern
description: Two refs needed to safely manage the 10-second driver-search countdown in RiderHome; cancel must clear both synchronously.
---

# RiderHome Search Timer

## Rule
`startDriverSearchTimer` must store both the `setInterval` handle (`searchIntervalRef`) and the safety-fallback `setTimeout` handle (`searchTimerRef`). Both refs must be cleared:
1. At the top of `startDriverSearchTimer` (to evict stale timers from a previous request).
2. Inside the interval callback when `countdown <= 0` (normal completion).
3. Synchronously at the start of `handleCancelRide` — **before** the async `supabase.rpc` call — so a cancel cannot race the interval and trigger `broadcastToAllDrivers` for a cancelled ride.
4. In the `useEffect` cleanup (unmount).

**Why:** Without storing the interval ref, `handleCancelRide` and unmount cleanup had no handle to call `clearInterval` on, so the countdown could fire `broadcastToAllDrivers` after the ride was already cancelled or the component unmounted — causing phantom DB writes and React state-update-after-unmount warnings.

## How to apply
Any time the matching/search flow is modified, verify all four clear sites above still exist. The `searchIntervalRef` is `useRef<ReturnType<typeof setInterval> | null>(null)`.

## No-drivers edge case
When `broadcastToAllDrivers` finds zero active drivers it must set `setDriverList([])` **and** `setBroadcastSent(true)` so the UI falls into the `broadcastSent` branch (which handles an empty list gracefully). Without `setBroadcastSent(true)` the rider stays stuck on the countdown screen forever.
