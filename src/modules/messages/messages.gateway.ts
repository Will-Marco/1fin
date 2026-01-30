import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
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

  private connectedUsers: Map<string, Set<string>> = new Map(); // departmentId -> Set<socketId>
  private userSockets: Map<string, string> = new Map(); // socketId -> userId

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

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('jwt.secret'),
      });

      client.userId = payload.sub;
      client.userRole = payload.role;
      this.userSockets.set(client.id, payload.sub);

      console.log(`Client connected: ${client.id}, User: ${payload.sub}`);
    } catch (error) {
      console.log('Authentication failed:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    // Remove from all departments
    this.connectedUsers.forEach((sockets, departmentId) => {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.connectedUsers.delete(departmentId);
      }
    });

    const userId = this.userSockets.get(client.id);
    this.userSockets.delete(client.id);

    if (userId) {
      // Notify others about offline status
      this.server.emit('user:offline', { userId });
    }

    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:department')
  async handleJoinDepartment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { departmentId: string },
  ) {
    const { departmentId } = data;

    // Verify membership (simplified check)
    const isMember = await this.prisma.departmentMember.findFirst({
      where: {
        departmentId,
        userId: client.userId,
      },
    });

    // Allow SUPER_ADMIN and ADMIN to join any department
    const user = await this.prisma.user.findUnique({
      where: { id: client.userId },
    });

    if (!isMember && user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN') {
      client.emit('error', { message: 'Not a member of this department' });
      return;
    }

    // Join socket room
    client.join(`department:${departmentId}`);

    // Track connected users
    if (!this.connectedUsers.has(departmentId)) {
      this.connectedUsers.set(departmentId, new Set());
    }
    this.connectedUsers.get(departmentId)!.add(client.id);

    // Notify others about online status
    this.server.to(`department:${departmentId}`).emit('user:online', {
      userId: client.userId,
      departmentId,
    });

    client.emit('joined:department', { departmentId });
  }

  @SubscribeMessage('leave:department')
  handleLeaveDepartment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { departmentId: string },
  ) {
    const { departmentId } = data;

    client.leave(`department:${departmentId}`);

    // Remove from tracking
    const departmentSockets = this.connectedUsers.get(departmentId);
    if (departmentSockets) {
      departmentSockets.delete(client.id);
    }

    client.emit('left:department', { departmentId });
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { departmentId: string },
  ) {
    client.to(`department:${data.departmentId}`).emit('user:typing', {
      userId: client.userId,
      departmentId: data.departmentId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { departmentId: string },
  ) {
    client.to(`department:${data.departmentId}`).emit('user:typing', {
      userId: client.userId,
      departmentId: data.departmentId,
      isTyping: false,
    });
  }

  // Called from service when new message is created
  emitNewMessage(departmentId: string, message: any) {
    this.server.to(`department:${departmentId}`).emit('message:new', message);
  }

  // Called from service when message is edited
  emitMessageEdited(departmentId: string, message: any) {
    this.server.to(`department:${departmentId}`).emit('message:edited', message);
  }

  // Called from service when message is deleted
  emitMessageDeleted(departmentId: string, messageId: string) {
    this.server.to(`department:${departmentId}`).emit('message:deleted', {
      messageId,
    });
  }

  // Called from service when document status changes
  emitDocumentStatus(departmentId: string, document: any) {
    this.server.to(`department:${departmentId}`).emit('document:status', document);
  }
}
