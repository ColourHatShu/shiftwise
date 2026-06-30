/**
 * Unit tests for worker compliance scoring helpers
 */

import {
  calculateComplianceScore,
  getComplianceColor,
  getComplianceMessage,
  getDocumentUrgency,
} from '@/lib/worker-compliance';

describe('calculateComplianceScore', () => {
  const mockDocumentTypes = [
    { id: '1', name: 'DBS Check', isRequired: true, expiryWarningDays: 30, hasExpiry: true },
    { id: '2', name: 'Passport', isRequired: true, expiryWarningDays: 30, hasExpiry: true },
    { id: '3', name: 'CV', isRequired: false, expiryWarningDays: 0, hasExpiry: false },
    { id: '4', name: 'Reference', isRequired: false, expiryWarningDays: 0, hasExpiry: false },
    { id: '5', name: 'Training', isRequired: true, expiryWarningDays: 30, hasExpiry: true },
  ];

  it('calculates correct score with no required docs submitted', () => {
    const documents: any[] = [];
    const result = calculateComplianceScore(documents, mockDocumentTypes);

    expect(result.required).toBe(3); // DBS, Passport, Training
    expect(result.completed).toBe(0);
    expect(result.score).toBe(0);
  });

  it('calculates correct score with partial submission', () => {
    const documents = [
      {
        id: '1',
        documentTypeId: '1',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        daysUntilExpiry: 60,
      },
      {
        id: '2',
        documentTypeId: '3',
        status: 'APPROVED',
        expiryDate: null,
        daysUntilExpiry: null,
      },
    ];

    const result = calculateComplianceScore(documents as any, mockDocumentTypes);

    expect(result.required).toBe(3);
    expect(result.completed).toBe(1);
    expect(result.score).toBeCloseTo(33.33, 1);
  });

  it('calculates 100% when all required docs are approved and not expired', () => {
    const documents = [
      {
        id: '1',
        documentTypeId: '1',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 60,
      },
      {
        id: '2',
        documentTypeId: '2',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 45,
      },
      {
        id: '3',
        documentTypeId: '5',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 90,
      },
    ];

    const result = calculateComplianceScore(documents as any, mockDocumentTypes);

    expect(result.required).toBe(3);
    expect(result.completed).toBe(3);
    expect(result.score).toBe(100);
  });

  it('handles no required document types gracefully', () => {
    const documents: any[] = [];
    const emptyTypes = [
      { id: '1', name: 'CV', isRequired: false, expiryWarningDays: 0, hasExpiry: false },
    ];

    const result = calculateComplianceScore(documents, emptyTypes);

    expect(result.required).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.score).toBe(100);
  });

  it('does not count expired documents as completed', () => {
    const documents = [
      {
        id: '1',
        documentTypeId: '1',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        daysUntilExpiry: -10,
      },
      {
        id: '2',
        documentTypeId: '2',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 45,
      },
      {
        id: '3',
        documentTypeId: '5',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 90,
      },
    ];

    const result = calculateComplianceScore(documents as any, mockDocumentTypes);

    expect(result.required).toBe(3);
    expect(result.completed).toBe(2); // Only non-expired docs count
    expect(result.score).toBeCloseTo(66.67, 1);
  });
});

describe('getComplianceColor', () => {
  const mockDocumentTypes = [
    { id: '1', name: 'DBS', isRequired: true, expiryWarningDays: 30, hasExpiry: true },
    { id: '2', name: 'Passport', isRequired: true, expiryWarningDays: 30, hasExpiry: true },
  ];

  it('returns red when score is less than 100', () => {
    const documents = [
      {
        id: '1',
        documentTypeId: '1',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 60,
      },
    ];

    const color = getComplianceColor(documents as any, 50, 2);
    expect(color).toBe('red');
  });

  it('returns red when document is expired', () => {
    const documents = [
      {
        id: '1',
        documentTypeId: '1',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: -10,
      },
      {
        id: '2',
        documentTypeId: '2',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 45,
      },
    ];

    const color = getComplianceColor(documents as any, 100, 2);
    expect(color).toBe('red');
  });

  it('returns red when document is critical (<5 days)', () => {
    const documents = [
      {
        id: '1',
        documentTypeId: '1',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 3,
      },
      {
        id: '2',
        documentTypeId: '2',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 45,
      },
    ];

    const color = getComplianceColor(documents as any, 100, 2);
    expect(color).toBe('red');
  });

  it('returns yellow when score is 100 and at least one doc is 5-30 days away', () => {
    const documents = [
      {
        id: '1',
        documentTypeId: '1',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 15,
      },
      {
        id: '2',
        documentTypeId: '2',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 45,
      },
    ];

    const color = getComplianceColor(documents as any, 100, 2);
    expect(color).toBe('yellow');
  });

  it('returns green when score is 100 and all docs are >30 days away', () => {
    const documents = [
      {
        id: '1',
        documentTypeId: '1',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 60,
      },
      {
        id: '2',
        documentTypeId: '2',
        status: 'APPROVED',
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 90,
      },
    ];

    const color = getComplianceColor(documents as any, 100, 2);
    expect(color).toBe('green');
  });

  it('returns green when docs have no expiry dates', () => {
    const documents = [
      {
        id: '1',
        documentTypeId: '1',
        status: 'APPROVED',
        expiryDate: null,
        daysUntilExpiry: null,
      },
      {
        id: '2',
        documentTypeId: '2',
        status: 'APPROVED',
        expiryDate: null,
        daysUntilExpiry: null,
      },
    ];

    const color = getComplianceColor(documents as any, 100, 2);
    expect(color).toBe('green');
  });
});

describe('getComplianceMessage', () => {
  it('returns appropriate message for red status at 0%', () => {
    const message = getComplianceMessage('red', 0);
    expect(message).toBe('No documents submitted');
  });

  it('returns appropriate message for red status at 30%', () => {
    const message = getComplianceMessage('red', 30);
    expect(message).toBe('Multiple documents missing or expiring');
  });

  it('returns appropriate message for red status at 75%', () => {
    const message = getComplianceMessage('red', 75);
    expect(message).toBe('Some documents are expiring soon');
  });

  it('returns appropriate message for yellow status', () => {
    const message = getComplianceMessage('yellow', 100);
    expect(message).toContain('up to date');
    expect(message).toContain('expiring soon');
  });

  it('returns appropriate message for green status', () => {
    const message = getComplianceMessage('green', 100);
    expect(message).toBe('Your compliance is up to date');
  });
});

describe('getDocumentUrgency', () => {
  it('returns expired for past dates', () => {
    const doc = {
      expiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      daysUntilExpiry: -10,
    } as any;

    const urgency = getDocumentUrgency(doc);
    expect(urgency).toBe('expired');
  });

  it('returns critical for < 5 days', () => {
    const doc = {
      expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      daysUntilExpiry: 3,
    } as any;

    const urgency = getDocumentUrgency(doc);
    expect(urgency).toBe('critical');
  });

  it('returns warning for 5-30 days', () => {
    const doc = {
      expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      daysUntilExpiry: 15,
    } as any;

    const urgency = getDocumentUrgency(doc);
    expect(urgency).toBe('warning');
  });

  it('returns safe for > 30 days', () => {
    const doc = {
      expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      daysUntilExpiry: 60,
    } as any;

    const urgency = getDocumentUrgency(doc);
    expect(urgency).toBe('safe');
  });

  it('returns safe for no expiry date', () => {
    const doc = {
      expiryDate: null,
      daysUntilExpiry: null,
    } as any;

    const urgency = getDocumentUrgency(doc);
    expect(urgency).toBe('safe');
  });
});
