import type { FloatOverlayPlugin } from './definitions';

export class FloatOverlayWeb implements FloatOverlayPlugin {
  async show(): Promise<void> {
    console.log('FloatOverlay show - web mode');
  }

  async hide(): Promise<void> {
    console.log('FloatOverlay hide - web mode');
  }

  async toggle(): Promise<void> {
    console.log('FloatOverlay toggle - web mode');
  }

  async isVisible(): Promise<{ visible: boolean }> {
    return { visible: false };
  }

  async requestPermission(): Promise<{ granted: boolean }> {
    return { granted: true };
  }

  async setPosition(options: { x: number; y: number }): Promise<void> {
    console.log('FloatOverlay setPosition - web mode', options);
  }

  async setSize(options: { width: number; height: number }): Promise<void> {
    console.log('FloatOverlay setSize - web mode', options);
  }

  async startOcr(): Promise<{ success: boolean; text?: string; message?: string }> {
    console.log('FloatOverlay startOcr - web mode');
    return { success: false, message: 'OCR功能仅在Android原生环境支持' };
  }

  async startScrollCapture(): Promise<{ success: boolean; text?: string; message?: string }> {
    console.log('FloatOverlay startScrollCapture - web mode');
    return { success: false, message: '滚动截图功能仅在Android原生环境支持' };
  }
}
