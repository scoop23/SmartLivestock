# SmartLivestock Complete End-to-End Data Flow Architecture

This document provides a comprehensive, unified blueprint of how data enters, moves through, is validated, and is analyzed across the entire **SmartLivestock** capstone system for Padre Garcia, Batangas.

---

## 1. High-Level Full-Stack System Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend (Next.js 16 + React 19 + TypeScript)"]
        UI_Farmer["Farmer Dashboard & Mobile PWA<br/>(Inventory, Yields, Weigh-ins, Reports)"]
        UI_CBAT["SIBAT / CBAT Mobile Field Portal<br/>(Census, Field Verification, Inspections)"]
        UI_MAO["MAO & Admin Executive Suite<br/>(Approvals, Data Upload, Analytics, GIS)"]
        UI_Auction["Auction & Abattoir Operators<br/>(Live Sales, Slaughter Tally Sheets)"]
        API_Client["Axios HTTP Client + TanStack React Query<br/>(Token Auth, Cache Invalidation, Offline Sync)"]
        UI_Farmer & UI_CBAT & UI_MAO & UI_Auction --> API_Client
    end

    subgraph Gateway ["API & Security Gateway (Django REST Framework)"]
        URL_Router["Django URL Routers & Endpoints (/api/...)"]
        Auth_Guard["JWT / Session Authentication + Document Security"]
        RBAC_Perms["Role-Based Access Control (RBAC)<br/>(IsFarmer, IsSIBAT, IsMAO, IsSlaughterhouse)"]
        Serializers["DRF Serializers & Data Sanitization<br/>(Field Validation, Object Ownership Checks)"]
        API_Client --> URL_Router --> Auth_Guard --> RBAC_Perms --> Serializers
    end

    subgraph Services ["Business Logic & Analytics Services"]
        Val_Service["Validation & Status Workflow Engine"]
        Life_Service["Animal Lifecycle & Lineage Engine"]
        GIS_Service["GIS Geospatial & Temporal Engine (Leaflet + Giro3D)"]
        Import_Service["Data Import Bulk Ingestion Engine"]
        AI_Service["Predictive AI & Econometric Forecasting Engine<br/>(Random Forest, Ridge + ARIMA, Holt-Winters)"]
        Serializers --> Val_Service & Life_Service & GIS_Service & Import_Service & AI_Service
    end

    subgraph Database ["Persistence Layer (PostgreSQL)"]
        DB_Users["users_customuser & farmer profiles"]
        DB_Livestock["livestock_inventory & animal lineage"]
        DB_Production["production_records & slaughter_records"]
        DB_Diseases["disease_cases & mortality_records"]
        DB_Market["live_animal_sales & auction_lots"]
        DB_Audit["data_import_batches & validation_audit"]
        Services --> DB_Users & DB_Livestock & DB_Production & DB_Diseases & DB_Market & DB_Audit
    end
```

---

## 2. The Core 2-Tier Validation Workflow (The Spine of the System)

Nothing becomes an official municipal record or enters government reports until it passes the **two-tier validation workflow**. This preserves data integrity across rural barangays:

```mermaid
sequenceDiagram
    autonumber
    actor Farmer as Farmer / Barangay Encoder
    actor SIBAT as SIBAT / CBAT (Field Technologist)
    actor MAO as MAO Officer (Municipal Vet/Admin)
    participant API as Django REST API
    participant DB as PostgreSQL Database
    participant GIS as GIS & Predictive Analytics

    Farmer->>API: Submits animal/production/disease/mortality log
    API->>DB: Saves with status='PENDING', operational_status='ACTIVE'
    Note over DB: Record exists in database, but is EXCLUDED from official municipal reports

    SIBAT->>API: Opens field verification queue (/sibat/livestock-monitoring)
    SIBAT->>Farmer: Conducts on-site barangay inspection (verifies ear-tag, health)
    alt SIBAT returns for correction
        SIBAT->>API: Submits review: status='RETURNED' + remarks
        API->>Farmer: In-app & Push notification to correct data
    else SIBAT forwards to MAO
        SIBAT->>API: Submits review: status='FOR_MAO_REVIEW' + field notes
        API->>DB: Updates status='FOR_MAO_REVIEW', records sibat_reviewed_at
    end

    MAO->>API: Reviews forwarded submissions (/data-validation)
    alt MAO Rejects
        MAO->>API: Submits rejection: status='REJECTED' + reason
        API->>DB: Updates status='REJECTED'
    else MAO Approves
        MAO->>API: Submits approval: status='APPROVED'
        API->>DB: Updates status='APPROVED', reviewed_by=MAO, reviewed_at=NOW()
        Note over DB: Record is now an OFFICIAL MUNICIPAL RECORD
        DB->>GIS: Immediately appears on GIS Map & Timeline Scrubber
        DB->>GIS: Feeds into Census, Machine Learning & Forecasting Models
    end
