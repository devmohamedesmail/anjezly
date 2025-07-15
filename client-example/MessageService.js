// Client-side Socket.IO implementation for messaging
// This is an example of how to use the Socket.IO messaging system from your frontend

import { io } from 'socket.io-client';

class MessageService {
  constructor(token, serverUrl = 'http://localhost:1337') {
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Message events
    this.socket.on('new-message', (data) => {
      console.log('New message received:', data);
      this.handleNewMessage(data);
    });

    this.socket.on('message-read', (data) => {
      console.log('Message read:', data);
      this.handleMessageRead(data);
    });

    // User status events
    this.socket.on('user-online', (data) => {
      console.log('User came online:', data);
      this.updateUserStatus(data.userId, 'online');
    });

    this.socket.on('user-offline', (data) => {
      console.log('User went offline:', data);
      this.updateUserStatus(data.userId, 'offline', data.lastSeen);
    });

    // Typing events
    this.socket.on('user-typing', (data) => {
      console.log('User typing:', data);
      this.showTypingIndicator(data);
    });

    this.socket.on('user-stopped-typing', (data) => {
      console.log('User stopped typing:', data);
      this.hideTypingIndicator(data);
    });

    // Conversation events
    this.socket.on('user-joined-conversation', (data) => {
      console.log('User joined conversation:', data);
      this.handleUserJoinedConversation(data);
    });

    this.socket.on('user-left-conversation', (data) => {
      console.log('User left conversation:', data);
      this.handleUserLeftConversation(data);
    });

    this.socket.on('participant-added', (data) => {
      console.log('Participant added:', data);
      this.handleParticipantAdded(data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  // Join a conversation
  joinConversation(conversationId) {
    this.socket.emit('join-conversation', conversationId);
  }

  // Leave a conversation
  leaveConversation(conversationId) {
    this.socket.emit('leave-conversation', conversationId);
  }

  // Send a message
  sendMessage(conversationId, content, messageType = 'text', attachments = []) {
    this.socket.emit('send-message', {
      conversationId,
      content,
      messageType,
      attachments
    });
  }

  // Mark message as read
  markMessageAsRead(messageId) {
    this.socket.emit('mark-message-read', messageId);
  }

  // Typing indicators
  startTyping(conversationId) {
    this.socket.emit('typing-start', conversationId);
  }

  stopTyping(conversationId) {
    this.socket.emit('typing-stop', conversationId);
  }

  // Event handlers (implement these based on your UI framework)
  handleNewMessage(data) {
    // Update your message list UI
    // Play notification sound
    // Update conversation list
    // Example:
    // this.updateMessageList(data.conversationId, data.message);
    // this.playNotificationSound();
    // this.updateConversationList(data.conversationId, data.message);
  }

  handleMessageRead(data) {
    // Update message read status in UI
    // Show read receipts
    // Example:
    // this.updateMessageReadStatus(data.messageId, data.readBy, data.readAt);
  }

  updateUserStatus(userId, status, lastSeen = null) {
    // Update user online/offline status in UI
    // Example:
    // this.updateUserBadge(userId, status);
    // if (status === 'offline' && lastSeen) {
    //   this.updateLastSeen(userId, lastSeen);
    // }
  }

  showTypingIndicator(data) {
    // Show typing indicator in conversation
    // Example:
    // this.displayTypingIndicator(data.conversationId, data.username);
  }

  hideTypingIndicator(data) {
    // Hide typing indicator in conversation
    // Example:
    // this.hideTypingIndicator(data.conversationId, data.userId);
  }

  handleUserJoinedConversation(data) {
    // Handle user joining conversation
    // Example:
    // this.addParticipantToConversation(data.conversationId, data.userId);
  }

  handleUserLeftConversation(data) {
    // Handle user leaving conversation
    // Example:
    // this.removeParticipantFromConversation(data.conversationId, data.userId);
  }

  handleParticipantAdded(data) {
    // Handle new participant added to conversation
    // Example:
    // this.refreshConversationParticipants(data.conversationId);
  }

  // Disconnect
  disconnect() {
    this.socket.disconnect();
  }
}

// Usage Example:
/*
// Initialize the service with JWT token
const messageService = new MessageService('your-jwt-token-here');

// Join a conversation when user opens it
messageService.joinConversation(123);

// Send a message
messageService.sendMessage(123, 'Hello world!');

// Start typing indicator
messageService.startTyping(123);

// Stop typing after user stops typing (with debounce)
let typingTimeout;
const handleTyping = () => {
  messageService.startTyping(123);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    messageService.stopTyping(123);
  }, 3000);
};

// Leave conversation when user navigates away
messageService.leaveConversation(123);

// Disconnect when app closes
window.addEventListener('beforeunload', () => {
  messageService.disconnect();
});
*/

export default MessageService;
