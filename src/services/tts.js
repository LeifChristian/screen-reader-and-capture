import say from 'say';

export class TextToSpeechService {
  constructor({ logger = console } = {}) {
    this.logger = logger;
  }

  speak(text) {
    return new Promise((resolve, reject) => {
      const voice = process.platform === 'win32' ? 'Microsoft Zira Desktop' : null;

      say.speak(text, voice, 1.3, (err) => {
        if (err) {
          this.logger.error(`TTS error: ${err.message}`);
          reject(err);
        } else {
          this.logger.info('TTS playback completed');
          resolve();
        }
      });
    });
  }
}
