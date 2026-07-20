import type { AlestePublicResult, AlestePublicSupplement, AlestePublicTestInput, AlestePublicTestResponse } from "./types";

const BASE_URL = "https://www.alesteviaggi.it";
const AUTOCOMPLETE_URL = `${BASE_URL}/umbraco/Surface/Site3Widgets/GetMultiAutocompleteValues?dg-lng=it`;
const SEARCH_RESULT_PAGE_URL = `${BASE_URL}/umbraco/Surface/Search/GetSearchResultPageUrl?dg-lng=it`;
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 60_000;
const MAX_PRODUCTS_PER_TEST = 40;
const USER_AGENT = "IschiaStars Aleste public feasibility test; admin-controlled; contact info@ischiastars.it";

type CacheEntry = {
  expiresAt: number;
  response: AlestePublicTestResponse;
};

type AlesteAutocompleteItem = {
  Name?: string;
  ResultType?: number;
  StartDate?: string;
  EndDate?: string;
  DestinationCode?: string | null;
  ProductCode?: string | null;
  DetailsBaseUrl?: string | null;
  Pax?: string | null;
  OfferGuid?: string | null;
  ProviderCode?: string | null;
};

type ParsedAttributeMap = Record<string, string>;

let activeSearch = false;
const cache = new Map<string, CacheEntry>();

export function isAlestePublicTestEnabled() {
  return process.env.ALESTE_PUBLIC_TEST_ENABLED === "true";
}

export async function runAlestePublicTest(input: AlestePublicTestInput): Promise<AlestePublicTestResponse> {
  const normalized = normalizeInput(input);
  const groups = buildGroups(normalized);
  const cacheKey = JSON.stringify({ ...normalized, groups });
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return { ...cached.response, cached: true };
  }

  if (activeSearch) {
    return buildErrorResponse(normalized, groups, "Controllo Aleste già in corso, riprova tra poco.");
  }

  activeSearch = true;
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const endpoints = new Set<string>();
  const warnings: string[] = [];
  const errors: string[] = [];
  let blocked = false;
  let productsChecked = 0;
  let productsFound = 0;
  let productSource = "autocomplete";

  try {
    const searchProducts = await fetchSearchResultProducts(normalized);
    endpoints.add(SEARCH_RESULT_PAGE_URL);
    for (const endpoint of searchProducts.endpoints) endpoints.add(endpoint);
    if (searchProducts.blocked) blocked = true;
    if (searchProducts.error) warnings.push(searchProducts.error);

    let sourceItems = searchProducts.items;
    productSource = searchProducts.source;
    if (!sourceItems.length && !blocked) {
      const catalogProducts = await fetchCatalogProducts(normalized.destination);
      for (const endpoint of catalogProducts.endpoints) endpoints.add(endpoint);
      if (catalogProducts.blocked) blocked = true;
      if (catalogProducts.error) warnings.push(catalogProducts.error);
      sourceItems = catalogProducts.items;
      productSource = catalogProducts.source;
    }

    if (!sourceItems.length && !blocked) {
      const autocomplete = await fetchAutocomplete(searchQueryFromDestination(normalized.destination));
      endpoints.add(AUTOCOMPLETE_URL);
      if (autocomplete.blocked) blocked = true;
      if (autocomplete.error) errors.push(autocomplete.error);
      sourceItems = autocomplete.items;
      productSource = "autocomplete";
    }

    const productItems = uniqueProducts(sourceItems)
      .filter((item) => item.ResultType === 1 || item.ResultType === 2)
      .filter((item) => item.ProductCode && item.DetailsBaseUrl)
      .slice(0, MAX_PRODUCTS_PER_TEST);
    productsFound = uniqueProducts(sourceItems).filter((item) => item.ProductCode).length;

    if (!productItems.length && !errors.length) {
      warnings.push("Sorgenti pubbliche Aleste raggiunte, ma nessun prodotto interrogabile trovato per la destinazione indicata.");
    }
    if (productsFound > productItems.length) {
      warnings.push(`Risultati limitati ai primi ${MAX_PRODUCTS_PER_TEST} prodotti per mantenere il test prudente.`);
    }
    if (productSource === "catalog_grid") {
      warnings.push("Prodotti letti dalla griglia pubblica catalogo: la disponibilità viene comunque verificata sui dettagli per le date richieste.");
    }

    const results: AlestePublicResult[] = [];
    for (const item of productItems) {
      productsChecked += 1;
      const sourceUrl = buildDetailUrl(item, normalized, groups);
      endpoints.add(sourceUrlWithoutDynamicIds(sourceUrl));
      const detailPage = await fetchText(sourceUrl);
      if (detailPage.status === 403 || detailPage.status === 429) {
        blocked = true;
        errors.push(`Aleste ha risposto ${detailPage.status}; test interrotto.`);
        break;
      }
      if (!detailPage.ok) {
        errors.push(`Dettaglio ${safeProductCode(item.ProductCode)} non leggibile: HTTP ${detailPage.status}.`);
        continue;
      }

      const ajaxUrl = extractDetailsAjaxUrl(detailPage.text);
      if (!ajaxUrl) {
        results.push(buildPartialResult(item, normalized, groups, sourceUrl, checkedAt, ["camera", "trattamento", "prezzo totale", "disponibilità"]));
        continue;
      }

      endpoints.add(sourceUrlWithoutDynamicIds(ajaxUrl));
      const detailAjax = await fetchText(ajaxUrl);
      if (detailAjax.status === 403 || detailAjax.status === 429) {
        blocked = true;
        errors.push(`Aleste ha risposto ${detailAjax.status} sul dettaglio AJAX; test interrotto.`);
        break;
      }
      if (!detailAjax.ok) {
        errors.push(`Dettaglio AJAX ${safeProductCode(item.ProductCode)} non leggibile: HTTP ${detailAjax.status}.`);
        continue;
      }

      results.push(...parseDetailResults(detailAjax.text, item, normalized, sourceUrl, checkedAt));
    }

    const response: AlestePublicTestResponse = {
      ok: errors.length === 0,
      cached: false,
      durationMs: Date.now() - startedAt,
      checkedAt,
      params: { ...normalized, groups },
      results,
      warnings,
      errors,
      technical: {
        endpoints: Array.from(endpoints),
        productsChecked,
        productsFound,
        productSource,
        blocked
      }
    };

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, response });
    return response;
  } finally {
    activeSearch = false;
  }
}