```

---

## 3. Individual Animal Lifecycle & Lineage Data Flow

SmartLivestock tracks animals individually (`INDIVIDUAL` entry with unique ear tag) or in herds (`BATCH` entry with head count).

```mermaid
flowchart TD
    Birth["1. Birth / Registration<br/>(BreedingRecord ➔ CalvingRecord ➔ LivestockInventory)"] --> Active["2. Active Herd Membership<br/>(Status: ACTIVE)"]
    
    Active --> Weight["Periodic Weigh-ins (production/weights/)<br/>➔ Calculates ADG (Average Daily Gain)<br/>➔ Linear OLS 30-Day Growth Forecast"]
    Active --> Milk["Daily Milk Sessions (production/records/)<br/>➔ Random Forest (120 Trees) + Weather THI<br/>➔ 7-Day Non-Linear Yield Forecast"]
    Active --> Disease["Morbidity Incident (disease/reports/)<br/>➔ GIS 90-day outbreak buffer zone<br/>➔ Random Forest Disease Risk Forecast"]
    
    Active --> Branch{"Life Event Transition"}
    
    Branch -->|"Transfer / Auction Sale"| Transfer["LivestockOwnershipTransfer / LiveAnimalSale<br/>➔ Transfer of farmer ownership<br/>➔ Feeds Ridge + ARIMA Market Pricing"]
    Branch -->|"Abattoir Slaughter"| Slaughter["SlaughterRecord<br/>➔ operational_status = 'SLAUGHTERED'<br/>➔ Carcass weight recorded (kg)<br/>➔ Excluded from future active census"]
    Branch -->|"Natural / Disease Death"| Mortality["MortalityRecord<br/>➔ operational_status = 'DECEASED'<br/>➔ Feeds GIS Mortality Heatmap & Time Scrubber<br/>➔ Excluded from future active census"]
```

---

## 4. Bulk Data Ingestion Flow (Data Upload Feature)

For historical data migration from paper and legacy Excel spreadsheets:

```mermaid
flowchart LR
    A["MAO uploads CSV/XLSX<br/>(Inventory, Slaughter, Disease, Mortality, Auction)"] --> B["Step 1: Dry-Run Validation<br/>(POST /api/data-imports/validate/)"]
    B --> C["Validation Engine Checks:<br/>• Fuzzy header aliases<br/>• Foreign key existence<br/>• Unique ear-tag collision<br/>• Date ranges & types"]
    C --> D["In-Browser Preview & Cell Editor<br/>(Fix errors directly in browser)"]
    D --> E["Step 2: Transactional Bulk Write<br/>(POST /api/data-imports/import/)"]
    E --> F["transaction.atomic()<br/>• Bulk create in 500-row chunks<br/>• Creates DataImportBatch audit log<br/>• Rolls back completely on failure"]
    F --> G["Domain Tables Populated<br/>(Immediately available to GIS & AI models)"]
```

---

## 5. GIS Geospatial & Temporal Playback Data Flow

The GIS module combines 2D interactive cartography (Leaflet) and 3D terrain rendering (Giro3D) across 21 barangays of Padre Garcia:

```mermaid
flowchart TD
    User["User selects Date on Timeline Scrubber<br/>(or hits 'Play' Auto-Cycling)"] --> Param["Frontend sends query param:<br/>GET /api/analytics/gis-layers/?report_as_of=YYYY-MM-DD"]
    
    Param --> Reconstruct["Backend Point-in-Time Reconstruction:<br/>(analytics/services/gis.py)"]
    
    Reconstruct --> Inv["1. Inventory Layer<br/>effective_approval_date <= target_date<br/>AND (status == ACTIVE OR changed_at > target_date)"]
    Reconstruct --> Mort["2. Mortality Layer<br/>effective_date <= target_date<br/>Aggregated by Barangay heads lost"]
    Reconstruct --> Surv["3. Surveillance Layer<br/>Active cases in 90-day window ending at target_date<br/>Generates Haversine buffer rings (1km, 3km)"]
    
    Inv & Mort & Surv --> GeoJSON["Constructs FeatureCollection GeoJSON<br/>with Barangay boundary polygons"]
    GeoJSON --> Render["Frontend renders 2D/3D choropleth heatmaps<br/>with smooth 30-day temporal stepping"]
