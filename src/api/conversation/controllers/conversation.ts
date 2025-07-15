/**
 * conversation controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::conversation.conversation', ({ strapi }) => ({
  
  // Create a new conversation
  async create(ctx) {
    try {
      const { participantIds, title, type = 'direct' } = ctx.request.body;
      const userId = ctx.state.user.id;

      if (!participantIds || !Array.isArray(participantIds)) {
        return ctx.throw(400, 'Participant IDs are required');
      }

      // Add current user to participants if not included
      const allParticipants = [...new Set([userId, ...participantIds])];

      // For direct conversations, ensure only 2 participants
      if (type === 'direct' && allParticipants.length !== 2) {
        return ctx.throw(400, 'Direct conversations must have exactly 2 participants');
      }

      // Check if direct conversation already exists
      if (type === 'direct') {
        const existingConversation = await strapi.entityService.findMany('api::conversation.conversation', {
          filters: {
            type: 'direct',
            participants: {
              id: { $in: allParticipants }
            }
          },
          populate: ['participants']
        });

        // Find conversation with exact same participants
        const exactMatch = existingConversation.find(conv => 
          conv.participants.length === 2 && 
          conv.participants.every(p => allParticipants.includes(p.id))
        );

        if (exactMatch) {
          return ctx.body = { data: exactMatch };
        }
      }

      // Create new conversation
      const conversation = await strapi.entityService.create('api::conversation.conversation', {
        data: {
          title,
          type,
          participants: allParticipants,
          createdBy: userId,
          lastActivity: new Date(),
          isActive: true
        },
        populate: {
          participants: {
            fields: ['id', 'username', 'email']
          },
          lastMessage: true
        }
      });

      ctx.body = { data: conversation };

    } catch (error) {
      console.error('Error creating conversation:', error);
      ctx.throw(500, 'Failed to create conversation');
    }
  },

  // Get user's conversations
  async findUserConversations(ctx) {
    try {
      const userId = ctx.state.user.id;
      const { page = 1, pageSize = 20 } = ctx.query;
      const pageNum = parseInt(page as string);
      const pageSizeNum = parseInt(pageSize as string);

      const conversations = await strapi.entityService.findMany('api::conversation.conversation', {
        filters: {
          participants: {
            id: userId
          },
          isActive: true
        },
        populate: {
          participants: {
            fields: ['id', 'username', 'email']
          },
          lastMessage: {
            populate: {
              sender: {
                fields: ['id', 'username']
              }
            }
          }
        },
        sort: { lastActivity: 'desc' },
        start: (pageNum - 1) * pageSizeNum,
        limit: pageSizeNum
      });

      // Get total count
      const total = await strapi.entityService.count('api::conversation.conversation', {
        filters: {
          participants: {
            id: userId
          },
          isActive: true
        }
      });

      ctx.body = {
        data: conversations,
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
      console.error('Error fetching conversations:', error);
      ctx.throw(500, 'Failed to fetch conversations');
    }
  },

  // Add participant to conversation
  async addParticipant(ctx) {
    try {
      const { id } = ctx.params;
      const { participantId } = ctx.request.body;
      const userId = ctx.state.user.id;

      if (!participantId) {
        return ctx.throw(400, 'Participant ID is required');
      }

      const conversation = await strapi.entityService.findOne('api::conversation.conversation', id, {
        populate: ['participants']
      });

      if (!conversation) {
        return ctx.throw(404, 'Conversation not found');
      }

      // Check if user is participant
      const isParticipant = conversation.participants.some(p => p.id === userId);
      if (!isParticipant) {
        return ctx.throw(403, 'Not authorized to modify this conversation');
      }

      // Check if it's a direct conversation
      if (conversation.type === 'direct') {
        return ctx.throw(400, 'Cannot add participants to direct conversations');
      }

      // Check if participant is already in conversation
      const isAlreadyParticipant = conversation.participants.some(p => p.id === participantId);
      if (isAlreadyParticipant) {
        return ctx.throw(400, 'User is already a participant');
      }

      // Add participant
      const updatedConversation = await strapi.entityService.update('api::conversation.conversation', id, {
        data: {
          participants: {
            connect: [participantId]
          }
        } as any,
        populate: {
          participants: {
            fields: ['id', 'username', 'email']
          }
        }
      });

      // Emit Socket.IO event if available
      if ((strapi as any).io) {
        (strapi as any).io.to(`conversation_${id}`).emit('participant-added', {
          conversationId: id,
          newParticipant: participantId,
          addedBy: userId
        });
      }

      ctx.body = { data: updatedConversation };

    } catch (error) {
      console.error('Error adding participant:', error);
      ctx.throw(500, 'Failed to add participant');
    }
  }
}));
