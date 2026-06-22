import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type {
  Product,
  ProductListResponse,
  ProductStock,
  ProductStockResponse,
  LogisticsRow,
  TokenResponse,
} from './types';

const API_BASE_URL = 'https://api.kasseservice.no/v1';
const PAGINATION_DELAY_MS = 10_000;
const RATE_LIMIT_RESET_BUFFER_MS = 1_000;
const FALLBACK_RATE_LIMIT_DELAY_MS = 60_000;
const MAX_RATE_LIMIT_RETRIES = 5;

const excludedProductNumbers = new Set(
  readFileSync(resolve(__dirname, './excluded-products.txt'), 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
);

let cachedToken: string | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitBeforeNextPaginationRequest() {
  await sleep(PAGINATION_DELAY_MS);
}

function normalizeHeaderValue(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeHeaderValue(value[0]);
  }

  return value === undefined || value === null ? undefined : String(value);
}

function getHeaderValue(
  headers: AxiosResponse['headers'],
  headerName: string
) {
  if (typeof headers.get === 'function') {
    return normalizeHeaderValue(headers.get(headerName));
  }

  return normalizeHeaderValue(
    headers[headerName] ?? headers[headerName.toLowerCase()]
  );
}

function getRateLimitDelayMs(response?: AxiosResponse) {
  if (!response) {
    return FALLBACK_RATE_LIMIT_DELAY_MS;
  }

  const retryAfter = getHeaderValue(response.headers, 'retry-after');

  if (retryAfter) {
    const retryAfterSeconds = Number.parseInt(retryAfter, 10);

    if (!Number.isNaN(retryAfterSeconds)) {
      return retryAfterSeconds * 1000 + RATE_LIMIT_RESET_BUFFER_MS;
    }

    const retryAfterDate = Date.parse(retryAfter);

    if (!Number.isNaN(retryAfterDate)) {
      return Math.max(
        retryAfterDate - Date.now() + RATE_LIMIT_RESET_BUFFER_MS,
        RATE_LIMIT_RESET_BUFFER_MS
      );
    }
  }

  const reset = getHeaderValue(response.headers, 'x-duell-ratelimit-reset');

  if (reset) {
    const resetSeconds = Number.parseInt(reset, 10);

    if (!Number.isNaN(resetSeconds)) {
      return Math.max(
        resetSeconds * 1000 - Date.now() + RATE_LIMIT_RESET_BUFFER_MS,
        RATE_LIMIT_RESET_BUFFER_MS
      );
    }
  }

  return FALLBACK_RATE_LIMIT_DELAY_MS;
}

async function waitIfRateLimitExhausted(response: AxiosResponse) {
  const remaining = getHeaderValue(
    response.headers,
    'x-duell-ratelimit-remaining'
  );

  if (remaining === '0') {
    const delayMs = getRateLimitDelayMs(response);
    console.log(
      `API rate limit exhausted. Waiting ${Math.ceil(delayMs / 1000)} seconds before continuing.`
    );
    await sleep(delayMs);
  }
}

async function rateLimitedGet<T>(
  apiClient: AxiosInstance,
  url: string,
  config: AxiosRequestConfig,
  label: string
) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    try {
      const response = await apiClient.get<T>(url, config);
      await waitIfRateLimitExhausted(response);
      return response;
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 429 &&
        attempt < MAX_RATE_LIMIT_RETRIES
      ) {
        const delayMs = getRateLimitDelayMs(error.response);
        console.log(
          `Rate limited while fetching ${label}. Waiting ${Math.ceil(
            delayMs / 1000
          )} seconds before retry ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES}.`
        );
        await sleep(delayMs);
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Rate limit retries exhausted while fetching ${label}`);
}

async function getAccessToken() {
  const clientNumber = process.env.API_CLIENT_NUMBER;
  const clientToken = process.env.API_CLIENT_TOKEN;

  if (!clientNumber || !clientToken) {
    throw new Error(
      'API_CLIENT_NUMBER and API_CLIENT_TOKEN must be set in environment variables'
    );
  }

  const response = await axios.post<TokenResponse>(
    `${API_BASE_URL}/getaccesstokens`,
    new URLSearchParams({
      client_number: clientNumber,
      client_token: clientToken,
    }),
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  if (!response.data.status || !response.data.token) {
    throw new Error(`Failed to get access token: ${response.data.message}`);
  }

  console.log('Successfully fetched new API token');
  return response.data.token;
}

async function getApiClient() {
  if (!cachedToken) {
    cachedToken = await getAccessToken();
  }

  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${cachedToken}`,
    },
  });
}

