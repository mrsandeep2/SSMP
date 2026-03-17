# MVP Delivery Roadmap

## Phase 1: Foundation

### Objective
Stabilize role access, data consistency, and status conventions.

### Tasks
- Unify booking status enum usage across seeker, provider, and admin flows.
- Validate route protection for dashboard routes by role.
- Add backend constraints/policies for role-authorized transitions.
- Ensure environment validation and graceful fallback behavior.

### Exit Criteria
- No route-level blank screens.
- Booking status values are consistent across frontend and DB.

## Phase 2: Discovery and Booking

### Objective
Deliver reliable seeker discovery and booking experience.

### Tasks
- Improve service search and filtering by price, rating, availability, and category.
- Add location-aware filtering and sorting.
- Finalize booking create flow with schedule details.
- Add booking timeline view with status badges.

### Exit Criteria
- Seekers can find and book services with clear status tracking.

## Phase 3: Provider Operations

### Objective
Enable providers to manage work efficiently.

### Tasks
- Complete booking action panel for accept/decline/status updates.
- Add availability toggle safeguards and UI feedback.
- Add provider earnings summary and completed-work reporting.
- Add rating summary widget with trend.

### Exit Criteria
- Providers can manage active jobs and monitor earnings/reputation.

## Phase 4: Admin Governance

### Objective
Strengthen trust, moderation, and platform oversight.

### Tasks
- Build moderation queue for pending services.
- Complete user block/unblock and provider oversight workflow.
- Standardize admin KPIs from a single source of truth.
- Add complaint intake and resolution status tracking.

### Exit Criteria
- Admin can monitor, moderate, and enforce platform standards.

## Phase 5: Real-Time and Quality

### Objective
Guarantee timely updates and production readiness.

### Tasks
- Verify realtime channels for bookings, services, and reviews.
- Add retry/error patterns for realtime disconnects.
- Add integration tests for lifecycle transitions.
- Add smoke tests for role routing and critical pages.

### Exit Criteria
- Realtime updates are stable and test coverage protects core journeys.

## Suggested Build Order in This Repo

1. Status and role consistency hardening.
2. Seeker booking timeline and filters.
3. Provider action workflows.
4. Admin moderation and KPIs.
5. Realtime resilience and test suite expansion.
