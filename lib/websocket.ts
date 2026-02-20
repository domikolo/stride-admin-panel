/**
 * WebSocket client for live conversations.
 * Connects to WebSocket API Gateway, handles reconnection, and dispatches events.
 */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || '';

export type WSEventType =
  | 'session_messages'
  | 'new_message'
  | 'session_update'
  | 'takeover_started'
  | 'takeover_ended'
  | 'message_sent'
  | 'error';

export interface WSEvent {
  type: WSEventType;
  sessionId?: string;
  message?: {
    role: string;
    text: string;
    timestamp: number;
    sentBy?: string;
    conversationNumber: number;
  };
  messages?: Array<{
    role: string;
    text: string;
    timestamp: number;
    sentBy?: string;
    conversationNumber: number;
  }>;
  takenOverBy?: string | null;
  lastActivity?: number;
  error?: string;
}

type EventHandler = (event: WSEvent) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private token: string = '';
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _isConnected = false;

  get isConnected() {
    return this._isConnected;
  }

  connect(token: string) {
    if (!WS_URL) {
      console.warn('[WS] No WS_URL configured');
      return;
    }
    this.token = token;
    this._connect();
  }

  private _connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const url = `${WS_URL}?token=${this.token}`;
    console.log('[WS] Connecting...');

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      console.error('[WS] Failed to create WebSocket:', e);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this._isConnected = true;
      this.reconnectAttempts = 0;
      this._emit({ type: 'session_update' } as WSEvent);
    };

    this.ws.onmessage = (event) => {
      try {
        const data: WSEvent = JSON.parse(event.data);
        this._emit(data);
      } catch (e) {
        console.error('[WS] Failed to parse message:', e);
      }
    };

    this.ws.onclose = (event) => {
      console.log('[WS] Disconnected:', event.code, event.reason);
      this._isConnected = false;
      this._emit({ type: 'session_update' } as WSEvent);
      if (event.code !== 1000) {
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // prevent reconnect
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
    this._isConnected = false;
  }

  private _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS] Max reconnect attempts reached');
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this._connect();
    }, delay);
  }

  private _send(data: Record<string, unknown>) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Not connected, cannot send');
      return;
    }
    this.ws.send(JSON.stringify(data));
  }

  // ─── Actions ──────────────────────────────────────────────────

  subscribe(sessionId: string, conversationNumber?: number) {
    this._send({
      action: 'subscribe_session',
      sessionId,
      ...(conversationNumber && { conversationNumber }),
    });
  }

  unsubscribe() {
    this._send({ action: 'unsubscribe_session' });
  }

  takeover(sessionId: string) {
    this._send({ action: 'takeover', sessionId });
  }

  release(sessionId: string) {
    this._send({ action: 'release', sessionId });
  }

  sendMessage(sessionId: string, text: string, conversationNumber: number) {
    this._send({
      action: 'send_message',
      sessionId,
      text,
      conversationNumber,
    });
  }

  // ─── Event handling ───────────────────────────────────────────

  on(eventType: string, handler: EventHandler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  private _emit(event: WSEvent) {
    // Emit to specific type handlers
    this.handlers.get(event.type)?.forEach((h) => h(event));
    // Emit to wildcard handlers
    this.handlers.get('*')?.forEach((h) => h(event));
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();
