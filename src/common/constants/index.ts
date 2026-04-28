import { SystemRole } from '../../../generated/prisma/client';

export const MAX_SESSIONS_PER_USER = 3;

// 1FIN system roles (have global access to all companies)
export const FIN_ROLES: SystemRole[] = [
  SystemRole.FIN_DIRECTOR,
  SystemRole.FIN_ADMIN,
  SystemRole.FIN_EMPLOYEE,
];

// Client roles (access restricted to their memberships)
export const CLIENT_ROLES: SystemRole[] = [
  SystemRole.CLIENT_FOUNDER,
  SystemRole.CLIENT_DIRECTOR,
  SystemRole.CLIENT_EMPLOYEE,
];

// Helper function to check if user is 1FIN staff
export const is1FinStaff = (
  systemRole: SystemRole | null | undefined,
): boolean => {
  return (
    systemRole !== null &&
    systemRole !== undefined &&
    FIN_ROLES.includes(systemRole)
  );
};

export const MESSAGE_ARCHIVE_MONTHS = 3;

// Document expiration period (days)
export const DOCUMENT_EXPIRATION_DAYS = 10;

// Bank payment department slug - special rule: no accept/reject
export const BANK_PAYMENT_DEPARTMENT_SLUG = 'bank-payment';

// Letters department slug - special rule: no reject, clients only accept (Tanishdim)
export const LETTERS_DEPARTMENT_SLUG = 'letters';

// Invoice department slug - special rule: dynamic expiration days
export const INVOICE_DEPARTMENT_SLUG = 'invoice';

// Reconciliation department slug - special rule: no approve/reject
export const RECONCILIATION_DEPARTMENT_SLUG = 'reconciliation';

// Company info department slug - special rule: FIN only chat, no approve/reject
export const COMPANY_INFO_DEPARTMENT_SLUG = 'company-info';
