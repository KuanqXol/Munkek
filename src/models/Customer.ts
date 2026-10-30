export interface Customer {
  id: string; // e.g. "KH-0001"
  name: string;
  phone?: string;
  address?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

