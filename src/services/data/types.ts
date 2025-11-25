export interface ProductListResponse {
  status: boolean;
  message: string;
  code: number;
  dateTimeBeforeQryExec: string;
  products: Product[];
  total_count: number;
}

export interface Product {
  product_id: number;
  product_name: string;
  product_number: string;
  stock_price: number;
  price_inc_vat: number;
}

export interface ProductStockResponse {
  status: boolean;
  message: string;
  code: number;
  dateTimeBeforeQryExec: string;
  data: ProductStock[];
  total_count: number;
}

export interface ProductStock {
  product_id: string;
  product_number: string;
  department: {
    department_id: string;
    stock: number;
    actual_stock: number;
    min_stock: string;
    max_stock: string;
    location: {
      id: string;
      name: string;
      stock: number;
    }[];
  }[];
}

export interface LogisticsRow {
  varenr: string; // product_number
  navn: string; // product_name
  lokasjon: string; // location name
  kostpris: number; // cost_price
  pris_eks_mva: number; // price excluding VAT
  antall: string; // stock quantity
}
