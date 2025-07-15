/**
 * message router
 */

import { factories } from '@strapi/strapi';

const customRoutes = {
  routes: [
    {
      method: 'GET',
      path: '/messages/conversation/:conversationId',
      handler: 'message.findByConversation',
      config: {
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'POST',
      path: '/messages/send',
      handler: 'message.sendMessage',
      config: {
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'POST',
      path: '/messages/mark-read',
      handler: 'message.markAsRead',
      config: {
        policies: [],
        middlewares: [],
      }
    }
  ]
};

export default customRoutes;
