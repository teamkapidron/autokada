import axios from 'axios';
import type {
  Product,
  ProductListResponse,
  ProductStock,
  ProductStockResponse,
  LogisticsRow,
  TokenResponse,
} from './types';

const API_BASE_URL = 'https://api.kasseservice.no/v1';

let cachedToken: string | null = null;

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
    const { data } = await apiClient.get<ProductListResponse>('/product/list', {
      params: {
        start,
        limit,
        'filter[category_id]': 3,
      },
    });

    if (
      data.products &&
      Array.isArray(data.products) &&
      data.products.length > 0
    ) {
      allProducts.push(...data.products);
      hasMore = data.products.length === limit;
      start += limit;
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
      const { data } = await apiClient.get<ProductStockResponse>(
        '/all/product/stock',
        {
          params: {
            start,
            limit,
            'filter[product_id]': batchIds,
          },
        }
      );

      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        allStock.push(...data.data);
        hasMore = data.data.length === limit;
        start += limit;
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

    const pris_eks_mva = product.price_inc_vat / 1.25;

    const paddedProductNumber = String(stockItem.product_number).trim();

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
