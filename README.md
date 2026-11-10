# VoltShare

VoltShare is a modern, peer-to-peer and public EV (Electric Vehicle) charging marketplace that connects EV drivers with private charger hosts and public charging infrastructure. The platform enables individuals and businesses to list their private EV chargers to monetize idle capacity, while empowering EV drivers to easily locate, navigate to, reserve, and pay for charging sessions in real time.

---

## Features

### 1. Driver & Host Roles
- **Dual Role Architecture**: Distinct workflows for **EV Drivers (SEEKER)** and **Charger Hosts (HOST)**.
- **Dedicated Role Registration & Login**: Interactive role selector (`⚡ Driver / Seeker` vs `🏠 Host`) on both Registration and Login pages.
- **Strict Role Verification**: Server-side role validation prevents account conversion or unauthorized role escalation; database and JWT maintain single source of truth.

### 2. EV Vehicle Management
- Drivers can save and manage their EV garage profiles (make, model, year, battery capacity in kWh, connector type, registration number).
- Seamless compatibility checks on charger discovery and booking screens to prevent connector mismatches.

### 3. Find Chargers & Interactive Map
- **Interactive Leaflet Map**: Fast, responsive map built with OpenStreetMap tiles (no paid map API keys required).
- **Proximity-Based Search**: Uses MySQL 8.0 spherical geometry (`ST_Distance_Sphere`) to query stations within configurable radius (1–50 km).
- **Dual-Mode Location Resolution**:
  - **Browser / Device GPS**: Live geolocation via HTML5 Geolocation API with accuracy indicators.
  - **Manual Location Search**: Geocoding powered by OpenStreetMap Nominatim allows manual searches (e.g., "Gubbi, Tumakuru, Karnataka") when browser GPS is imprecise or remote scouting is required.
  - **Near Me Restoration**: One-click action to reset search center back to live device GPS.
- **Comprehensive Filters**: Filter chargers by speed/level (`LEVEL_1`, `LEVEL_2`, `DC_FAST`), plug/connector (`TYPE_1`, `TYPE_2`, `CCS_1`, `CCS_2`, `CHAdeMO`, `TESLA`, `GB_T`), maximum price per kWh, and minimum star rating.

### 4. Open Charge Map Integration
- Automatically fetches and aggregates real-world public EV charging stations from the **Open Charge Map (OCM)** API.
- Unified search results: VoltShare host chargers and public OCM stations are merged and sorted strictly by ascending distance.
- Station isolation: OCM stations display clear "Public Station" badges and directions-only navigation, remaining non-bookable to preserve marketplace integrity.

### 5. Charger Booking & Charging Lifecycle
- **Granular Scheduling**: Real-time slot selection and reservation with conflict-prevention constraints (`@@unique([chargerId, startTime, endTime])`).
- **Dynamic Energy & Price Estimation**: Computes estimated charging time and total cost based on vehicle battery capacity, target state-of-charge, and charger kW rating.
- **Lifecycle Progression**:
  - `PENDING`: Slot selected, awaiting payment initiation.
  - `CONFIRMED`: Payment authorized/verified; slot secured with unique digital QR code.
  - `ACTIVE`: Driver checks in at the charger to start the session.
  - `COMPLETED`: Session finished after the driver completes charging (payment alone does *not* complete the session).
  - `CANCELLED`: Booking released prior to check-in.

### 6. Payment System
- **Razorpay Integration**: Native checkout integration with server-side order creation, cryptographic HMAC SHA-256 signature verification, and webhook handling.
- **Local / College Demo Fallback Checkout**: When live Razorpay credentials are not configured, the system provides a clean, self-contained checkout modal offering:
  - **UPI** (Google Pay, PhonePe, Paytm, BHIM)
  - **Debit / Credit Card**
  - **Net Banking**
  - **Digital Wallet**
- Transparent fee breakdown showing host payout and platform commission.

### 7. Reviews, Ratings & Notifications
- Post-session verified driver reviews and 1–5 star ratings.
- Real-time in-app notification center and unread badge alerts for booking confirmations, payments, and session transitions.

### 8. Host Dashboard & Charger Management
- Overview of listed chargers, active/inactive availability toggles, and real-time revenue analytics.
- Step-by-step "Add Charger" flow capturing location, electrical specifications, hourly/kWh pricing, availability hours, and photos.

### 9. Turn-by-Turn Navigation
- Integrated Google Maps directions links on both VoltShare private chargers and external OCM stations opening directly in a new browser tab without requiring Google Maps API keys.

---

## Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend Framework** | [Next.js 14](https://nextjs.org/) (App Router) | React 18, Server & Client Components |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/) | Lucide React icons, responsive layout |
| **Mapping & Tiles** | [Leaflet](https://leafletjs.com/) | OpenStreetMap standard tiles (Zero API cost) |
| **Backend Runtime** | [Node.js](https://nodejs.org/) (v18+) | TypeScript, Express 4 REST API |
| **Database & ORM** | [MySQL 8.0](https://www.mysql.com/) + [Prisma](https://www.prisma.io/) | Spatial geometry functions, strict foreign keys |
| **Authentication** | [JWT](https://jwt.io/) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | Stateless JSON Web Tokens, salted 12-round hashing |
| **Validation** | [Zod 3](https://zod.dev/) | Shared client/server request schema validation |
| **Payments** | [Razorpay](https://razorpay.com/) | Node SDK, client checkout modal & fallback engine |
| **External Station Data** | [Open Charge Map API](https://openchargemap.org/) | Server-side station query & filtering |
| **Geocoding** | [OSM Nominatim](https://nominatim.org/) | Free address/city geocoding with custom User-Agent |
| **Monorepo Tooling** | [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) | Monorepo sharing types, validators, and configs |

---

## Architecture

VoltShare uses a modular monorepo architecture:

```
┌────────────────────────────────────────────────────────┐
│                   Next.js 14 Web App                   │
│              (Port 3000 — apps/web)                    │
│   • Map & Find Chargers    • Host & Seeker Dashboards  │
│   • Booking & Checkout UI  • Vehicles & Reviews UI     │
└───────────▲────────────────────────────────┬───────────┘
            │                                │
            │ Axios / REST                   │ Leaflet OSM Tiles
            ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────┐
│       Express 4 Backend API          │  │ OpenStreet-  │
│      (Port 4000 — packages/api)      │  │     Map      │
│  • JWT Auth & RBAC Middleware        │  └──────────────┘
│  • MySQL Spatial ST_Distance_Sphere  │
│  • Razorpay Payment Verification     │
└───────────▲──────────────────▲───────┘
            │                  │
    Prisma  │           HTTP   │
            ▼                  ▼
┌──────────────────┐  ┌───────────────────────────────┐
│  MySQL 8.0 DB    │  │ External Services:            │
│  (Port 3306)     │  │  • Open Charge Map API        │
│  chargers, users │  │  • OSM Nominatim Geocoding    │
│  bookings, etc.  │  │  • Razorpay Payment Gateway   │
└──────────────────┘  └───────────────────────────────┘
```

- **Frontend & Backend Decoupling**: The Next.js frontend communicates with the backend solely through RESTful JSON endpoints at `/api/*`.
- **Stateless Authentication**: Requests attach a standard `Authorization: Bearer <token>` header; the backend verifies the token and user role on every protected request.
- **Shared Code Package (`@voltshare/shared`)**: Houses TypeScript interfaces, shared enums (`UserRole`, `ChargerType`, `ConnectorType`, `BookingStatus`), and Zod schemas shared by both web and api packages.

---

## User Roles

### 1. Driver / SEEKER
- Discover nearby chargers using live GPS or manual location queries.
- Inspect station electrical ratings, pricing, compatibility, and host reviews.
- Book designated time slots and complete payments via Razorpay or fallback checkout.
- Check in at stations to initiate charging sessions and mark sessions completed.
- Submit post-session ratings and written reviews.
- Manage personal EV vehicle garage profiles.

### 2. Charger Host (HOST)
- List private or commercial charging equipment with customizable pricing (per kWh or per hour).
- Set weekly operating availability hours and upload station photos.
- Toggle charger status (`ACTIVE` vs `INACTIVE`) dynamically.
- Monitor incoming reservation requests and charging session progress.
- Track earnings, platform fee deductions, and net payouts.

### 3. Administrator (ADMIN)
- Supported by the underlying database schema (`UserRole.ADMIN`) for future platform-wide moderation and disputes.

---

## Project Structure

```
voltshare/
├── apps/
│   └── web/                                # Next.js 14 frontend web application
│       ├── app/
│       │   ├── (auth)/                     # Auth routes: /login, /register
│       │   ├── (host)/                     # Host routes: /dashboard, /chargers/new
│       │   ├── (seeker)/                   # Seeker routes: /map, /bookings, /chargers/[id]
│       │   ├── notifications/              # In-app notifications: /notifications
│       │   ├── layout.tsx                  # Root layout with Navbar and Footer
│       │   └── page.tsx                    # Landing / marketing homepage
│       ├── components/
│       │   ├── charger/                    # ChargerCard, ChargerFilters, AddChargerForm
│       │   ├── layout/                     # Navbar, Footer
│       │   ├── map/                        # Leaflet InteractiveMap component
│       │   ├── notifications/              # NotificationBell dropdown
│       │   └── ui/                         # Reusable Button, Input, Card, Badge components
│       └── lib/
│           ├── api.ts                      # Axios API client functions
│           ├── auth.ts                     # Local storage token & role synchronization
│           └── utils.ts                    # Formatting and Tailwind cn helpers
├── packages/
│   ├── api/                                # Express 4 REST API backend
│   │   ├── prisma/
│   │   │   └── schema.prisma               # Prisma data schema for MySQL 8.0
│   │   └── src/
│   │       ├── config/                     # Environment variable loader
│   │       ├── controllers/                # Auth, Charger, Booking, Payment, Review controllers
│   │       ├── middleware/                 # Auth JWT check, RBAC authorize, Zod validate
│   │       ├── routes/                     # Express router definitions
│   │       ├── services/                   # OpenChargeMap & Razorpay services
│   │       └── index.ts                    # Express app bootstrap & port binding
│   └── shared/                             # Common TypeScript models and validators
│       └── src/
│           ├── constants/                  # Default values, pagination limits
│           ├── types/                      # Domain interfaces (User, Charger, Booking, etc.)
│           └── validators/                 # Zod validation schemas
├── docker-compose.yml                      # Local MySQL 8.0 & Redis services
├── package.json                            # Root workspaces configuration
├── render.yaml                             # Production deployment blueprint for Render
├── .env.example                            # Safe placeholder environment template
└── .gitignore                              # Git exclusion rules
```

---

## Database Schema (MySQL 8.0 via Prisma)

| Table | Model | Description |
| :--- | :--- | :--- |
| `users` | `User` | User accounts, credentials hash, role (`SEEKER`, `HOST`, `ADMIN`), profile details |
| `vehicles` | `Vehicle` | EV profiles linked to driver with connector type and battery capacity |
| `chargers` | `Charger` | Station listings, coordinates, connector specifications, rate per kWh/hr, status |
| `bookings` | `Booking` | Reservations, start/end timestamps, total amount, QR code, lifecycle status |
| `payments` | `Payment` | Payment records, gateway transaction ID, platform commission, host payout |
| `reviews` | `Review` | Post-charging star ratings (1–5) and feedback comments linked to bookings |
| `notifications` | `Notification`| User alerts for bookings, payments, and system notices |

### Key Relationships:
- A `User` (as Host) owns many `Charger`s.
- A `User` (as Seeker) has many `Vehicle`s and `Booking`s.
- A `Charger` has many `Booking`s and `Review`s.
- Each `Booking` has one associated `Payment` and one optional `Review`.
- Unique constraint `@@unique([chargerId, startTime, endTime])` prevents overlapping reservations on the same charger.

---

## Charger Search Engine

1. **MySQL Spatial Query**:
   Host-owned chargers are stored in MySQL with exact decimal latitude and longitude. The search queries chargers where `status = 'ACTIVE'` within the requested radius using:
   ```sql
   ST_Distance_Sphere(POINT(c.longitude, c.latitude), POINT(searchLng, searchLat)) <= radiusMeters
   ```
2. **Criteria Filtering**:
   Applies optional filters on `chargerType`, `connectorType`, `maxPricePerKwh`, and `minRating`.
3. **Open Charge Map Aggregation**:
   Public stations are fetched from the Open Charge Map API around the search center.
4. **Merge & Proximity Sorting**:
   VoltShare chargers (`source: 'VOLTShare'`) and external stations (`source: 'EXTERNAL'`) are combined into a single result array and sorted strictly by `distanceKm ASC`.
5. **Pagination**:
   The merged list is sliced according to `page` and `limit` query parameters. External stations are **never** written to the local database.

---

## Open Charge Map (OCM) Integration

- **Purpose**: Augments VoltShare community chargers with global public charging station data.
- **Server-Side Fetch**: The Open Charge Map API is queried exclusively from the backend (`packages/api/src/services/openChargeMap.service.ts`). The API key is kept secure on the server and is never sent to the browser.
- **Station Identification**: External stations receive IDs prefixed with `ocm-` (e.g., `ocm-309267`) and `isExternal: true`.
- **Booking Isolation**:
  - The booking controller requires a valid UUID from the MySQL `chargers` table.
  - Submitting an `ocm-*` ID is rejected with a `400 Bad Request`, preventing accidental reservations on public networks.
  - Cards and map pins for OCM stations display a **Get Directions** button that opens Google Maps navigation.

---

## Payment Architecture

VoltShare implements a dual-mode payment architecture:

1. **Primary: Razorpay Gateway**:
   - Backend creates an official Razorpay order with amount in paise.
   - Frontend opens the official Razorpay Checkout modal.
   - Upon payment, frontend sends `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` to `/api/payments/verify`.
   - Backend verifies signature using HMAC SHA-256 with `RAZORPAY_KEY_SECRET`.
2. **Local / College Demo Fallback Checkout**:
   - When valid Razorpay test keys are not configured in `.env`, the backend flags `isFallback: true` with a simulated order ID.
   - The frontend displays a custom checkout dialog supporting **UPI**, **Card**, **Net Banking**, and **Wallet**.
   - Submitting the payment calls `/api/payments/process-checkout`, which records the completed transaction and transitions the booking to `CONFIRMED`.
   - **Note**: The fallback engine is intended for local demos and development testing; real-money transactions require configuring valid Razorpay credentials.

---

## Booking / Charging Lifecycle

```
┌─────────────┐   Driver initiates booking
│   PENDING   │ ─────────────────────────────┐
└─────────────┘                              │
       │                                     ▼
       │ Payment completed           ┌───────────────┐
       ▼                             │   CANCELLED   │
┌─────────────┐                      └───────────────┘
│  CONFIRMED  │ (Slot confirmed, QR generated)
└─────────────┘
       │
       │ Driver arrives at charger & checks in
       ▼
┌─────────────┐
│   ACTIVE    │ (Charging in progress)
└─────────────┘
       │
       │ Driver clicks "Complete Charging"
       ▼
┌─────────────┐
│  COMPLETED  │ ──► Unlocks 1-5 Star Review
└─────────────┘
```

> **Important**: Successful payment transitions the booking to `CONFIRMED`. The session transitions to `ACTIVE` upon check-in and only becomes `COMPLETED` when the driver explicitly finishes the charging session.

---

## Security Implementation

- **Password Encryption**: User passwords hashed using `bcryptjs` with 12 salt rounds before database insertion.
- **JWT Authentication**: Signed with a secure `JWT_SECRET` and configurable expiration (`7d`).
- **Role-Based Access Control (RBAC)**: Route middleware (`authorize('HOST')`) protects host-only endpoints (e.g., creating chargers, updating listings, reviewing earnings).
- **Resource Ownership Checks**: Hosts can only edit or delete chargers they personally created; drivers can only view or manage their own bookings.
- **Input Validation**: All incoming API requests validated using strict Zod schemas with type coercion and sanitization.
- **Cryptographic Signature Verification**: Razorpay payment verification uses constant-time HMAC SHA-256 hashing.
- **Environment Isolation**: All credentials, keys, and tokens loaded strictly through environment variables.

---

## Environment Variables

Copy `.env.example` to create your local `.env` file:

```bash
cp .env.example .env
```

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Application environment | `development` / `production` |
| `PORT` | API server listen port | `4000` |
| `DATABASE_URL` | MySQL 8.0 connection string | `mysql://root:password@localhost:3306/voltshare` |
| `MYSQL_PASSWORD` | Root password for MySQL (Docker) | `your_mysql_password` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `super-secret-jwt-key-min-32-chars` |
| `JWT_EXPIRES_IN` | Token validity duration | `7d` |
| `CORS_ORIGIN` | Allowed client origin for CORS | `http://localhost:3000` |
| `PLATFORM_FEE_PERCENT` | Platform fee percentage on bookings | `10` |
| `OPEN_CHARGE_MAP_API_KEY` | API key from openchargemap.org | `your_ocm_api_key` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Secret | `your_razorpay_secret` |
| `NEXT_PUBLIC_API_URL` | Backend URL accessible from browser | `http://localhost:4000/api` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Public Razorpay key for frontend | `rzp_test_...` |

> **Note**: Never commit `.env` to version control. The repository `.gitignore` automatically excludes all `.env` files except `.env.example`.

---

## Local Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- [npm](https://www.npmjs.com/) v9.0.0 or higher
- [MySQL](https://www.mysql.com/) 8.0 running locally OR [Docker](https://www.docker.com/)

### Step 1: Clone Repository
```bash
git clone https://github.com/your-username/voltshare.git
cd voltshare
```

### Step 2: Install Monorepo Dependencies
```bash
npm install
```

### Step 3: Configure Environment
```bash
cp .env.example .env
# Open .env and enter your local MySQL password and database credentials
```

### Step 4: Start MySQL (Optional via Docker Compose)
If you don't have a local MySQL instance running:
```bash
docker-compose up -d mysql
```

### Step 5: Database Setup & Prisma Generation
```bash
# Generate Prisma Client
npm run db:generate

# Push database schema to MySQL
npm run db:push
```

### Step 6: Build the Shared Package
```bash
npm --workspace=@voltshare/shared run build
```

### Step 7: Start Development Servers
Run the API backend and Next.js frontend in separate terminal windows:

**Terminal 1 (Backend API on port 4000):**
```bash
npm run api:dev
```

**Terminal 2 (Frontend Web App on port 3000):**
```bash
npm run web:dev
```

### Step 8: Open VoltShare in Your Browser
Visit [http://localhost:3000](http://localhost:3000) to start using the platform.

---

## API Overview

All API endpoints are prefixed with `/api`.

| Route | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | `POST` | Public | Register new SEEKER or HOST account |
| `/api/auth/login` | `POST` | Public | Authenticate and obtain JWT token |
| `/api/auth/me` | `GET` | Authenticated | Fetch authenticated user profile |
| `/api/chargers` | `GET` | Public | Search nearby chargers & OCM stations |
| `/api/chargers/geocode` | `GET` | Public | Geocode city or address to coordinates |
| `/api/chargers/:id` | `GET` | Public | Fetch detailed information for a single charger |
| `/api/chargers/mine` | `GET` | Host Only | Fetch chargers listed by authenticated host |
| `/api/chargers` | `POST` | Host Only | Create a new charger listing |
| `/api/chargers/:id/status`| `PATCH` | Host Only | Toggle charger active/inactive status |
| `/api/vehicles` | `GET` / `POST` | Authenticated | List and add driver EV vehicles |
| `/api/bookings` | `GET` / `POST` | Authenticated | List user bookings and create new booking |
| `/api/bookings/:id/status`| `PATCH` | Authenticated | Advance booking lifecycle (Check-in / Complete) |
| `/api/payments/initiate` | `POST` | Authenticated | Initialize payment order (Razorpay / Fallback) |
| `/api/payments/verify` | `POST` | Authenticated | Verify Razorpay HMAC signature |
| `/api/payments/process-checkout` | `POST` | Authenticated | Process checkout for demo/fallback payments |
| `/api/payments/earnings` | `GET` | Host Only | Retrieve host payout analytics |
| `/api/reviews` | `POST` | Authenticated | Post review and rating for completed booking |
| `/api/notifications` | `GET` | Authenticated | Retrieve in-app alerts and notifications |
| `/api/stats` | `GET` | Public | Platform-wide public statistics |
| `/health` | `GET` | Public | Server health status check |

---

## Testing & Quality Assurance

VoltShare includes automated test suites covering authentication, spatial calculations, geocoding, payment checkout, and booking isolation:

```bash
# Run full regression test suite (Auth, Geocoding, Charger discovery, Booking isolation)
node scratch/test_regression.js

# Run directions URL and booking test suite
node scratch/test_directions.js

# Run end-to-end audit suite
node audit.js
```

### Verified Test Results:
- **Auth & Role Mismatch**: Registration, login, and rejection of cross-role login attempts verified (`100% pass`).
- **Geocoding & Location**: Nominatim address resolution tested for Gubbi and Bengaluru (`100% pass`).
- **Charger Discovery**: VoltShare host-owned chargers and external OCM stations verified with correct proximity sorting.
- **Booking Isolation**: Non-UUID and OCM IDs cleanly rejected with `400 Bad Request`.
- **TypeScript & Production Build**: `@voltshare/shared` (tsc), `@voltshare/api` (tsc), and `@voltshare/web` (Next.js 14 production build) pass with **0 errors**.

---

## Deployment

VoltShare can be deployed to modern cloud hosting platforms like **Render**, **Railway**, or **AWS**:

### Render Deployment (Recommended)
This repository includes a production-ready [`render.yaml`](./render.yaml) Blueprint configuration:
1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), choose **Blueprints** and connect your GitHub repository.
3. Render automatically provisions:
   - `voltshare-api`: Node.js web service running the Express API with automatic health checks at `/health`.
   - `voltshare-web`: Node.js web service running the Next.js production frontend.
4. Set your production `DATABASE_URL` (e.g. AWS RDS MySQL or PlanetScale) and Razorpay credentials in the Render Dashboard.