function normalizeInput(input: AlestePublicTestInput): AlestePublicTestInput {
  const adults = clampInt(input.adults, 1, 6, 2);
  const rooms = clampInt(input.rooms, 1, 3, 1);
  return {
    destination: input.destination.trim(),
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults,
    rooms,
    childrenAges: input.childrenAges.map((age) => clampInt(age, 0, 17, 0))
  };
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function buildGroups(input: AlestePublicTestInput) {
  const children = input.childrenAges.map((age) => `C${age}`).join(";");
  const firstRoom = [`A${input.adults}`, children].filter(Boolean).join(";");
  const groups = [`[${firstRoom}]`];
  for (let index = 1; index < input.rooms; index += 1) {
    groups.push("[A2]");
  }
  return groups.join("");
}

function searchQueryFromDestination(destination: string) {
  const withoutCodeDetails = destination.replace(/\s*\([^)]*\)/g, "").trim();
  return withoutCodeDetails || destination;
}

async function fetchAutocomplete(query: string) {
  const body = new URLSearchParams({
    Language: "it",
    IncludeDestinations: "True",
    IncludeProducts: "True",
    IncludeOffers: "True",
    Query: query
  });
  const response = await fetchText(AUTOCOMPLETE_URL, body);
  if (response.status === 403 || response.status === 429) return { items: [], blocked: true, error: `Autocomplete bloccato con HTTP ${response.status}.` };
  if (!response.ok) return { items: [], blocked: false, error: `Autocomplete non riuscito: HTTP ${response.status}.` };
  try {
    const parsed = JSON.parse(response.text) as AlesteAutocompleteItem[];
    return { items: Array.isArray(parsed) ? parsed : [], blocked: false, error: undefined };
  } catch {
    return { items: [], blocked: false, error: "Autocomplete non ha restituito JSON valido." };
  }
}

