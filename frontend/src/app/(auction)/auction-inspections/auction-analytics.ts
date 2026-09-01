export interface InspectionItem {
  livestock_type: string;
  quantity: number;
  sex: "MALE" | "FEMALE" | "MIXED";
  classification: "SLAUGHTER" | "BREEDER" | "FATTENING" | "OTHER";
  remarks: string;
}

export interface InspectionRecord {
  id: number;
  control_number: string;
  shipper_name: string;
  shipper_address: string;
  origin: string;
  destination: string;
  purpose: "SLAUGHTER" | "BREEDING" | "FATTENING" | "OTHER";
  inspection_date: string;
  date_issued: string;
  time_issued: string;
  vehicle_plate_number: string;
  livestock_handler_license_no: string;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";
  items: InspectionItem[];
}

export type InspectionStatusTab = "ALL" | "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";

export const INITIAL_INSPECTIONS: InspectionRecord[] = [
  {
    id: 1,
    control_number: "CLR-2026-0001",
    shipper_name: "Juan Dela Cruz",
    shipper_address: "Purok 2, Brgy. Manggas, Padre Garcia",
    origin: "Padre Garcia, Batangas",
    destination: "Batangas City Slaughterhouse",
    purpose: "SLAUGHTER",
    inspection_date: "2026-04-25",
    date_issued: "2026-04-25",
    time_issued: "06:30 AM",
    vehicle_plate_number: "NDB-8421",
    livestock_handler_license_no: "LHL-2026-4412",
    status: "PENDING",
    items: [
      { livestock_type: "Cattle (Baka)", quantity: 5, sex: "MALE", classification: "SLAUGHTER", remarks: "Healthy stock, antemortem passed" },
      { livestock_type: "Carabao (Kalabaw)", quantity: 2, sex: "FEMALE", classification: "SLAUGHTER", remarks: "Verified ear tags" },
    ],
  },
  {
    id: 2,
    control_number: "CLR-2026-0002",
    shipper_name: "Maria Santos",
    shipper_address: "Purok 1, Brgy. Pansol, Padre Garcia",
    origin: "Padre Garcia, Batangas",
    destination: "Lipa Breeding Center",
    purpose: "BREEDING",
    inspection_date: "2026-04-24",
    date_issued: "2026-04-24",
    time_issued: "08:15 AM",
    vehicle_plate_number: "CAL-5920",
    livestock_handler_license_no: "LHL-2026-1198",
    status: "VERIFIED",
    items: [
      { livestock_type: "Cattle (Baka)", quantity: 3, sex: "FEMALE", classification: "BREEDER", remarks: "For cooperative breeding program" },
    ],
  },
  {
    id: 3,
    control_number: "CLR-2026-0003",
    shipper_name: "Pedro Reyes",
    shipper_address: "Purok 4, Brgy. Lipay, Padre Garcia",
    origin: "Padre Garcia, Batangas",
    destination: "Tanauan Fattening Yard",
    purpose: "FATTENING",
    inspection_date: "2026-04-24",
    date_issued: "2026-04-24",
    time_issued: "09:00 AM",
    vehicle_plate_number: "WXY-1049",
    livestock_handler_license_no: "LHL-2026-8831",
    status: "APPROVED",
    items: [
      { livestock_type: "Cattle (Baka)", quantity: 8, sex: "MIXED", classification: "FATTENING", remarks: "Quarantine clearance attached" },
    ],
  },
  {
    id: 4,
    control_number: "CLR-2026-0004",
    shipper_name: "Rosa Garcia",
    shipper_address: "Purok 3, Brgy. Cawongan, Padre Garcia",
    origin: "Padre Garcia, Batangas",
    destination: "Batangas City Slaughterhouse",
    purpose: "SLAUGHTER",
    inspection_date: "2026-04-23",
    date_issued: "2026-04-23",
    time_issued: "05:45 AM",
    vehicle_plate_number: "NJA-7712",
    livestock_handler_license_no: "LHL-2026-0023",
    status: "REJECTED",
    items: [
      { livestock_type: "Goat (Kambing)", quantity: 10, sex: "MIXED", classification: "SLAUGHTER", remarks: "Missing official veterinary health certificate" },
    ],
  },
];
