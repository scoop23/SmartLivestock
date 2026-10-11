"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSpeciesPreset, SPECIES_PRESETS } from "@/app/(farmer)/livestock-inventory/livestock-inventory";

interface LivestockBreedFieldProps {
  id: string;
  value: string;
  species?: string | null;
  label?: string;
  placeholder?: string;
  customPlaceholder?: string;
  required?: boolean;
  className?: string;
  controlClassName?: string;
  onChange: (breed: string) => void;
}

/** Offers the same species-specific breeds as livestock registration, with a custom option. */
export function LivestockBreedField({
  id,
  value,
  species,
  label = "Breed",
  placeholder = "Select a breed",
  customPlaceholder = "Enter a breed not listed",
  required = false,
  className = "",
  controlClassName = "",
  onChange,
}: LivestockBreedFieldProps) {
  const [customMode, setCustomMode] = useState(false);
  const speciesPreset = species && species.toUpperCase() !== "ALL"
    ? getSpeciesPreset(species)
    : null;
  const breeds = speciesPreset
    ? speciesPreset.commonBreeds
    : [...new Set(Object.values(SPECIES_PRESETS).flatMap((preset) => preset.commonBreeds))];
  // Existing values absent from the selected species list stay editable as custom breeds.
  const isCustom = value ? !breeds.includes(value) : customMode;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={id} className="text-xs font-semibold text-slate-700">{label}</Label>
      <Select
        value={isCustom ? "OTHER" : value}
        onValueChange={(selected) => {
          if (selected === "OTHER") {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(selected);
          }
        }}
      >
        <SelectTrigger id={id} aria-required={required} className={`w-full ${controlClassName}`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="z-[var(--z-popover-dialog)] max-h-60">
          {breeds.map((breed) => <SelectItem key={breed} value={breed}>{breed}</SelectItem>)}
          <SelectItem value="OTHER">Other / custom breed</SelectItem>
        </SelectContent>
      </Select>
      {isCustom ? (
        <Input
          id={`${id}-custom`}
          aria-label={`${label} custom value`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={customPlaceholder}
          required={required}
          className={`w-full ${controlClassName}`}
        />
      ) : null}
    </div>
  );
}