async function fetchSearchResultProducts(input: AlestePublicTestInput) {
  const body = buildSearchPayload(input);
  const response = await fetchText(SEARCH_RESULT_PAGE_URL, body, `${BASE_URL}/it/ischia-griglia`);
  if (response.status === 403 || response.status === 429) {
    return { items: [], endpoints: [SEARCH_RESULT_PAGE_URL], source: "search_results", blocked: true, error: `Ricerca risultati bloccata con HTTP ${response.status}.` };
  }
  if (!response.ok) {
    return { items: [], endpoints: [SEARCH_RESULT_PAGE_URL], source: "search_results", blocked: false, error: `Ricerca risultati non riuscita: HTTP ${response.status}.` };
  }

  let redirectUrl: string | null = null;
  try {
    const parsed = JSON.parse(response.text) as { RedirectUrl?: string; IsFailed?: boolean; Errors?: Record<string, string> };
    if (parsed.IsFailed) {
      const message = Object.values(parsed.Errors ?? {}).join("; ");
      return { items: [], endpoints: [SEARCH_RESULT_PAGE_URL], source: "search_results", blocked: false, error: message || "Ricerca risultati Aleste non riuscita." };
    }
    redirectUrl = parsed.RedirectUrl ?? null;
  } catch {
    return { items: [], endpoints: [SEARCH_RESULT_PAGE_URL], source: "search_results", blocked: false, error: "Ricerca risultati non ha restituito JSON valido." };
  }

  if (!redirectUrl) {
    return { items: [], endpoints: [SEARCH_RESULT_PAGE_URL], source: "search_results", blocked: false, error: "Ricerca risultati senza RedirectUrl." };
  }

  const absoluteRedirectUrl = new URL(redirectUrl, BASE_URL).toString();
  const page = await fetchText(absoluteRedirectUrl, undefined, `${BASE_URL}/it/ischia-griglia`);
  if (page.status === 403 || page.status === 429) {
    return { items: [], endpoints: [SEARCH_RESULT_PAGE_URL, sourceUrlWithoutDynamicIds(absoluteRedirectUrl)], source: "search_results", blocked: true, error: `Pagina risultati bloccata con HTTP ${page.status}.` };
  }
  if (!page.ok) {
    return { items: [], endpoints: [SEARCH_RESULT_PAGE_URL, sourceUrlWithoutDynamicIds(absoluteRedirectUrl)], source: "search_results", blocked: false, error: `Pagina risultati non leggibile: HTTP ${page.status}.` };
  }

  return {
    items: parseProductItemsFromHtml(page.text, input.destination),
    endpoints: [SEARCH_RESULT_PAGE_URL, sourceUrlWithoutDynamicIds(absoluteRedirectUrl)],
    source: "search_results",
    blocked: false,
    error: undefined
  };
}

function buildSearchPayload(input: AlestePublicTestInput) {
  const body = new URLSearchParams({
    "request[SubPanelAlias]": "hotel",
    "request[Panel]": "hotel",
    "request[DateFrom]": formatAlesteDate(input.checkIn),
    "request[DateTo]": formatAlesteDate(input.checkOut),
    "request[IsRoundTrip]": "true",
    "request[LanguageIsoCode]": "it",
    "request[DaysToSubtractFromSelectedDate]": "0",
    "request[DaysToAddToSelectedDate]": "0",
    "request[DestinationType]": "",
    "request[Destination]": input.destination
  });

  body.set("request[Rooms][0][AdultsNumber]", String(input.adults));
  input.childrenAges.forEach((age, index) => {
    body.set(`request[Rooms][0][ChildrenAges][${index}]`, String(age));
  });
  for (let roomIndex = 1; roomIndex < input.rooms; roomIndex += 1) {
    body.set(`request[Rooms][${roomIndex}][AdultsNumber]`, "2");
  }
  return body;
}

