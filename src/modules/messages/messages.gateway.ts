import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../database/prisma.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token ||
                    client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload: any = this.jwtService.verify(token, {
        secret: this.configService.get('jwt.secret'),
      });

      client.userId = payload.sub;
      client.userRole = payload.systemRole;

      console.log(`Client connected: ${client.id}, User: ${client.userId}, Role: ${client.userRole}`);
    } catch (error) {
      console.log('Authentication failed:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.server.emit('user:offline', { userId: client.userId });
    }
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:department')
  async handleJoinDepartment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { companyId: string; globalDepartmentId: string },
  ) {
    const { companyId, globalDepartmentId } = data;

    let hasAccess = false;
    if (client.userRole) {
      hasAccess = true;
    } else {
      const membership = await this.prisma.userCompanyMembership.findFirst({
        where: {
          userId: client.userId,
          companyId,
          isActive: true,
          allowedDepartments: {
            some: { globalDepartmentId },
          },
        },
      });
      hasAccess = !!membership;
    }

    if (!hasAccess) {
      client.emit('error', { message: 'Ushbu bo\'limga kirish huquqi yo\'q' });
      return;
    }

    const room = `company:${companyId}:dept:${globalDepartmentId}`;
    client.join(room);

    this.server.to(room).emit('user:online', {
      userId: client.userId,
      companyId,
      globalDepartmentId,
    });

    client.emit('joined:department', { companyId, globalDepartmentId });
  }

  @SubscribeMessage('leave:department')
  handleLeaveDepartment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { companyId: string; globalDepartmentId: string },
  ) {
    const { companyId, globalDepartmentId } = data;
    const room = `company:${companyId}:dept:${globalDepartmentId}`;
    client.leave(room);
    client.emit('left:department', { companyId, globalDepartmentId });
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { companyId: string; globalDepartmentId: string },
  ) {
    const room = `company:${data.companyId}:dept:${data.globalDepartmentId}`;
    client.to(room).emit('user:typing', {
      userId: client.userId,
      companyId: data.companyId,
      globalDepartmentId: data.globalDepartmentId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { companyId: string; globalDepartmentId: string },
  ) {
    const room = `company:${data.companyId}:dept:${data.globalDepartmentId}`;
    client.to(room).emit('user:typing', {
      userId: client.userId,
      companyId: data.companyId,
      globalDepartmentId: data.globalDepartmentId,
      isTyping: false,
    });
  }

  emitToRoom(companyId: string, globalDepartmentId: string, event: string, payload: any) {
    const room = `company:${companyId}:dept:${globalDepartmentId}`;
    this.server.to(room).emit(event, payload);
  }
}
