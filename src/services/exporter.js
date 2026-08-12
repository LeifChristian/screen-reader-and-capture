import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { formatTimestamp } from '../lib/utils.js';

export class SessionExporter {
  constructor({ logger = console } = {}) {
    this.logger = logger;
  }

  async export({ descriptionsPath, screenshotsDir }, includeScreenshots = false, exportPath = null) {
    if (!descriptionsPath || !fs.existsSync(descriptionsPath)) {
      throw new Error('No descriptions file found');
    }

    const timestamp = formatTimestamp();
    const basePath = exportPath || path.join(process.cwd(), `session_export_${timestamp}`);

    if (includeScreenshots) {
      return this.#exportZip(basePath, descriptionsPath, screenshotsDir);
    }

    return this.#exportText(basePath, descriptionsPath);
  }

  #exportText(basePath, descriptionsPath) {
    const textPath = `${basePath}_descriptions.txt`;
    fs.copyFileSync(descriptionsPath, textPath);
    this.logger.info(`Descriptions exported to: ${textPath}`);
    return textPath;
  }

  async #exportZip(basePath, descriptionsPath, screenshotsDir) {
    const zipPath = `${basePath}.zip`;
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        this.logger.info(`Session exported to: ${zipPath} (${archive.pointer()} bytes)`);
        resolve(zipPath);
      });

      archive.on('error', (err) => reject(err));
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          this.logger.warn(`Archive warning: ${err.message}`);
        } else {
          reject(err);
        }
      });

      archive.pipe(output);
      archive.file(descriptionsPath, { name: 'descriptions.txt' });

      if (screenshotsDir && fs.existsSync(screenshotsDir)) {
        const screenshots = fs.readdirSync(screenshotsDir);
        for (const filename of screenshots) {
          const filePath = path.join(screenshotsDir, filename);
          archive.file(filePath, { name: `screenshots/${filename}` });
        }
      }

      archive.finalize();
    });
  }
}