async function fetchCatalogProducts(destination: string) {
  const catalogUrl = catalogUrlForDestination(destination);
  if (!catalogUrl) {
    return { items: [], endpoints: [], source: "catalog_grid", blocked: false, error: "Catalogo pubblico non mappato per questa destinazione; uso fallback autocomplete." };
  }

  const response = await fetchText(catalogUrl);
  if (response.status === 403 || response.status === 429) {
    return { items: [], endpoints: [catalogUrl], source: "catalog_grid", blocked: true, error: `Catalogo pubblico bloccato con HTTP ${response.status}.` };
  }
  if (!response.ok) {
    return { items: [], endpoints: [catalogUrl], source: "catalog_grid", blocked: false, error: `Catalogo pubblico non leggibile: HTTP ${response.status}.` };
  }

  return {
    items: parseProductItemsFromHtml(response.text, destination),
    endpoints: [catalogUrl],
    source: "catalog_grid",
    blocked: false,
    error: undefined
  };
}

function catalogUrlForDestination(destination: string) {
  if (/ischia/i.test(destination)) return `${BASE_URL}/it/ischia-griglia`;
  return null;
}

function parseProductItemsFromHtml(html: string, destination: string): AlesteAutocompleteItem[] {
  const items: AlesteAutocompleteItem[] = [];
  const decodedHtml = decodeText(html);
  const urlPatterns = [
    /(?:href|data-dg-url)=["']([^"']*\/it\/booking\/dettagli\/hotel[^"']*)["']/gi,
    /(?:href|data-dg-url)=["']([^"']*\/it\/b\/hotel\/[^"']*)["']/gi
  ];

  for (const pattern of urlPatterns) {
    for (const match of Array.from(decodedHtml.matchAll(pattern))) {
      const rawUrl = match[1];
      if (!rawUrl) continue;
      const item = productItemFromPublicUrl(rawUrl, destination);
      if (item) items.push(item);
    }
  }

  return uniqueProducts(items);
}

function productItemFromPublicUrl(rawUrl: string, destination: string): AlesteAutocompleteItem | null {
  let url: URL;
  try {
    url = new URL(rawUrl.replaceAll("&amp;", "&"), BASE_URL);
  } catch {
    return null;
  }

  const explicitProductCode = url.searchParams.get("ProductCode");
  const productCode = explicitProductCode ?? productCodeFromOfferPath(url.pathname);
  if (!productCode) return null;

  return {
    Name: nameFromOfferPath(url.pathname, productCode),
    ResultType: 1,
    DestinationCode: destination,
    ProductCode: productCode,
    DetailsBaseUrl: `${BASE_URL}/it/booking/dettagli/hotel`,
    ProviderCode: url.searchParams.get("ProviderCode")
  };
}

function productCodeFromOfferPath(pathname: string) {
  const lastSegment = pathname.split("/").filter(Boolean).pop() ?? "";
  const match = lastSegment.match(/-([A-Z0-9]+)$/);
  return match?.[1] ?? null;
}