async function getAllProducts() {
  const apiClient = await getApiClient();
  const allProducts: Product[] = [];
  let start = 0;
  const limit = 20;
  let hasMore = true;

  while (hasMore) {
    const { data } = await rateLimitedGet<ProductListResponse>(
      apiClient,
      '/product/list',
      {
        params: {
          start,
          limit,
          'filter[category_id]': 3,
        },
      },
      `products page starting at ${start}`
    );

    if (
      data.products &&
      Array.isArray(data.products) &&
      data.products.length > 0
    ) {
      allProducts.push(...data.products);
      hasMore = data.products.length === limit;
      start += limit;

      if (hasMore) {
        await waitBeforeNextPaginationRequest();
      }
    } else {
      hasMore = false;
    }
  }

  return allProducts;
}

async function getProductStock(productIds: number[]) {
  const apiClient = await getApiClient();
  const allStock: ProductStock[] = [];
  const BATCH_SIZE = 40;

  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batchIds = productIds.slice(i, i + BATCH_SIZE);

    let start = 0;
    const limit = 20;
    let hasMore = true;

    while (hasMore) {
      const { data } = await rateLimitedGet<ProductStockResponse>(
        apiClient,
        '/all/product/stock',
        {
          params: {
            start,
            limit,
            'filter[product_id]': batchIds,
          },
        },
        `stock batch ${i / BATCH_SIZE + 1} page starting at ${start}`
      );

      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        allStock.push(...data.data);
        hasMore = data.data.length === limit;
        start += limit;

        if (hasMore) {
          await waitBeforeNextPaginationRequest();
        }
      } else {
        hasMore = false;
      }
    }
  }

  return allStock;
}

function flattenLogisticsData(products: Product[], stock: ProductStock[]) {
  const rows: LogisticsRow[] = [];

  const productMap = new Map(products.map((p) => [p.product_id.toString(), p]));

  for (const stockItem of stock) {
    const product = productMap.get(stockItem.product_id);
    if (!product) continue;

    const paddedProductNumber = String(stockItem.product_number).trim();

    if (excludedProductNumbers.has(paddedProductNumber)) {
      continue;
    }

    const pris_eks_mva = product.price_inc_vat / 1.25;

    for (const department of stockItem.department) {
      if (!department.location || department.location.length === 0) {
        rows.push({
          varenr: paddedProductNumber,
          navn: product.product_name,
          lokasjon: '',
          kostpris: product.stock_price,
          pris_eks_mva: Math.round(pris_eks_mva * 100) / 100,
          antall: '',
        });
      } else {
        for (const location of department.location) {
          rows.push({
            varenr: paddedProductNumber,
            navn: product.product_name,
            lokasjon: location.name,
            kostpris: product.stock_price,
            pris_eks_mva: Math.round(pris_eks_mva * 100) / 100,
            antall: location.stock.toString(),
          });
        }
      }
    }
  }

  rows.sort((a, b) => b.varenr.localeCompare(a.varenr));

  return rows;
}

export async function getStocksData() {
  const products = await getAllProducts();

  if (products.length === 0) {
    return [];
  }

  const productIds = products.map((product) => product.product_id);

  const stock = await getProductStock(productIds);

  return flattenLogisticsData(products, stock);
}
