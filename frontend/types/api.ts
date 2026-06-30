/**
 * Shared API types for the ShiftWise frontend.
 *
 * These mirror the backend Prisma models / route responses. Fields that aren't
 * always present in a given response are marked optional so the same interface
 * can be reused across endpoints. Start here when replacing `any` usages.
 */

export type WorkerStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface Worker {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    jobTitle?: string;
    startDate?: string;
    status?: WorkerStatus;
    niNumber?: string;
    dateOfBirth?: string;
    notes?: string | null;
    isActive?: boolean;
    // Derived/aggregated fields (present on some list responses)
    complianceScore?: number;
    documentsUploaded?: number;
    documentsTotal?: number;
    // Included by GET /api/documents/agency
    complianceDocuments?: ComplianceDocument[];
}

export interface DocumentType {
    id: string;
    name: string;
    description?: string | null;
    isRequired?: boolean;
    expiryWarningDays?: number;
    hasExpiry?: boolean;
}

export interface ComplianceDocument {
    id: string;
    fileName?: string;
    status?: string;
    issueDate?: string | null;
    expiryDate?: string | null;
    documentType?: DocumentType;
    analysisResult?: AnalysisResult | null;
}

/** One row of GET /api/documents/worker/:workerId — a doc type + its uploaded doc (if any). */
export interface DocSlot {
    documentType: DocumentType;
    document: ComplianceDocument | null;
    computedStatus: string;
}

/** Result of the document analysis/OCR step (loosely typed — backend JSON). */
export interface AnalysisResult {
    summary?: string;
    fullName?: string;
    documentType?: string;
    documentNumber?: string;
    issuingAuthority?: string;
    issueDate?: string;
    expiryDate?: string;
    concerns?: string[];
    wrongDocumentWarning?: string;
    [key: string]: unknown;
}

export interface Shift {
    id: string;
    facilityName: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    role: string;
    requiredCount: number;
    notes?: string | null;
    assignments?: ShiftAssignment[];
}

export interface ShiftAssignment {
    id: string;
    shiftId: string;
    workerId?: string;
    workerConfirmation?: "pending" | "confirmed" | "declined";
    worker?: Pick<Worker, "id" | "firstName" | "lastName" | "email">;
    shift?: Shift;
    complianceSnapshot?: { complianceScore: number; status: string };
    assignedAt?: string;
}

export interface ShiftTemplate {
    id: string;
    name: string;
    facilityName: string;
    role: string;
    startTime: string;
    endTime: string;
    requiredCount: number;
    complianceCheckup?: boolean;
    notes?: string | null;
}

export interface Paginated<T> {
    data: T[];
    pagination?: { page: number; limit: number; total: number; totalPages?: number; pages?: number };
}
