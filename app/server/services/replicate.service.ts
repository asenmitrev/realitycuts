import retry from 'retry';
import { replicateClient } from './ai/replicate';
import { logger } from './logging';
import { type Prediction, type FileOutput } from 'replicate';

export interface FluxPredictionInput {
  prompt: string;
  aspect_ratio?: string;
  input_images?: string[];
  output_format?: 'jpg' | 'png' | 'webp';
  num_outputs?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
}

/**
 * Run a Flux prediction using Replicate with exponential backoff retry logic
 * @param input - The input parameters for the Flux model
 * @returns The prediction output with URL
 */
export const runFluxPrediction = async (input: FluxPredictionInput): Promise<FileOutput> => {
  const operation = retry.operation({
    retries: 3,
    factor: 2,
    minTimeout: 5000,
    maxTimeout: 60000
  });

  return new Promise<FileOutput>((resolve, reject) => {
    operation.attempt(async currentAttempt => {
      try {
        logger.info('Starting Flux prediction', { input, attempt: currentAttempt });

        const output = (await replicateClient.run('black-forest-labs/flux-2-dev', {
          input: {
            prompt: input.prompt,
            aspect_ratio: input.aspect_ratio || 'match_input_image',
            input_images: input.input_images || [],
            output_format: input.output_format || 'png',
            ...(input.num_outputs && { num_outputs: input.num_outputs }),
            ...(input.guidance_scale && { guidance_scale: input.guidance_scale }),
            ...(input.num_inference_steps && { num_inference_steps: input.num_inference_steps })
          }
        })) as FileOutput;

        logger.info('Flux prediction completed', { outputUrl: output.url(), attempt: currentAttempt });

        resolve(output);
      } catch (error: any) {
        if (operation.retry(error as Error)) {
          logger.info('Retrying Flux prediction', {
            issue: error.toString().replaceAll(/error/gi, 'issue'),
            input,
            attempt: currentAttempt
          });
          return;
        }

        logger.error('Error running Flux prediction after all retries', {
          error: error,
          errorMessage: (error as Error)?.message,
          input,
          totalAttempts: currentAttempt
        });
        reject(operation.mainError());
      }
    });
  });
};

/**
 * Run a Flux prediction and get the URL directly
 * @param input - The input parameters for the Flux model
 * @returns The URL of the generated image
 */
export const runFluxPredictionUrl = async (input: FluxPredictionInput): Promise<FileOutput> => {
  return await runFluxPrediction(input);
};
