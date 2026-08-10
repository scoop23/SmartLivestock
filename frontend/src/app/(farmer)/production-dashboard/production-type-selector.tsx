"use client";

import { Egg, Milk, Package } from "lucide-react";
import {
  PRODUCTION_TYPE_LABELS,
  type ProductionType,
} from "./production-analytics";

const TYPE_ICONS: Record<ProductionType, typeof Milk> = {
  milk: Milk,
  eggs: Egg,
  wool: Package,
};

export default function ProductionTypeSelector({
  types,
  selected,
  onSelect,
}: {
  types: ProductionType[];
  selected: ProductionType;
  onSelect: (type: ProductionType) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto bg-amber-900/5 p-1 rounded-xl border border-amber-900/10 w-fit">
      {types.map((type) => {
        const Icon = TYPE_ICONS[type];
        const isActive = selected === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap ${
              isActive
                ? "bg-emerald-700 text-white shadow-sm"
                : "text-stone-600 hover:text-amber-950 hover:bg-amber-900/10"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {PRODUCTION_TYPE_LABELS[type]}
          </button>
        );
      })}
    </div>
  );
}
