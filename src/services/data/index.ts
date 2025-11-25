import axios from 'axios';
import type {
  Product,
  ProductListResponse,
  ProductStock,
  ProductStockResponse,
  LogisticsRow,
} from './types';

const API_BASE_URL = 'https://api.kasseservice.no/v1';
const AUTH_TOKEN =
  'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXUyJ9.eyJleHAiOjE3NjQ0NDY1MDgsInVzZXJuYW1lIjoiODcyMDMwIiwiaXAiOiIxOC4xODQuMTYwLjEzMiIsImNsaWVudFJvbGVzIjpbIlJPTEVfSU5WT0lDRSIsIlJPTEVfMjRTRVZFTk9GRklDRSIsIlJPTEVfQVBJX1NFVFRJTkdTIiwiUk9MRV9PUkRFUl9NT0RVTEUiLCJST0xFX0NVU1RPTUVSX0dST1VQUyIsIlJPTEVfUFJPRFVDVF9WQVJJQU5UUyIsIlJPTEVfTE9HSVNUSUNTIiwiUk9MRV9MQUJFTF9QUklOVCIsIlJPTEVfU1RPQ0tfTE9DQVRJT04iXSwiY2xpZW50TmFtZSI6IlRSVUNLUEFSVFMgVFJBRElORyBBUyIsImNsaWVudExhbmd1YWdlIjoibm8iLCJpYXQiOiIxNzY0MTg3MzA4In0.R8xKqlcOBjGrCITIUa9d3Mah3xwouKYOpZlZgs7203iheeG04-rlDmAs3cbPuOAdqOcmTxIcJdom-TmSlnJ9Vv86beefO1UkqaanXylRFl1w_3PfDVaULGDLViBPUftR3nmYRFz4OG1vn7RAaaAE1Bf72qQurxYp9Hk3SZP5bAVL6d-LQFLMkagfdosk0km3kC-oAhhGBqEeSLM1szyJyU4CcCfps_TpphIhSMCrfms4Xtls_tBRs0WrHxnjz_2on4RCw7nKZ_d3cI2Q072pA2cC4TsAbzrGrgNu-nk1nZvKedR41pjSRLTfZxXxPkLwYdwRegCfLd-yXXUpk-YUN5allByuiNL4oTtM80hk7adLH_o-O_9GVfkU3FavLkAibqSPNLT1hhC7qs6CXwB-21HFIF1OawwdMZz-yMT2YaYAI_5I4NdzJ7mcEuTRk37WsoMjBoCaxb8-a2cVsuEX4v3XU5JUelB9SmixvQ_ttfRYTted7-QWDzAvgZHYgy9m-6ZPzs7dqqUCRSPWTXZsjj-KRGSUW916_tXrS0H22LPKSUYZNCo5wIDxqhEL8nJ9vG17hxhqyTIFA2n_wPBmsRkTJD67YImlD6NaDCpecb6Don1sS-JaE7iLkiDJ3Ych3mrXDwbA91Qd9iX5TNnItFFsUkb51cjbwyFZGUK5bXA';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: AUTH_TOKEN,
  },
});

async function getAllProducts() {
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
