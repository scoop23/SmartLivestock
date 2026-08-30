# 🐄 SmartLivestock Frontend

A modern, responsive web application for livestock management, agricultural census monitoring, and production tracking across **Padre Garcia, Batangas**.

---

## 🌾 Overview

SmartLivestock bridges the gap between **Livestock Farmers**, **SIBAT Agricultural Officers**, and the **Municipal Agriculture Office (MAO)**. The frontend provides role-tailored dashboards and intuitive workflows for tracking livestock inventory, logging farm production, submitting quarterly census data, and processing validations.

---

## 🚀 Portals & Core Features

### 🧑‍🌾 1. Farmer Portal (`/(farmer)`)
- **Dashboard Overview:** Real-time KPI metric cards (livestock count, carcass weight, milk production trends, health alerts).
- **Livestock Inventory (`/livestock-inventory`):**
  - Categorized type views (Cattle, Carabao, Swine, Goat, Sheep, Poultry).
  - Add individual tags or batch animal records with approval status tracking.
  - Complete inventory management table (`/livestock-inventory/all`).
- **Production Dashboard (`/production-dashboard`):**
  - Interactive multi-step wizard for logging **Milk**, **Eggs**, and **Wool** output.
  - Monthly growth tracking and estimated market value analytics.
  - Production history and draft/submitted record management.
- **Quick Health Reporting:** Fast observation alerts for behavior, disease, or injury.

### 🛡️ 2. SIBAT Cooperative & Sector Portal (`/(sibat)`)
- **Sector Dashboard (`/sibat`):** Assigned barangay sector monitoring and key operational metrics.
- **Quarterly Census Submissions:** Form dialog and batch table for submitting barangay livestock counts.
- **Data Validation (`/sibat-validation`):** Queue management for reviewing, approving, or rejecting farmer submissions.
- **Health Alerts & Monitoring (`/sibat-alerts`, `/sibat-monitoring`):** Field issue triaging and escalation to MAO veterinarians.

### 🏛️ 3. Admin & Municipal Portal (`/admin`)
- **GIS Map Visualizations (`/gis-map`, `/gis-user-map`):** Spatial distribution of livestock populations across barangays.
- **Aggregated Reports & Analytics (`/analytics`, `/reports`):** Municipal-wide slaughter records, disease surveillance, and production trends.
- **User Management (`/user-management`):** Account provisioning and role-based permissions.

### 🏷️ 4. Auction Market Portal (`/auction`)
- Livestock market tracking, animal clearances, and price bulletin announcements.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives)
- **State & Data Fetching:** [TanStack React Query v5](https://tanstack.com/query) + [Axios](https://axios-http.com/)
- **Icons:** [Lucide Icons](https://lucide.dev/) + `@lucide/lab`
- **Charts & Visuals:** [Recharts](https://recharts.org/)
- **Notifications:** [Sonner](https://sonner.emilkowal.ski/)

---

## 📂 Project Structure

```text
frontend/src/
├── app/
│   ├── (farmer)/             # Farmer portal (Inventory, Production, Dashboard)
│   ├── (sibat)/              # SIBAT portal (Census, Validation, Alerts)
│   ├── admin/                # Admin dashboards, GIS maps, Analytics
│   ├── auction/              # Auction market & inspections
│   ├── components/           # Shared layout components (PageHeader, Menu)
│   └── layout.tsx            # Global root layout & Providers
├── components/
│   └── ui/                   # Reusable UI primitives (Button, Card, KpiCard, Dialog...)
├── lib/
│   ├── axios.ts              # Pre-configured Axios instance with API interceptors
│   └── utils.ts              # Class merging utilities (clsx + tailwind-merge)
└── styles/                   # Global CSS and custom theme configurations
```

---

## ⚡ Getting Started

### Prerequisites
- **Node.js**: `v20.x` or later
- **Backend API**: Running Django server at `http://127.0.0.1:8000`

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional):
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser at [http://localhost:3000](http://localhost:3000).

---

## 🏗️ Build & Verification

```bash
# Type check and build optimized production bundle
npm run build

# Start production server
npm run start

# Run ESLint checks
npm run lint
```
