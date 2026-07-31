import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProductionType = 'milk' | 'slaughter' | 'sale' | 'eggs';

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

  if (type === 'slaughter') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="liveWt">Live (kg)</Label>
          <Input
            id="liveWt"
            type="number"
            required
            value={value.liveWt ?? ""}
            onChange={(e) => onChange("liveWt", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dressedWt">Dressed (kg)</Label>
          <Input
            id="dressedWt"
            type="number"
            required
            value={value.dressedWt ?? ""}
            onChange={(e) => onChange("dressedWt", e.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label htmlFor="heads">Heads</Label>
        <Input
          id="heads"
          type="number"
          required
          value={value.heads ?? ""}
          onChange={(e) => onChange("heads", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="totalKg">Total kg</Label>
        <Input
          id="totalKg"
          type="number"
          required
          value={value.totalKg ?? ""}
          onChange={(e) => onChange("totalKg", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="price">Price (₱)</Label>
        <Input
          id="price"
          type="number"
          required
          value={value.price ?? ""}
          onChange={(e) => onChange("price", e.target.value)}
        />
      </div>
    </div>
  );
}
