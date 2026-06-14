import { SystemRole } from '../../../../generated/prisma/client';
import { hasGlobalCompanyAccess, is1FinStaff } from '../index';

describe('hasGlobalCompanyAccess', () => {
  it('grants global access to FIN_DIRECTOR and FIN_ADMIN', () => {
    expect(hasGlobalCompanyAccess(SystemRole.FIN_DIRECTOR)).toBe(true);
    expect(hasGlobalCompanyAccess(SystemRole.FIN_ADMIN)).toBe(true);
  });

  it('does NOT grant global access to FIN_EMPLOYEE (membership-scoped)', () => {
    expect(hasGlobalCompanyAccess(SystemRole.FIN_EMPLOYEE)).toBe(false);
  });

  it('does NOT grant global access to client roles', () => {
    expect(hasGlobalCompanyAccess(SystemRole.CLIENT_FOUNDER)).toBe(false);
    expect(hasGlobalCompanyAccess(SystemRole.CLIENT_DIRECTOR)).toBe(false);
    expect(hasGlobalCompanyAccess(SystemRole.CLIENT_EMPLOYEE)).toBe(false);
  });

  it('handles null/undefined', () => {
    expect(hasGlobalCompanyAccess(null)).toBe(false);
    expect(hasGlobalCompanyAccess(undefined)).toBe(false);
  });

  it('FIN_EMPLOYEE is still 1FIN staff (identity), even though scoped', () => {
    // is1FinStaff (behavior/identity) and hasGlobalCompanyAccess (visibility)
    // diverge precisely for FIN_EMPLOYEE.
    expect(is1FinStaff(SystemRole.FIN_EMPLOYEE)).toBe(true);
    expect(hasGlobalCompanyAccess(SystemRole.FIN_EMPLOYEE)).toBe(false);
  });
});
