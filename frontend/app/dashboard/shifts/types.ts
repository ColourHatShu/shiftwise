// Shared Shift types — keeps page.tsx and child components on the same
// definition so TypeScript doesn't see them as "two unrelated types".

export interface ShiftWorker {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export interface ShiftAssignment {
  id: string;
  workerId: string;
  worker: ShiftWorker;
  complianceCheckPassed: boolean;
  complianceCheckDetails?: {
    missingDocs: string[];
    expiredDocs: string[];
  };
}

export interface Shift {
  id: string;
  facilityName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
  requiredCount: number;
  status?: 'OPEN' | 'FILLED' | 'CANCELLED';
  assignments?: ShiftAssignment[];
  complianceCheckup?: boolean;
  notes?: string;
}

// Form payload used by ShiftModal — `id` is optional because new-shift
// submissions don't carry one until the API returns it.
export interface ShiftFormData extends Omit<Shift, 'id'> {
  id?: string;
}