function nameFromOfferPath(pathname: string, productCode: string) {
  const lastSegment = pathname.split("/").filter(Boolean).pop() ?? "";
  const withoutCode = lastSegment.replace(new RegExp(`-${escapeRegExp(productCode)}$`), "");
  if (!withoutCode) return productCode;
  return withoutCode
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueProducts(items: AlesteAutocompleteItem[]) {
  const seen = new Set<string>();
  const unique: AlesteAutocompleteItem[] = [];
  for (const item of items) {
    const key = item.ProductCode;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

async function fetchText(url: string, body?: URLSearchParams, referer?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "Accept": body ? "application/json, text/html;q=0.9, */*;q=0.8" : "text/html, */*;q=0.8",
      "Content-Type": body ? "application/x-www-form-urlencoded; charset=UTF-8" : "text/html; charset=UTF-8",
      "User-Agent": USER_AGENT
    };
    if (body) headers["X-Requested-With"] = "XMLHttpRequest";
    if (referer) headers["Referer"] = referer;

    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      body,
      cache: "no-store",
      signal: controller.signal,
      headers
    });
    return { ok: response.ok, status: response.status, text: await response.text() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 0, text: `Timeout/errore rete: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}

function buildDetailUrl(item: AlesteAutocompleteItem, input: AlestePublicTestInput, groups: string) {
  const url = new URL(item.DetailsBaseUrl || `${BASE_URL}/it/booking/dettagli/hotel`);
  url.searchParams.set("ProductCode", item.ProductCode || "");
  if (item.ProviderCode) url.searchParams.set("ProviderCode", item.ProviderCode);
  url.searchParams.set("StartDate", formatAlesteDate(input.checkIn));
  url.searchParams.set("EndDate", formatAlesteDate(input.checkOut));
  url.searchParams.set("Groups", groups);
  url.searchParams.set("Destination", `[COD;${input.destination}]`);
  if (item.OfferGuid) url.searchParams.set("OfferId", item.OfferGuid);
  return url.toString();
}

function formatAlesteDate(value: string) {
  return value.replaceAll("-", "");
}

function parseDetailResults(html: string, item: AlesteAutocompleteItem, input: AlestePublicTestInput, sourceUrl: string, checkedAt: string): AlestePublicResult[] {
  if (/non\s+è\s+disponibile|non disponibile|date diverse/i.test(stripTags(html))) {
    return [buildPartialResult(item, input, buildGroups(input), sourceUrl, checkedAt, ["camera", "trattamento", "prezzo totale"], "non_disponibile")];
  }

  const accommodationInputs = findInputsByRole(html, "accommodation-radio");
  if (!accommodationInputs.length) {
    return [buildPartialResult(item, input, buildGroups(input), sourceUrl, checkedAt, ["camera", "trattamento", "prezzo totale", "disponibilità"])];
  }

  return accommodationInputs.map((attrs) => {
    const accommodationId = attrs.id ?? attrs["data-dg-accommodation"] ?? "";
    const boards = findInputsByRole(html, "board-radio").filter((board) => board["data-dg-accommodation"] === accommodationId);
    const selectedBoard = boards.find((board) => board.checked != null) ?? boards[0];
    const supplements = findInputsByRole(html, "sup-check")
      .filter((sup) => sup["data-dg-accommodation"] === accommodationId && sup.checked != null)
      .map(readPricedName);
    const reductions = findInputsByRole(html, "red-check")
      .filter((red) => red["data-dg-accommodation"] === accommodationId && red.checked != null)
      .map(readPricedName);

    const basePrice = readNumber(attrs["data-dg-grossprice"] ?? attrs["data-dg-price"]);
    const boardPrice = selectedBoard ? readNumber(selectedBoard["data-dg-grossprice"] ?? selectedBoard["data-dg-price"]) : 0;
    const supplementsTotal = supplements.reduce((sum, item) => sum + (item.price ?? 0), 0);
    const reductionsTotal = reductions.reduce((sum, item) => sum + (item.price ?? 0), 0);
    const totalPrice = basePrice == null ? null : basePrice + (boardPrice ?? 0) + supplementsTotal + reductionsTotal;
    const missingFields = [
      attrs["data-dg-name"] ? "" : "camera",
      selectedBoard?.["data-dg-name"] ? "" : "trattamento",
      totalPrice != null ? "" : "prezzo totale",
      attrs["data-dg-availability-status"] ? "" : "disponibilità",
      item.OfferGuid ? "" : "OfferId"
    ].filter(Boolean);

    return {
      source: "aleste_public",
      hotelName: decodeText(item.Name ?? attrs["data-dg-product-name"] ?? "Prodotto Aleste"),
      productCode: item.ProductCode ?? attrs["data-dg-product-code"] ?? null,
      destination: input.destination,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights: differenceInDays(input.checkIn, input.checkOut),
      adults: input.adults,
      childrenAges: input.childrenAges,
      rooms: input.rooms,
      roomName: decodeText(attrs["data-dg-name"] ?? ""),
      boardName: selectedBoard ? decodeText(selectedBoard["data-dg-name"] ?? "") : null,
      totalPrice,
      pricePerPerson: totalPrice != null ? totalPrice / Math.max(1, input.adults + input.childrenAges.length) : null,
      originalPrice: readNumber(attrs["data-dg-price"]),
      supplements,
      reductions,
      availabilityStatus: attrs["data-dg-availability-status"] ?? null,
      offerId: item.OfferGuid ?? null,
      maskedOfferId: maskId(item.OfferGuid ?? null),
      sourceUrl,
      checkedAt,
      missingFields
    } satisfies AlestePublicResult;
  });
}

function buildPartialResult(item: AlesteAutocompleteItem, input: AlestePublicTestInput, groups: string, sourceUrl: string, checkedAt: string, missingFields: string[], availabilityStatus: string | null = null): AlestePublicResult {
  void groups;
  return {
    source: "aleste_public",
    hotelName: decodeText(item.Name ?? "Prodotto Aleste"),
    productCode: item.ProductCode ?? null,
    destination: input.destination,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights: differenceInDays(input.checkIn, input.checkOut),
    adults: input.adults,
    childrenAges: input.childrenAges,
    rooms: input.rooms,
    roomName: null,
    boardName: null,
    totalPrice: null,
    pricePerPerson: null,
    originalPrice: null,
    supplements: [],
    reductions: [],
    availabilityStatus,
    offerId: item.OfferGuid ?? null,
    maskedOfferId: maskId(item.OfferGuid ?? null),
    sourceUrl,
    checkedAt,
    missingFields
  };
}

function extractDetailsAjaxUrl(html: string) {
  const match = html.match(/InitializeDetailsPage\("([^"]+)"/);
  if (!match?.[1]) return null;
  return decodeText(match[1]);
}

function findInputsByRole(html: string, role: string): ParsedAttributeMap[] {
  const pattern = new RegExp(`<input\\b[^>]*dg-role=["']${escapeRegExp(role)}["'][^>]*>`, "gi");
  return Array.from(html.matchAll(pattern)).map((match) => parseAttributes(match[0]));
}

function parseAttributes(tag: string): ParsedAttributeMap {
  const attrs: ParsedAttributeMap = {};
  for (const match of Array.from(tag.matchAll(/([:\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))) {
    const key = match[1]?.toLowerCase();
    if (!key || key === "input") continue;
    attrs[key] = decodeText(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function readPricedName(attrs: ParsedAttributeMap): AlestePublicSupplement {
  return {
    name: decodeText(attrs["data-dg-name"] ?? attrs["data-dg-code"] ?? "Voce"),
    price: readNumber(attrs["data-dg-grossprice"] ?? attrs["data-dg-price"])
  };
}

function readNumber(value?: string) {
  if (!value) return null;
  const cleaned = value.replace(/[^\d.,-]/g, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function differenceInDays(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 86_400_000);
}

function maskId(value: string | null) {
  if (!value) return null;
  if (value.length <= 10) return "***";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function safeProductCode(value?: string | null) {
  if (!value) return "sconosciuto";
  return value.replace(/[^\w-]/g, "").slice(0, 20);
}

function sourceUrlWithoutDynamicIds(value: string) {
  try {
    const url = new URL(value);
    for (const key of ["SearchId", "OfferId", "PageId", "OCCatalogResultGuid"]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, "***");
    }
    return url.toString();
  } catch {
    return value;
  }
}

function stripTags(value: string) {
  return decodeText(value.replace(/<[^>]+>/g, " "));
}

function decodeText(value: string) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&#224;", "à")
    .replaceAll("&#232;", "è")
    .replaceAll("&#233;", "é")
    .replaceAll("&#236;", "ì")
    .replaceAll("&#242;", "ò")
    .replaceAll("&#249;", "ù")
    .replaceAll("&amp;", "&")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildErrorResponse(input: AlestePublicTestInput, groups: string, error: string): AlestePublicTestResponse {
  const checkedAt = new Date().toISOString();
  return {
    ok: false,
    cached: false,
    durationMs: 0,
    checkedAt,
    params: { ...input, groups },
    results: [],
    warnings: [],
    errors: [error],
    technical: {
      endpoints: [],
      productsChecked: 0,
      blocked: false
    }
  };
}
