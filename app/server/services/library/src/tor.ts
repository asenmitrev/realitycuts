// TODO: Tor/proxy support — currently disabled in ytdlp.ts.
// This file is kept for future use. To re-enable, uncomment the import in ytdlp.ts
// and restore the Tor → DataImpulse proxy → SmartProxy fallback chain.
import { spawn } from 'child_process';
import { logger } from '../../../services/logging';

export function runTorProcess() {
  return new Promise<{ killServices: () => Promise<void> }>((resolve, reject) => {
    let torProcess: any;
    let privoxyProcess: any;
    let torReady = false;
    let privoxyReady = false;
    let isResolved = false;
    const killPromise = () =>
      new Promise<void>((resolve, reject) => {
        let torKilled = false;
        let privoxyKilled = false;

        const checkComplete = () => {
          if (torKilled && privoxyKilled) resolve();
        };

        torProcess.on('close', () => {
          torKilled = true;
          checkComplete();
        });

        privoxyProcess?.on('close', () => {
          privoxyKilled = true;
          checkComplete();
        });

        torProcess.kill();
        privoxyProcess?.kill();

        setTimeout(() => reject(new Error('Timeout killing services')), 30000);
      });

    const killServices = () => {
      logger.info('Killing proxy services...');
      return killPromise();
    };

    // Start Tor first
    torProcess = spawn('tor', []);

    torProcess.stdout.on('data', (data: any) => {
      logger.debug(`Tor stdout: ${data}`);
      if (data.includes('Done')) {
        torReady = true;
        // Only start Privoxy after Tor is ready
        privoxyProcess = spawn('privoxy', ['--no-daemon', '/etc/privoxy/config']);

        privoxyProcess.stdout.on('data', (data: any) => {
          logger.debug(`Privoxy stdout: ${data}`);
          privoxyReady = true;
          if (!isResolved) {
            isResolved = true;
            resolve({ killServices });
          }
        });

        privoxyProcess.stderr.on('data', (data: any) => {
          if (data.includes('Program name: privoxy')) {
            privoxyReady = true;
            if (!isResolved) {
              isResolved = true;
              resolve({ killServices });
            }
          }
          logger.debug(`Privoxy stderr: ${data}`);
        });

        privoxyProcess.on('close', async () => {
          if (!privoxyReady) {
            await killServices();
            reject(new Error('Privoxy died before initialization'));
          }
        });
      }
    });

    torProcess.stderr.on('data', (data: any) => {
      logger.error(`Tor stderr: ${data}`);
    });

    torProcess.on('close', async () => {
      if (!torReady) {
        await killServices();
        reject(new Error('Tor died before initialization'));
      }
    });
  });
}
