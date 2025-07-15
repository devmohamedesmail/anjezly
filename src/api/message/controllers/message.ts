/**
 * message controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::message.message', ({ strapi }) => ({
  
  // Get messages for a conversation
  async findByConversation(ctx) {
    try {
      const { conversationId } = ctx.params;
      const { page = 1, pageSize = 50 } = ctx.query;
      const pageNum = parseInt(page as string);
      const pageSizeNum = parseInt(pageSize as string);

      // Verify user is part of the conversation
      const conversation = await strapi.entityService.findOne('api::conversation.conversation', conversationId, {
        populate: ['participants']
      });

      if (!conversation) {
        return ctx.throw(404, 'Conversation not found');
      }

      const isParticipant = conversation.participants.some(p => p.id === ctx.state.user.id);
      if (!isParticipant) {
        return ctx.throw(403, 'Not authorized to view messages in this conversation');
      }

      // Get messages with pagination
      const messages = await strapi.entityService.findMany('api::message.message', {
        filters: {
          conversation: conversationId
        },
        populate: {
          sender: {
            fields: ['id', 'username', 'email']
          },
          attachments: true
        },
        sort: { createdAt: 'desc' },
        start: (pageNum - 1) * pageSizeNum,
        limit: pageSizeNum
      });

      // Get total count
      const total = await strapi.entityService.count('api::message.message', {
        filters: {
          conversation: conversationId
        }
      });

      ctx.body = {
        data: messages.reverse(), // Reverse to show oldest first
        meta: {
          pagination: {
            page: pageNum,
            pageSize: pageSizeNum,
            total,
            pageCount: Math.ceil(total / pageSizeNum)
          }
        }
      };

    } catch (error) {
      console.error('Error fetching messages:', error);
      ctx.throw(500, 'Failed to fetch messages');
    }
  },

  // Send message via HTTP (fallback)
  async sendMessage(ctx) {
    try {
      const { conversationId, content, messageType = 'text', attachments = [] } = ctx.request.body;
      const userId = ctx.state.user.id;

      if (!conversationId || !content) {
        return ctx.throw(400, 'Missing required fields');
      }

      // Verify user is part of the conversation
      const conversation = await strapi.entityService.findOne('api::conversation.conversation', conversationId, {
        populate: ['participants']
      });

      if (!conversation) {
        return ctx.throw(404, 'Conversation not found');
      }

      const isParticipant = conversation.participants.some(p => p.id === userId);
      if (!isParticipant) {
        return ctx.throw(403, 'Not authorized to send message to this conversation');
      }

      // Create message
      const message = await strapi.entityService.create('api::message.message', {
        data: {
          content,
          messageType,
          attachments,
          sender: userId,
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

      // Emit via Socket.IO if available
      if ((strapi as any).io) {
        (strapi as any).io.to(`conversation_${conversationId}`).emit('new-message', {
          message,
          conversationId
        });
      }

      // Update conversation
      await strapi.entityService.update('api::conversation.conversation', conversationId, {
        data: {
          lastMessage: message.id,
          lastActivity: new Date()
        } as any
      });

      ctx.body = { data: message };

    } catch (error) {
      console.error('Error sending message:', error);
      ctx.throw(500, 'Failed to send message');
    }
  },

  // Mark messages as read
  async markAsRead(ctx) {
    try {
      const { messageIds } = ctx.request.body;
      const userId = ctx.state.user.id;

      if (!messageIds || !Array.isArray(messageIds)) {
        return ctx.throw(400, 'Invalid message IDs');
      }

      // Update messages
      const updatedMessages = await Promise.all(
        messageIds.map(async (messageId) => {
          const message = await strapi.entityService.findOne('api::message.message', messageId, {
            populate: ['sender', 'conversation']
          });

          if (message && message.sender.id !== userId) {
            return await strapi.entityService.update('api::message.message', messageId, {
              data: { isRead: true, readAt: new Date() } as any
            });
          }
          return null;
        })
      );

      // Emit read receipts via Socket.IO
      if ((strapi as any).io) {
        updatedMessages.filter(Boolean).forEach(message => {
          (strapi as any).io.to(`user_${message.sender.id}`).emit('message-read', {
            messageId: message.id,
            readBy: userId,
            readAt: message.readAt
          });
        });
      }

      ctx.body = { success: true };

    } catch (error) {
      console.error('Error marking messages as read:', error);
      ctx.throw(500, 'Failed to mark messages as read');
    }
  }
}));
