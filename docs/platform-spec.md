# Service Marketplace Platform Specification

## 1. Purpose

This platform connects service seekers (customers) with verified service providers (professionals), while administrators maintain trust, safety, and quality.

The system goals are:
- Help seekers discover and book reliable local services quickly.
- Help providers publish services and earn through bookings.
- Help administrators enforce policy, quality, and fairness.

## 2. Roles and Responsibilities

### Seeker (Customer)
- Creates account and manages profile.
- Discovers services via browse, search, and filters.
- Creates bookings and tracks booking status in real time.
- Reviews providers after completed services.
- Views booking history.

### Provider (Service Professional)
- Creates professional profile.
- Creates service listings.
- Receives booking requests and accepts or declines.
- Updates booking lifecycle statuses.
- Controls availability.
- Views earnings and work history.
- Monitors rating and feedback.

### Administrator (Platform Manager)
- Manages users (including block/unblock).
- Moderates and approves services.
- Monitors platform activity and trends.
- Handles complaints and policy violations.

## 3. Functional Requirements

### 3.1 Authentication and Profile
- The system shall support registration and login.
- The system shall persist user sessions securely.
- The seeker profile shall include:
  - name
  - contact details
  - location and saved addresses
- The provider profile shall include:
  - name
  - skills and service area
  - availability status
  - reputation metrics

### 3.2 Service Discovery
- Seekers shall browse by service category.
- Seekers shall search by keyword.
- Seekers shall filter by:
  - price range
  - rating
  - availability
  - location
- Service cards shall display:
  - title
  - category
  - description
  - price
  - provider name
  - provider rating
  - location

### 3.3 Booking Lifecycle
- A seeker shall create a booking request for an approved active service.
- A provider shall accept or decline a pending booking.
- Booking status progression shall support:
  - pending
  - accepted
  - on_the_way
  - arrived
  - started
  - completed
  - cancelled
- The system shall show current booking status to both seeker and provider.

### 3.4 Real-Time Updates
- The system shall push real-time status updates for booking changes.
- The system shall notify role dashboards when:
  - booking accepted or declined
  - provider starts travel
  - service starts or completes
  - review submitted

### 3.5 Reviews and Reputation
- A seeker shall submit rating and review after completion.
- A provider average rating shall be recalculated after each new review.
- Reviews shall be visible in service and provider contexts.

### 3.6 Provider Service Management
- A provider shall create service listings with title, description, category, price, and location.
- New provider services shall default to pending approval.
- Admin-approved services shall become visible to seekers.
- Providers shall toggle listing active/inactive where allowed by policy.

### 3.7 Admin Governance
- Admin shall view users, providers, services, and bookings.
- Admin shall approve, reject, edit, or remove services.
- Admin shall block/unblock users.
- Admin shall view platform KPIs:
  - total users
  - active providers
  - total bookings
  - completion rate
  - demand by category

### 3.8 Safety and Trust
- The platform shall support user blocking for policy violations.
- The platform shall keep auditable booking and moderation events.
- The platform shall support complaint workflows and resolution outcomes.

## 4. Core Data Model (Logical)

### profiles
- id
- role
- name
- email
- phone
- location
- is_available
- is_blocked
- avatar_url

### services
- id
- provider_id
- title
- description
- category
- price
- location
- approval_status (pending, approved, rejected)
- is_active
- created_at

### bookings
- id
- seeker_id
- provider_id
- service_id
- status
- amount
- scheduled_date
- scheduled_time
- notes
- created_at
- updated_at

### reviews
- id
- booking_id
- seeker_id
- provider_id
- rating
- comment
- created_at

## 5. State and Status Rules

### Service Visibility Rule
A service is visible to seekers only when:
- approval_status = approved
- is_active = true
- provider is not blocked

### Booking Transition Rule
Allowed transitions:
- pending -> accepted | cancelled
- accepted -> on_the_way | cancelled
- on_the_way -> arrived
- arrived -> started
- started -> completed | cancelled

## 6. Non-Functional Requirements

- Performance: Service search should return results within acceptable latency for local marketplace scale.
- Reliability: Booking state changes should be durable and idempotent.
- Security: Role-based access control for seeker, provider, admin operations.
- Usability: Mobile-first responsive UX for discovery and booking.
- Observability: Dashboard metrics and operational logs for admin.

## 7. Current Route Map (Existing App)

- /
- /login
- /register
- /services
- /dashboard/seeker
- /dashboard/provider
- /dashboard/admin
- * (not found)

## 8. Implementation Notes For Current Codebase

- Existing dashboards already include role-specific workflows and Supabase realtime subscriptions.
- Keep booking status naming consistent across all pages and DB constraints.
- Ensure admin metrics read from the same booking source of truth.
- Keep moderation actions idempotent and visible in real time.

## 9. Acceptance Criteria (MVP)

- A seeker can discover approved active services and place bookings.
- A provider can accept bookings and update progress statuses.
- A seeker sees status updates in near real time.
- A seeker can submit a review after completion.
- An admin can approve services and block users.
- All role dashboards show accurate counts based on shared data.
