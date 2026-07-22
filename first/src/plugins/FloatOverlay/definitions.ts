export interface FloatOverlayPlugin {
  show(): Promise<void>;
  hide(): Promise<void>;
  toggle(): Promise<void>;
  isVisible(): Promise<{ visible: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  setPosition(options: { x: number; y: number }): Promise<void>;
  setSize(options: { width: number; height: number }): Promise<void>;
  startOcr(): Promise<{ success: boolean; text?: string; message?: string }>;
  startScrollCapture(): Promise<{ success: boolean; text?: string; message?: string }>;
}
