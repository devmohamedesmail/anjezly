import type { Core } from '@strapi/strapi';
import { Server } from 'socket.io';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    try {
      const httpServer = strapi.server.httpServer;
      
      if (!httpServer) {
        console.warn('HTTP server not available, skipping Socket.IO initialization');
        return;
      }

      const io = new Server(httpServer, {
        cors: {
          origin: process.env.NODE_ENV === 'production' 
            ? ['https://yourdomain.com'] 
            : ['http://localhost:3000', 'http://localhost:3001'],
          methods: ["GET", "POST"],
          credentials: true
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000
      });

      // Store io instance in strapi for global access
      Object.defineProperty(strapi, 'io', {
        value: io,
        writable: false,
        enumerable: true,
        configurable: false
      });

      // Store connected users
      const connectedUsers = new Map();

      // Middleware for authentication
      io.use(async (socket, next) => {
        try {
          const token = socket.handshake.auth.token;
          if (!token) {
            return next(new Error('Authentication error: No token provided'));
          }

          // Verify JWT token
          const decoded = await strapi.plugins['users-permissions'].services.jwt.verify(token);
          const user = await strapi.entityService.findOne('plugin::users-permissions.user', decoded.id);
          
          if (!user) {
            return next(new Error('Authentication error: User not found'));
          }

          socket.userId = user.id;
          socket.user = user;
          next();
        } catch (error) {
          next(new Error('Authentication error: Invalid token'));
        }
      });

      io.on('connection', (socket) => {
        console.log(`User ${socket.user.username} connected:`, socket.id);
        
        // Store user connection
        connectedUsers.set(socket.userId, {
          socketId: socket.id,
          user: socket.user,
          lastSeen: new Date()
        });

        // Join user to their personal room
        socket.join(`user_${socket.userId}`);

        // Emit user online status
        socket.broadcast.emit('user-online', {
          userId: socket.userId,
          username: socket.user.username
        });

        // Handle joining conversation rooms
        socket.on('join-conversation', async (conversationId) => {
          try {
            // Verify user is part of this conversation
            const conversation = await strapi.entityService.findOne('api::conversation.conversation', conversationId, {
              populate: ['participants']
            });

            if (!conversation) {
              socket.emit('error', { message: 'Conversation not found' });
              return;
            }

            const isParticipant = conversation.participants.some(p => p.id === socket.userId);
            if (!isParticipant) {
              socket.emit('error', { message: 'Not authorized to join this conversation' });
              return;
            }

            socket.join(`conversation_${conversationId}`);
            console.log(`User ${socket.userId} joined conversation ${conversationId}`);
            
            // Notify other participants
            socket.to(`conversation_${conversationId}`).emit('user-joined-conversation', {
              userId: socket.userId,
              username: socket.user.username,
              conversationId
            });

          } catch (error) {
            console.error('Error joining conversation:', error);
            socket.emit('error', { message: 'Failed to join conversation' });
          }
        });

        // Handle leaving conversation rooms
        socket.on('leave-conversation', (conversationId) => {
          socket.leave(`conversation_${conversationId}`);
          console.log(`User ${socket.userId} left conversation ${conversationId}`);
          
          // Notify other participants
          socket.to(`conversation_${conversationId}`).emit('user-left-conversation', {
            userId: socket.userId,
            username: socket.user.username,
            conversationId
          });
        });

        // Handle sending messages
        socket.on('send-message', async (data) => {
          try {
            const { conversationId, content, messageType = 'text', attachments = [] } = data;

            // Validate required fields
            if (!conversationId || !content) {
              socket.emit('error', { message: 'Missing required fields' });
              return;
            }

            // Verify user is part of the conversation
            const conversation = await strapi.entityService.findOne('api::conversation.conversation', conversationId, {
              populate: ['participants']
            });

            if (!conversation) {
              socket.emit('error', { message: 'Conversation not found' });
              return;
            }

            const isParticipant = conversation.participants.some(p => p.id === socket.userId);
            if (!isParticipant) {
              socket.emit('error', { message: 'Not authorized to send message to this conversation' });
              return;
            }

            // Create message in database
            const message = await strapi.entityService.create('api::message.message', {
              data: {
                content,
                messageType,
                attachments,
                sender: socket.userId,
                conversation: conversationId,
                isRead: false,
                sentAt: new Date()
              },
              populate: {
                sender: {
                  fields: ['id', 'username', 'email']
                },
                conversation: true,
                attachments: true
              }
            });

            // Emit to all participants in the conversation
            io.to(`conversation_${conversationId}`).emit('new-message', {
              message,
              conversationId
            });

            // Send push notifications to offline users
            const offlineParticipants = conversation.participants.filter(p => 
              p.id !== socket.userId && !connectedUsers.has(p.id)
            );

            // TODO: Implement push notification service
            if (offlineParticipants.length > 0) {
              console.log('Send push notifications to offline users:', offlineParticipants.map(p => p.id));
            }

            // Update conversation last message
            await strapi.entityService.update('api::conversation.conversation', conversationId, {
              data: {
                lastMessage: message.id,
                lastActivity: new Date()
              }
            });

          } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message' });
          }
        });

        // Handle message read status
        socket.on('mark-message-read', async (messageId) => {
          try {
            const message = await strapi.entityService.findOne('api::message.message', messageId, {
              populate: ['conversation', 'sender']
            });

            if (!message) {
              socket.emit('error', { message: 'Message not found' });
              return;
            }

            // Don't mark own messages as read
            if (message.sender.id === socket.userId) {
              return;
            }

            // Update message read status
            await strapi.entityService.update('api::message.message', messageId, {
              data: { isRead: true, readAt: new Date() }
            });

            // Notify sender that message was read
            io.to(`user_${message.sender.id}`).emit('message-read', {
              messageId,
              readBy: socket.userId,
              readAt: new Date()
            });

          } catch (error) {
            console.error('Error marking message as read:', error);
            socket.emit('error', { message: 'Failed to mark message as read' });
          }
        });

        // Handle typing indicators
        socket.on('typing-start', (conversationId) => {
          socket.to(`conversation_${conversationId}`).emit('user-typing', {
            userId: socket.userId,
            username: socket.user.username,
            conversationId
          });
        });

        socket.on('typing-stop', (conversationId) => {
          socket.to(`conversation_${conversationId}`).emit('user-stopped-typing', {
            userId: socket.userId,
            username: socket.user.username,
            conversationId
          });
        });

        // Handle disconnect
        socket.on('disconnect', (reason) => {
          console.log(`User ${socket.user.username} disconnected:`, socket.id, 'Reason:', reason);
          
          // Remove from connected users
          connectedUsers.delete(socket.userId);
          
          // Emit user offline status
          socket.broadcast.emit('user-offline', {
            userId: socket.userId,
            username: socket.user.username,
            lastSeen: new Date()
          });

          // Update user last seen
          strapi.entityService.update('plugin::users-permissions.user', socket.userId, {
            data: { lastSeen: new Date() }
          }).catch(err => console.error('Error updating last seen:', err));
        });

        // Handle errors
        socket.on('error', (error) => {
          console.error('Socket error for user', socket.userId, ':', error);
        });
      });

      // Global error handler
      io.on('error', (error) => {
        console.error('Socket.IO server error:', error);
      });

      console.log('Socket.IO server initialized successfully for messaging');
    } catch (error) {
      console.error('Failed to initialize Socket.IO:', error);
    }
  },
};
