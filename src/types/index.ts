export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface CursorResponse<T> {
  content: T[];
  hasNext: boolean;
  nextCursor: number | null;
}

export type RentalType = "NOTEBOOK" | "DESKTOP";
export type RentalSpec = "NORMAL" | "HIGH";

export interface RentalPc {
  id: number;
  rentalNo: string;
  rentalType: RentalType;
  rentalSpec: RentalSpec;
  rentalStartDate: string;
  rentalEndDate: string;
  monthlyFee: number;
  isReturned: boolean;
  returnDate: string | null;
  returnedBy: string | null;
  isLost: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RentalPcRequest {
  rentalNo: string;
  rentalType: RentalType;
  rentalSpec: RentalSpec;
  rentalStartDate: string;
  rentalEndDate: string;
  monthlyFee: number;
}

export interface RentalPcUpdateRequest {
  rentalNo: string;
  rentalType: RentalType;
  rentalSpec: RentalSpec;
  rentalStartDate: string;
  rentalEndDate: string;
  monthlyFee: number;
}

export interface ReturnRequest {
  returnDate: string;
  returnedBy: string;
}

export interface MonthlyFeeEntry {
  month: string;
  fee: number;
  count: number;
}

export interface YearlyTypeEntry {
  year: number;
  notebookNormal: number;
  notebookHigh: number;
  desktopNormal: number;
  desktopHigh: number;
  total: number;
}

export interface DashboardStats {
  totalCount: number;
  notebookCount: number;
  desktopCount: number;
  normalCount: number;
  highCount: number;
  totalMonthlyFee: number;
  expiringWithin30Days: number;
  lostCount: number;
  returnedCount: number;
  monthlyFeeByMonth: MonthlyFeeEntry[];
  yearlyStats: YearlyTypeEntry[];
}
