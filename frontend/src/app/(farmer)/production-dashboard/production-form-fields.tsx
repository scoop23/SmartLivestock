import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProductionType = 'milk' | 'eggs' | 'wool';

interface ProductionFormFieldsProps {
  type: ProductionType;
  value: Record<string, string | number>;
  onChange: (field: string, val: string | number) => void;
}

export default function ProductionFormFields({ type, value, onChange }: ProductionFormFieldsProps) {
  if (type === 'milk') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="milkQty">Quantity (Liters)</Label>
          <Input
            id="milkQty"
            type="number"
            step="0.1"
            placeholder="0.0"
            required
            value={value.milkQty ?? ""}
            onChange={(e) => onChange("milkQty", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="milkTime">Time</Label>
          <Select
            value={String(value.milkTime ?? "")}
            onValueChange={(v) => onChange("milkTime", v)}
          >
            <SelectTrigger id="milkTime">
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

  if (type === 'eggs') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="eggQty">Quantity (Pieces)</Label>
          <Input
            id="eggQty"
            type="number"
            min="1"
            placeholder="0"
            required
            value={value.eggQty ?? ""}
            onChange={(e) => onChange("eggQty", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="collectionTime">Collection Time</Label>
          <Select
            value={String(value.collectionTime ?? "")}
            onValueChange={(value) => onChange("collectionTime", value)}
          >
            <SelectTrigger id="collectionTime">
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
          <Label htmlFor="woolQty">Quantity (kg)</Label>
          <Input
            id="woolQty"
            type="number"
            step="0.1"
            min="0"
            placeholder="0.0"
            required
            value={value.woolQty ?? ""}
            onChange={(e) => onChange("woolQty", e.target.value)}
          />
        </div>
      </div>
    );
  }

  return null;
}
