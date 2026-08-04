# SmartLivestock-Batangas Backend Progress

## Current Status

This document tracks the development progress of the SmartLivestock-Batangas.

The project is being developed using a modular approach

## Tech Stack

### Backend
    - Django
    - Django REST Framework (Soon)
    - PostgreSQL

### Frontend
    - React Typescript
    - Nextjs
    - Recharts
    - shadcn

### Development Process


This project follows a project-driven learning approach.

Instead of learning every Django feature first, features are learned and implemented as they are needed.

Development process

    1. Design database
    2. Implement models
    3. Create migrations
    4. Understand generated SQL
    5. Test using Django Shell
    6. Verify relationships
    7. Build REST API
    8. Connect Next.js frontend
    9. Build reports
    10. Deploy

Hopefully master django in the future 

---

# Notes

Current focus:

Build a solid backend foundation before frontend development.

Preferably finished before august 🥱 ( cooked ! )

Avoid implementing:

    - Analytics
    - AI
    - Predictions
    - Dashboards

Until all core CRUD operations and APIs are complete. (Pending)

The goal is to ensure the data model and basic input output is stable before building higher-level features.

# Confirmed Data Sources

| Data | Source |
|-------|--------|
| Livestock Inventory | Farmers |
| Quarterly Livestock Census | CBAT |
| Farmer Registry | MAO / Agricultural Technologist |
| Disease Reports | MAO / Agricultural Technologist |
| Mortality Reports | Farmers → MAO |
| Negative Disease Monitoring Reports | MAO |
| Rabies Vaccination Reports | MAO |
| Livestock Inspection | MAO / Livestock Inspector |
| Livestock Inspection Clearance | MAO |
| Slaughter Records | Slaughterhouse (Pending Confirmation) |
| Meat Movement | Slaughterhouse (Pending Confirmation) |
| Auction Transactions | Auction Market (Pending Interview) |

## Why make this?
Farmers or Livestock Farmers allegedly submits data for clearance (Hopefully), to MAO(Municipal Agriculture Office) or Agricultural Technologist, and then Essentially the data is stored in a database and can be used for reports and analytics. 

Also i like cows!
