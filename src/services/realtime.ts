import { API_BASE_URL, notificationsApi } from './apiClient';

type Handler = (data: unknown) => void;

/**
 * Server-Sent Events connection. Each (re)connect fetches a fresh one-time ticket, because the
 * browser's built-in EventSource retry would reuse a spent one. Reconnects with backoff and
 * when the tab becomes visible again (phones suspend background connections).
 */
export class RealtimeConnection {
  private source: EventSource | null = null;
  private closed = false;
  private retryMs = 1000;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private handlers: Record<string, Handler>,
    private onConnected: () => void = () => undefined
  ) {
    document.addEventListener('visibilitychange', this.onVisible);
  }

  private onVisible = () => {
    if (document.visibilityState === 'visible' && (!this.source || this.source.readyState === EventSource.CLOSED)) {
      this.retryMs = 1000;
      this.connect();
    }
  };

  async connect() {
    if (this.closed || typeof EventSource === 'undefined') return;
    if (this.timer) clearTimeout(this.timer);
    this.source?.close();
    try {
      const { ticket } = await notificationsApi.eventTicket();
      if (this.closed) return;
      const source = new EventSource(`${API_BASE_URL}/events/stream?ticket=${encodeURIComponent(ticket)}`);
      this.source = source;
      source.addEventListener('ready', () => {
        this.retryMs = 1000;
        this.onConnected();
      });
      for (const [event, handler] of Object.entries(this.handlers)) {
        source.addEventListener(event, e => {
          try {
            handler(JSON.parse((e as MessageEvent).data));
          } catch {
            // ignore malformed events
          }
        });
      }
      source.onerror = () => {
        source.close();
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
    this.timer = setTimeout(() => this.connect(), this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, 30000);
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.source?.close();
    document.removeEventListener('visibilitychange', this.onVisible);
  }
}
