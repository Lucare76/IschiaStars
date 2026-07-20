export type AlestePublicTestInput = {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  rooms: number;
};

export type AlestePublicSupplement = {
  name: string;
  price: number | null;
};

export type AlestePublicResult = {
  source: "aleste_public";
  hotelName: string;
  productCode: string | null;
  destination: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  childrenAges: number[];
  rooms: number;
  roomName: string | null;
  boardName: string | null;
  totalPrice: number | null;
  pricePerPerson: number | null;
  originalPrice: number | null;
  supplements: AlestePublicSupplement[];
  reductions: AlestePublicSupplement[];
  availabilityStatus: string | null;
  offerId: string | null;
  maskedOfferId: string | null;
  sourceUrl: string;
  checkedAt: string;
  missingFields: string[];
};

export type AlestePublicTestResponse = {
  ok: boolean;
  cached: boolean;
  durationMs: number;
  checkedAt: string;
  params: AlestePublicTestInput & { groups: string };
  results: AlestePublicResult[];
  warnings: string[];
  errors: string[];
  technical: {
    endpoints: string[];
    productsChecked: number;
    productsFound?: number;
    productSource?: string;
    blocked: boolean;
  };
};
