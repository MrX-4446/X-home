import { registerPlugin } from '@capacitor/core';
import type { FloatOverlayPlugin } from './definitions';

const FloatOverlay = registerPlugin<FloatOverlayPlugin>('FloatOverlay');

export * from './definitions';
export { FloatOverlay };
