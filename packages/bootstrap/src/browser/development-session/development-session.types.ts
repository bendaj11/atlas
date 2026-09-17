export interface DevelopmentSessionBridgeDependencies {
  document: Pick<Document, 'querySelector'>;
  window: Pick<
    Window,
    'addEventListener' | 'removeEventListener' | 'postMessage'
  >;
  origin: string;
  requestId(): string;
  scheduleTimeout(operation: () => void, milliseconds: number): number;
  clearScheduledTimeout(timeout: number): void;
}
