import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

/**
 * Realtime in-app notifications over WebSocket.
 *
 * Web (Flutter web) da FCM background/foreground ishonchli ishlamaydi, shuning
 * uchun app OCHIQ bo'lganda notification'lar shu socket orqali yetkaziladi —
 * FCM'ga umuman bog'liq emas.
 *
 * Client tomon (ulanish):
 *   const socket = io('https://jr-techno.uz/notifications', {
 *     auth: { token: <accessToken> },   // yoki Authorization: Bearer <token> header
 *     transports: ['websocket'],
 *   });
 *   socket.on('notification:new', (n) => { ... });      // yangi notification
 *   socket.on('notification:unread-count', (c) => {}); // ixtiyoriy badge yangilash
 *
 * Foydalanuvchi ulanishi bilan avtomatik `user:<userId>` xonasiga qo'shiladi —
 * client hech narsa emit qilishi shart emas, faqat tinglaydi.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload: any = this.jwtService.verify(token, {
        secret: this.configService.get('jwt.accessSecret'),
      });

      client.userId = payload.sub;
      client.userRole = payload.systemRole;

      // Har bir foydalanuvchi o'zining shaxsiy xonasiga qo'shiladi.
      // Bir user bir nechta qurilma/tab'dan ulansa — hammasi shu xonada bo'ladi.
      client.join(`user:${client.userId}`);

      client.emit('notification:connected', { userId: client.userId });
      console.log(
        `Notifications socket connected: ${client.id}, User: ${client.userId}`,
      );
    } catch (error) {
      console.log('Notifications socket auth failed:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    console.log(`Notifications socket disconnected: ${client.id}`);
  }

  /**
   * Bitta foydalanuvchining barcha ulangan qurilmalariga event yuborish.
   * NotificationConsumer in-app notification yaratgandan so'ng chaqiradi.
   */
  emitToUser(userId: string, event: string, payload: any) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