```

---

## 6. Predictive Analytics & AI Data Flow

SmartLivestock does not rely on a single algorithm; it routes each specific agricultural problem to its mathematically appropriate model:

```mermaid
flowchart TD
    subgraph Pipeline_1 ["Individual Cow Daily Milk Forecast (livestock_milk.py)"]
        P1_In["Inputs:<br/>• 30+ daily milking logs (lags t-1, t-2, t-3, t-7, roll_7)<br/>• Cow traits: weight_kg, age_years, breed, days_since_calving<br/>• Open-Meteo weather: prior-day temp & humidity (THI)"]
        P1_Eval["Chronological Holdout Tournament (80/20 Date Split):<br/>Compares Naive vs Linear Regression vs Random Forest"]
        P1_Model["RandomForestRegressor(n_estimators=120, max_depth=7)<br/>Learns non-linear biological lactation curve & heat stress thresholds"]
        P1_Out["7-Day Out-of-Sample Daily Forecast (Liters)"]
        P1_In --> P1_Eval --> P1_Model --> P1_Out
    end

    subgraph Pipeline_2 ["Cattle Market Pricing Hybrid Engine (cattle_price.py)"]
        P2_In["Cattle Profile Inputs:<br/>Breed, Sex, Weight (kg), Age (months)"]
        P2_Stage1["Stage 1: Ridge Regression (alpha=10)<br/>Resolves multicollinearity between age and weight to compute baseline trait price"]
        P2_Stage2["Stage 2: ARIMA(1,0,1) Residual Time-Series<br/>Models macro market price momentum from past auction weeks"]
        P2_Gate["Holdout Gatekeeper:<br/>Hybrid must beat simple baseline MAE in walk-forward backtest"]
        P2_Out["Estimated Market Value (PHP) + 3-Month Trajectory"]
        P2_In --> P2_Stage1 --> P2_Stage2 --> P2_Gate --> P2_Out
    end

    subgraph Pipeline_3 ["Municipal Macro Commodity & Disease Forecasts (forecasting.py)"]
        P3_In["Approved Monthly Municipal Aggregates<br/>(Milk liters, Abattoir carcass kg, Disease cases, Mortality heads)"]
        P3_Tourney["Automated Benchmark Tournament:<br/>Naive vs Seasonal-Naive vs Linear vs Random Forest (50) vs ARIMA vs Holt-Winters"]
        P3_Select["Selects Candidate with Lowest Rolling-Origin MAE/RMSE<br/>(Advanced model must beat Naive Baseline to be deployed)"]
        P3_Out["6-Month Out-of-Sample Horizon with Prediction Intervals"]
        P3_In --> P3_Tourney --> P3_Select --> P3_Out
    end
```

---

## Summary of Subsystem Integration

| Domain | Ingestion Channel | Validation Authority | Storage Model | Downstream Consumption |
| :--- | :--- | :--- | :--- | :--- |
| **Animals** | Farmer entry / Bulk CSV | SIBAT verification ➔ MAO approval | `LivestockInventory` | GIS Inventory Layer, Census, Lineage, Weigh-in ADG |
| **Dairy Milk** | Farmer daily session | SIBAT verification ➔ MAO approval | `ProductionRecord` | Random Forest 7-day forecast, Farm revenue charts |
| **Slaughter Meat** | Abattoir staff tally / Bulk CSV | MAO approval | `SlaughterRecord` | Municipal meat yield analytics, Time-series ARIMA |
| **Disease Cases** | Farmer observation / CBAT log | SIBAT field check ➔ MAO Vet | `DiseaseCase` | 90-day GIS Outbreak Rings, Random Forest morbidity ML |
| **Mortalities** | Farmer log / CBAT casualty report | SIBAT field check ➔ MAO approval | `MortalityRecord` | Changes animal to `DECEASED`, GIS Mortality Timeline |
| **Auction Sales** | Auction gate staff entry / Bulk CSV | MAO approval | `LiveAnimalSale` | Ridge + ARIMA price-by-profile, Weekly market volume |
