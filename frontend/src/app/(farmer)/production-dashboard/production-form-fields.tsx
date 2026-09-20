import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductionType } from "./production-analytics";

interface ProductionFormFieldsProps {
  type: ProductionType;
  value: ProductionFormState;
  onChange: (field: string, val: string | number) => void;
}

export interface ProductionFormState {
  prodDate?: string;
  notes?: string;

  // Dairy milk
  milkQty?: number;
  milkTime?: string;

  // Meat & carcass
  meatQty?: number;
  meatCut?: string;
  meatPurpose?: string;

  // Eggs
  eggQty?: number;
  collectionTime?: string;

  // Wool
  woolQty?: number;
}

export default function ProductionFormFields({ type, value, onChange }: ProductionFormFieldsProps) {
  if (type === 'milk') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="milkQty" className="text-xs font-bold text-slate-700">
            Milk Quantity (Liters) *
          </Label>
          <Input
            id="milkQty"
            type="number"
            step="0.1"
            min="0.1"
            placeholder="e.g. 12.5"
            required
            value={value.milkQty ?? ""}
            onChange={(e) => onChange("milkQty", e.target.value)}
            className="rounded-xl border-slate-200"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="milkTime" className="text-xs font-bold text-slate-700">
            Milking Session
          </Label>
          <Select
            value={String(value.milkTime ?? "Morning")}
            onValueChange={(v) => onChange("milkTime", v)}
          >
            <SelectTrigger id="milkTime" className="rounded-xl border-slate-200">
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Morning">Morning Session (6:00 AM)</SelectItem>
              <SelectItem value="Afternoon">Afternoon Session (2:00 PM)</SelectItem>
              <SelectItem value="Evening">Evening Session (6:00 PM)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (type === 'meat') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="meatQty" className="text-xs font-bold text-slate-700">
            Meat / Carcass Yield (Kilograms) *
          </Label>
          <Input
            id="meatQty"
            type="number"
            step="0.5"
            min="0.5"
            placeholder="e.g. 180.0"
            required
            value={value.meatQty ?? ""}
            onChange={(e) => onChange("meatQty", e.target.value)}
            className="rounded-xl border-slate-200"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meatPurpose" className="text-xs font-bold text-slate-700">
            Slaughter / Meat Purpose
          </Label>
          <Select
            value={String(value.meatPurpose ?? "Auction / Market Sale")}
            onValueChange={(v) => onChange("meatPurpose", v)}
          >
            <SelectTrigger id="meatPurpose" className="rounded-xl border-slate-200">
              <SelectValue placeholder="Select purpose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Auction / Market Sale">Auction / Market Sale</SelectItem>
              <SelectItem value="Direct Commercial Distribution">Direct Commercial Distribution</SelectItem>
              <SelectItem value="Local Meat Shop / Retail">Local Meat Shop / Retail</SelectItem>
              <SelectItem value="Household / Event">Household / Event</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (type === 'eggs') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="eggQty" className="text-xs font-bold text-slate-700">
            Quantity (Pieces) *
          </Label>
          <Input
            id="eggQty"
            type="number"
            min="1"
            placeholder="e.g. 30"
            required
            value={value.eggQty ?? ""}
            onChange={(e) => onChange("eggQty", e.target.value)}
            className="rounded-xl border-slate-200"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="collectionTime" className="text-xs font-bold text-slate-700">
            Collection Time
          </Label>
          <Select
            value={String(value.collectionTime ?? "Morning")}
            onValueChange={(value) => onChange("collectionTime", value)}
          >
            <SelectTrigger id="collectionTime" className="rounded-xl border-slate-200">
              <SelectValue placeholder="Select time" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="Morning">Morning</SelectItem>
              <SelectItem value="Afternoon">Afternoon</SelectItem>
              <SelectItem value="Evening">Evening</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (type === 'wool') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="woolQty" className="text-xs font-bold text-slate-700">
            Quantity (kg) *
          </Label>
          <Input
            id="woolQty"
            type="number"
            step="0.1"
            min="0"
            placeholder="0.0"
            required
            value={value.woolQty ?? ""}
            onChange={(e) => onChange("woolQty", e.target.value)}
            className="rounded-xl border-slate-200"
          />
        </div>
      </div>
    );
  }

  return null;
}
