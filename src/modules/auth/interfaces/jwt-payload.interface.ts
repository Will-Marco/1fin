import { SystemRole } from '../../../../generated/prisma/client';

export interface JwtPayload {
  sub: string; // userId
  systemRole?: SystemRole; // Only for 1FIN employees (nullable)
  sessionId: string;
}

export interface JwtPayloadWithRefresh extends JwtPayload {
  refreshToken: string;
}
