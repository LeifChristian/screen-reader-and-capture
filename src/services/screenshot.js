import screenshot from 'screenshot-desktop';

export class ScreenshotService {
  async capture() {
    try {
      return await screenshot({ format: 'png' });
    } catch (error) {
      throw new Error(`Screenshot failed: ${error.message}`);
    }
  }
}
