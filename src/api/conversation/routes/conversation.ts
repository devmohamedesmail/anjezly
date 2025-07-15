/**
 * conversation router
 */

import { factories } from '@strapi/strapi';

const customRoutes = {
  routes: [
    {
      method: 'GET',
      path: '/conversations/my',
      handler: 'conversation.findUserConversations',
      config: {
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'POST',
      path: '/conversations/:id/participants',
      handler: 'conversation.addParticipant',
      config: {
        policies: [],
        middlewares: [],
      }
    }
  ]
};

export default customRoutes;
