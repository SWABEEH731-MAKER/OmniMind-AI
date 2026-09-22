import { Message, Collaborator } from '../types';

export interface CollabUser {
  id: string;
  name: string;
  avatarColor: string;
}

const AVATAR_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
];

export function getLocalCollabUser(currentUserName?: string): CollabUser {
  const saved = localStorage.getItem('omnimind_collab_user');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (currentUserName && currentUserName !== parsed.name) {
        parsed.name = currentUserName;
        localStorage.setItem('omnimind_collab_user', JSON.stringify(parsed));
      }
      return parsed;
    } catch (e) {
      // ignore
    }
  }

  const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const randomNum = Math.floor(100 + Math.random() * 900);
  const newUser: CollabUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: currentUserName || `Collaborator #${randomNum}`,
    avatarColor: randomColor,
  };
  localStorage.setItem('omnimind_collab_user', JSON.stringify(newUser));
  return newUser;
}

export class CollabManager {
  private ws: WebSocket | null = null;
  private currentRoomId: string | null = null;
  private user: CollabUser;
  private isConnected = false;
  private reconnectTimer: any = null;

  public onPresenceUpdate?: (users: Collaborator[]) => void;
  public onNewMessage?: (message: Message, sender: { id: string; name: string }) => void;
  public onUserTyping?: (typingUsers: { id: string; name: string }[]) => void;
  public onStatusChange?: (connected: boolean) => void;

  private typingMap = new Map<string, { name: string; timeout: any }>();

  constructor(user?: CollabUser) {
    this.user = user || getLocalCollabUser();
  }

  public setUser(user: CollabUser) {
    this.user = user;
    if (this.currentRoomId && this.isConnected) {
      this.send({
        type: 'join',
        roomId: this.currentRoomId,
        userId: this.user.id,
        userName: this.user.name,
        avatarColor: this.user.avatarColor,
      });
    }
  }

  public getUser(): CollabUser {
    return this.user;
  }

  public getRoomId(): string | null {
    return this.currentRoomId;
  }

  public joinRoom(roomId: string) {
    this.currentRoomId = roomId;
    this.connect();
  }

  public leaveRoom() {
    if (this.ws && this.isConnected) {
      this.send({ type: 'leave' });
    }
    this.currentRoomId = null;
    this.disconnect();
  }

  public broadcastMessage(message: Message) {
    if (!this.isConnected || !this.currentRoomId) return;
    this.send({
      type: 'new-message',
      roomId: this.currentRoomId,
      message,
    });
  }

  public sendTypingStatus(isTyping: boolean) {
    if (!this.isConnected || !this.currentRoomId) return;
    this.send({
      type: 'typing',
      roomId: this.currentRoomId,
      isTyping,
    });
  }

  private connect() {
    if (this.ws) {
      this.disconnect();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/collab`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.onStatusChange?.(true);

        if (this.currentRoomId) {
          this.send({
            type: 'join',
            roomId: this.currentRoomId,
            userId: this.user.id,
            userName: this.user.name,
            avatarColor: this.user.avatarColor,
          });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'presence') {
            const list: Collaborator[] = (data.users || []).map((u: any) => ({
              id: u.id,
              name: u.name,
              avatarColor: u.avatarColor || '#6366f1',
              lastActive: Date.now(),
            }));
            this.onPresenceUpdate?.(list);
          } else if (data.type === 'new-message') {
            this.onNewMessage?.(data.message, data.sender);
          } else if (data.type === 'typing') {
            const { userId, userName, isTyping } = data;
            if (isTyping) {
              if (this.typingMap.has(userId)) {
                clearTimeout(this.typingMap.get(userId)!.timeout);
              }
              const timeout = setTimeout(() => {
                this.typingMap.delete(userId);
                this.emitTypingList();
              }, 3000);
              this.typingMap.set(userId, { name: userName, timeout });
            } else {
              if (this.typingMap.has(userId)) {
                clearTimeout(this.typingMap.get(userId)!.timeout);
                this.typingMap.delete(userId);
              }
            }
            this.emitTypingList();
          }
        } catch (err) {
          console.error('Error handling websocket message:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.onStatusChange?.(false);
        // Auto-reconnect if room is still set
        if (this.currentRoomId) {
          this.reconnectTimer = setTimeout(() => {
            this.connect();
          }, 3000);
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (e) {
      console.error('Failed to initialize WebSocket:', e);
    }
  }

  private emitTypingList() {
    const list = Array.from(this.typingMap.entries()).map(([id, info]) => ({
      id,
      name: info.name,
    }));
    this.onUserTyping?.(list);
  }

  private send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.onStatusChange?.(false);
  }
}
