import type { Server } from 'socket.io';

declare module '@strapi/strapi' {
  export interface Strapi {
    io?: Server;
    server: {
      httpServer: any;
    };
    plugins: {
      [key: string]: any;
    };
    entityService: any;
  }
}

// Also extend the Core namespace
declare module '@strapi/strapi' {
  namespace Core {
    interface Strapi {
      io?: Server;
      server: {
        httpServer: any;
      };
      plugins: {
        [key: string]: any;
      };
      entityService: any;
    }
  }
}

// Extend Socket.IO types
declare module 'socket.io' {
  interface Socket {
    userId?: number;
    user?: any;
  }
}

export {};