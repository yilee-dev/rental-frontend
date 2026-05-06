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
export type LabelFormat = "THERMAL_50x30" | "A4_GRID";

export type AssignmentType = "PERSONAL" | "DEPARTMENT" | "SITE";

export interface Assignment {
  id: number;
  rentalPcId: number;
  assignmentType: AssignmentType;
  /** 개인 배정 시에만 존재 */
  empNo: string | null;
  /** 개인 배정 시에만 존재 */
  userName: string | null;
  department: string | null;
  /** 팀명 — department 경로에 "/" 포함 시 파싱 모호성 해결용 별도 저장 */
  departmentName: string | null;
  companyCode: string | null;
  businessSiteCode: string | null;
  /** 사업장 배정(SITE) 시 사용 목적 */
  purpose: string | null;
  assignedBy: string;
  assignedAt: string;
}

export interface AssignmentRequest {
  assignmentType: AssignmentType;
  empNo: string | null;
  userName: string | null;
  department: string | null;
  departmentName: string | null;
  companyCode: string | null;
  businessSiteCode: string | null;
  /** 사업장 배정(SITE) 시 사용 목적 */
  purpose: string | null;
  assignedBy: string;
}

export interface UserProfile {
  id: string;
  username: string;
  givenName: string | null;
  familyName: string | null;
  name: string;
  email: string | null;
  empNo: string | null;
  department: string | null;       // 전체 경로 (트리 탐색용)
  departmentName: string | null;   // 표시용 부서명
  companyCode: string | null;      // 회사(법인) 코드
  businessSiteCode: string | null; // 사업장 코드
  enabled: boolean;
}

export interface DepartmentNode {
  name: string;
  path: string;
  children: DepartmentNode[];
}

export interface DsignInfo {
  sendStatus: DsignSendStatus;
  signStatus: DsignSignStatus;
  dsignDocId: string | null;
  signViewUrl: string | null;
}

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
  returnedByEmpNo: string | null;
  returnedBy: string | null;
  isLost: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  assignment: Assignment | null;
  dsign: DsignInfo | null;
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
  returnedByEmpNo: string | null;
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

export interface Software {
  id: number;
  name: string;
  version: string | null;
  description: string | null;
  category: string | null;
  originalFileName: string;
  fileSize: number;
  uploadedBy: string | null;
  uploadedAt: string;
}

export interface CompanySiteStatEntry {
  companyCode: string;
  companyName: string;
  businessSiteCode: string;
  businessSiteName: string;
  notebookNormal: number;
  notebookHigh: number;
  desktopNormal: number;
  desktopHigh: number;
  total: number;
}

export interface RentalPcSearchParams {
  rentalNo?: string;
  userName?: string;
  empNo?: string;
  department?: string;
  rentalType?: RentalType;
  rentalSpec?: RentalSpec;
  businessSiteCode?: string;
  status?: string;
}

export interface ReplacementRequest {
  newPc: RentalPcRequest;
  reason: string;
  replacedBy: string;
}

export interface Replacement {
  id: number;
  oldRentalPcId: number;
  oldRentalNo: string;
  newRentalPcId: number;
  newRentalNo: string;
  reason: string;
  replacedBy: string;
  replacedAt: string;
}

export type DisposalStatus = "STORED" | "DISPOSED";

export interface DisposalDisk {
  id: number;
  serialNo: string;
  pcModel: string | null;
  assetNo: string | null;
  returnedByEmpNo: string | null;
  returnedByName: string | null;
  returnedByDept: string | null;
  returnDate: string;
  registeredBy: string;
  storageLocation: string | null;
  status: DisposalStatus;
  notes: string | null;
  registeredAt: string;
  updatedAt: string | null;
}

export interface DisposalDiskRequest {
  serialNo: string;
  pcModel: string | null;
  assetNo: string | null;
  returnedByEmpNo: string | null;
  returnedByName: string | null;
  returnedByDept: string | null;
  returnDate: string;
  registeredBy: string;
  storageLocation: string | null;
  status: DisposalStatus;
  notes: string | null;
}

// 실사 (Audit)
export type AuditStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";
export type AuditItemStatus = "PENDING" | "VERIFIED" | "MISMATCH" | "MISSING";

export interface Audit {
  id: number;
  title: string;
  businessSiteCode: string;
  startDate: string;
  endDate: string;
  status: AuditStatus;
  createdBy: string;
  createdAt: string;
  totalCount: number;
  verifiedCount: number;
  mismatchCount: number;
}

export interface AuditItem {
  id: number;
  rentalPcId: number;
  rentalNo: string;
  rentalType: RentalType;
  rentalSpec: RentalSpec;
  status: AuditItemStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  notes: string | null;
  assignedUserName: string | null;
  assignedEmpNo: string | null;
  assignedDepartment: string | null;
  assignedBusinessSiteCode: string | null;
}

export interface AuditRequest {
  title: string;
  businessSiteCode: string;
  startDate: string;
  endDate: string;
  createdBy: string;
}

export interface AuditVerifyRequest {
  status: AuditItemStatus;
  verifiedBy: string;
  notes?: string;
}

// ── dsign 전자서명 ────────────────────────────────────────────────────────────
export type DsignSendStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";
export type DsignSignStatus = "WAITING" | "SIGNED" | "EXPIRED" | "UNKNOWN";

export interface DsignSignatureLog {
  id: number;
  assignmentId: number;
  rentalPcId: number;
  rentalNo: string;
  empNo: string | null;
  userName: string;
  dsignDocId: string | null;
  sendStatus: DsignSendStatus;
  sendAttemptedAt: string | null;
  sendCompletedAt: string | null;
  sendErrorMsg: string | null;
  sendRetryCount: number;
  signStatus: DsignSignStatus;
  signedAt: string | null;
  lastPolledAt: string | null;
  triggerType: "ASSIGN" | "REPLACE";
  createdAt: string;
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
  assignedCount: number;
  unassignedCount: number;
  monthlyFeeByMonth: MonthlyFeeEntry[];
  yearlyStats: YearlyTypeEntry[];
  intakeYearStats: YearlyTypeEntry[];
  companySiteStats: CompanySiteStatEntry[];
}
