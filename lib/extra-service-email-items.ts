export type ExtraServiceEmailItem = {
  id: string;
  title: string;
  description: string;
  priceFrom: number;
  priceSuffix: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ExtraServiceEmailItemInput = Omit<ExtraServiceEmailItem, "createdAt" | "updatedAt">;

export function mapExtraServiceEmailItem(row: Record<string, unknown>): ExtraServiceEmailItem {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    priceFrom: Number(row.price_from ?? 0),
    priceSuffix: String(row.price_suffix ?? "a persona"),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}
