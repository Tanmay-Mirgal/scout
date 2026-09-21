import { EventEmitter } from "events";

export interface AgentStreamEvent {
  type:
    | "CONNECTED"
    | "SESSION_STARTED"
    | "TASK_STARTED"
    | "TASK_COMPLETED"
    | "TASK_FAILED"
    | "AGENT_STARTED"
    | "AGENT_PROGRESS"
    | "AGENT_COMPLETED"
    | "AGENT_FAILED"
    | "SESSION_COMPLETED"
    | "HEARTBEAT";
  sessionId: string;
  taskId?: string;
  agentType?: string;
  timestamp: string;
  payload?: any;
}

export type AgentStreamListener = (event: AgentStreamEvent) => void;

/**
 * Event Stream Service managing real-time event publishing and subscriber multiplexing
 * for research sessions.
 */
export class AgentStreamService {
  private static emitter = new EventEmitter();

  static {
    // Increase max listeners limit to prevent memory leak warnings when multiple clients connect
    this.emitter.setMaxListeners(100);
  }

  /**
   * Publishes an agent stream event to all subscribed listeners for a session.
   */
  public static publish(event: Omit<AgentStreamEvent, "timestamp"> & { timestamp?: string }): void {
    const fullEvent: AgentStreamEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    const channelName = this.getChannel(fullEvent.sessionId);
    this.emitter.emit(channelName, fullEvent);
  }

  /**
   * Subscribes a client listener function to events for a specific research session.
   */
  public static subscribe(sessionId: string, listener: AgentStreamListener): void {
    const channelName = this.getChannel(sessionId);
    this.emitter.on(channelName, listener);
  }

  /**
   * Unsubscribes a client listener function when SSE client disconnects.
   */
  public static unsubscribe(sessionId: string, listener: AgentStreamListener): void {
    const channelName = this.getChannel(sessionId);
    this.emitter.off(channelName, listener);
  }

  /**
   * Returns active listener count for a research session stream.
   */
  public static getListenerCount(sessionId: string): number {
    return this.emitter.listenerCount(this.getChannel(sessionId));
  }

  private static getChannel(sessionId: string): string {
    return `session:${sessionId}:events`;
  }
}
