const NUMISTA_BASE_URL = "https://api.numista.com/api/v3";

export interface NumistaSearchResult {
  count: number;
  types: NumistaTypePreview[];
}

export interface NumistaTypePreview {
  id: number;
  title: string;
  category: string;
  issuer: {
    code: string;
    name: string;
  };
  min_year: number;
  max_year: number;
  obverse_thumbnail?: string;
  reverse_thumbnail?: string;
}

export interface NumistaTypeDetail {
  id: number;
  title: string;
  category: string;
  url: string;
  issuer: { code: string; name: string };
  min_year: number;
  max_year: number;
  weight?: number;
  size?: number;
  thickness?: number;
  orientation?: string;
  shape?: string;
  composition?: { text: string };
  value?: {
    text?: string;
    numeric_value?: number;
    currency?: { id: number; name: string; full_name?: string };
  };
  obverse?: {
    description?: string;
    lettering?: string;
    thumbnail?: string;
    picture?: string;
    engravers?: string[];
  };
  reverse?: {
    description?: string;
    lettering?: string;
    thumbnail?: string;
    picture?: string;
    engravers?: string[];
  };
  edge?: {
    description?: string;
    type?: string;
    lettering?: string;
  };
  technique?: { text: string };
  tags?: string[];
  comments?: string;
  series?: string;
  commemorated_topic?: string;
  object_type?: { id: number; name: string };
  references?: Array<{
    catalogue: { id: number; code: string };
    number: string;
  }>;
  mints?: Array<{ id: number; name: string }>;
  demonetization?: {
    is_demonetized?: boolean;
    demonetization_date?: string;
  };
  ruler?: Array<{ id: number; name: string }>;
  related_types?: Array<{
    id: number;
    title: string;
    category: string;
  }>;
}

export interface NumistaIssue {
  id: number;
  is_dated: boolean;
  year: number;
  gregorian_year: number;
  mint_letter?: string;
  mintage?: number;
  comment?: string;
}

export interface NumistaPrice {
  grade: string;
  price: number;
}

export interface NumistaPriceResult {
  currency: string;
  prices: NumistaPrice[];
}

export interface NumistaSearchParams {
  q: string;
  issuer?: string;
  year?: number;
  category?: string;
  count?: number;
  page?: number;
  lang?: string;
}

function getApiKey(): string {
  const key = process.env.NUMISTA_API_KEY;
  if (!key) throw new Error("NUMISTA_API_KEY is not configured");
  return key;
}

export async function searchTypes(
  params: NumistaSearchParams
): Promise<NumistaSearchResult> {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.q);
  if (params.issuer) searchParams.set("issuer", params.issuer);
  if (params.year) searchParams.set("year", String(params.year));
  searchParams.set("category", params.category || "coin");
  searchParams.set("count", String(params.count || 20));
  if (params.page) searchParams.set("page", String(params.page));
  searchParams.set("lang", params.lang || "en");

  const response = await fetch(
    `${NUMISTA_BASE_URL}/types?${searchParams.toString()}`,
    {
      headers: { "Numista-API-Key": getApiKey() },
    }
  );

  if (!response.ok) {
    throw new Error(`Numista API error: ${response.status}`);
  }

  return response.json();
}

export async function getTypeDetail(
  typeId: number
): Promise<NumistaTypeDetail> {
  const response = await fetch(
    `${NUMISTA_BASE_URL}/types/${typeId}?lang=de`,
    { headers: { "Numista-API-Key": getApiKey() } }
  );

  if (!response.ok) {
    throw new Error(`Numista API error: ${response.status}`);
  }

  return response.json();
}

export async function getTypeIssues(
  typeId: number
): Promise<NumistaIssue[]> {
  const response = await fetch(
    `${NUMISTA_BASE_URL}/types/${typeId}/issues?lang=de`,
    { headers: { "Numista-API-Key": getApiKey() } }
  );

  if (!response.ok) {
    throw new Error(`Numista API error: ${response.status}`);
  }

  return response.json();
}

export interface NumistaImageSearchResult {
  count: number;
  types: NumistaTypePreview[];
  experimental_tentative_year?: number | null;
  experimental_tentative_grade?: string | null;
}

export async function searchByImage(
  images: { image_data: string; mime_type: string }[],
  maxResults: number = 20
): Promise<NumistaImageSearchResult> {
  const response = await fetch(
    `${NUMISTA_BASE_URL}/search_by_image?lang=en&activate_experimental_features=true`,
    {
      method: "POST",
      headers: {
        "Numista-API-Key": getApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        category: "coin",
        images,
        max_results: maxResults,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Numista image search error: ${response.status} ${body}`);
  }

  return response.json();
}

export async function getIssuePrices(
  typeId: number,
  issueId: number
): Promise<NumistaPriceResult> {
  const response = await fetch(
    `${NUMISTA_BASE_URL}/types/${typeId}/issues/${issueId}/prices?lang=de`,
    { headers: { "Numista-API-Key": getApiKey() } }
  );

  if (!response.ok) {
    throw new Error(`Numista API error: ${response.status}`);
  }

  return response.json();
}
