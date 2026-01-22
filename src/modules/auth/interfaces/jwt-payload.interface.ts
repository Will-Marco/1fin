import { Role } from '../../../../generated/prisma/client';

export interface JwtPayload {
  sub: string;
  role: Role;
  sessionId: string;
}

export interface JwtPayloadWithRefresh extends JwtPayload {
  refreshToken: string;
}
