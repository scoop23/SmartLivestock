import { redirect } from "next/navigation";

export default function MarketPricesPage() {
  redirect("/production-dashboard/Cattle?activity=sales&mode=history&eligibleSpecies=Cattle&market=1#market-price-reference");
}
