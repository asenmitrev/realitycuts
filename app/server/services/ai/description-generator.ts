/**
 * Video description generator — categorizes video frames and generates
 * keyword-rich descriptions using the local LLM's vision capability.
 *
 * Ported from functions/library-item-video-embedding/src/description-generator.agent.ts
 * so the BullMQ worker can generate descriptions without the Lambda.
 *
 * Entirely LangChain — uses HumanMessage / SystemMessage with OpenAI-compatible
 * image_url content parts.
 */

import retry from "retry";
import { getLlm } from "../../config/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { logger } from "../logging";
import { toInternalMediaUrl } from "../../config/storage";

// ---------------------------------------------------------------------------
// Image URL normalization — fetch non-HTTPS URLs and convert to data URLs
// ---------------------------------------------------------------------------

/**
 * Detect image MIME type from magic bytes — don't trust Content-Type headers.
 */
function detectMimeTypeFromBytes(buffer: Buffer): string {
	// JPEG: FF D8 FF
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		return "image/jpeg";
	}
	// PNG: 89 50 4E 47
	if (
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47
	) {
		return "image/png";
	}
	// GIF: 47 49 46 38
	if (
		buffer[0] === 0x47 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x38
	) {
		return "image/gif";
	}
	// WebP: 52 49 46 46 .. 57 65 62 50
	if (
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46 &&
		buffer[8] === 0x57 &&
		buffer[9] === 0x65 &&
		buffer[10] === 0x62 &&
		buffer[11] === 0x50
	) {
		return "image/webp";
	}
	return "image/jpeg"; // fallback
}

/**
 * Normalize an image URL to a value suitable for OpenAI-compatible image_url.
 * HTTPS URLs pass through unchanged; non-HTTPS URLs are fetched and converted
 * to base64 data URLs.
 */
async function normalizeImageUrl(url: string): Promise<string> {
	if (url.startsWith("https://")) {
		return url;
	}

	const response = await fetch(toInternalMediaUrl(url));
	if (!response.ok) {
		throw new Error(
			`Failed to fetch image: ${response.status} ${response.statusText}`,
		);
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	const mimeType = detectMimeTypeFromBytes(buffer);
	const base64 = buffer.toString("base64");
	return `data:${mimeType};base64,${base64}`;
}

// ---------------------------------------------------------------------------
// LLM invocation with retry
// ---------------------------------------------------------------------------

const llm = getLlm();

async function callLlm(messages: (HumanMessage | SystemMessage)[]): Promise<string> {
	const operation = retry.operation({
		retries: 5,
		factor: 2,
		minTimeout: 5000,
		maxTimeout: 60000,
	});

	return new Promise<string>((resolve, reject) => {
		operation.attempt(async (currentAttempt) => {
			try {
				const response = await llm.invoke(messages);
				const text =
					typeof response.content === "string"
						? response.content
						: JSON.stringify(response.content);
				resolve(text);
			} catch (error: unknown) {
				if (operation.retry(error as Error)) {
					logger.info("Retrying LLM vision completion", {
						issue: (error as Error).toString().replaceAll(/error/gi, "issue"),
						messageCount: messages.length,
						attempt: currentAttempt,
					});
					return;
				}
				reject(operation.mainError());
			}
		});
	});
}

// ---------------------------------------------------------------------------
// Video categories — used to select the appropriate description prompt
// ---------------------------------------------------------------------------

export const VIDEO_CATEGORIES = {
	HUMAN: "human",
	MAN_MADE_OBJECT: "man-made object",
	NATURE: "nature",
	FOOD: "food",
	ANIMAL: "animal",
	ABSTRACT: "abstract",
} as const;

type VideoCategory = (typeof VIDEO_CATEGORIES)[keyof typeof VIDEO_CATEGORIES];

// ---------------------------------------------------------------------------
// Category detection
// ---------------------------------------------------------------------------

/**
 * Classify a video into one of VIDEO_CATEGORIES based on two frame screenshots.
 */
async function getVideoCategory(
	imageUrl1: string,
	imageUrl2: string,
): Promise<VideoCategory> {
	const normalizedUrl1 = await normalizeImageUrl(imageUrl1);
	const normalizedUrl2 = await normalizeImageUrl(imageUrl2);

	const messages: (HumanMessage | SystemMessage)[] = [
		new HumanMessage("You are a specialist in describing images."),
		new HumanMessage([
			{
				type: "text",
				text: `You are given two images from a video, one taken at 1/3 of the video's duration and another at 2/3. Your task is categorize the video into one of the following categories:

${Object.values(VIDEO_CATEGORIES).join("/")}

Please respond with only the category, no other text. It is important you respond this way, so that we can parse the response easily.`,
			},
			{ type: "text", text: "Frame at first third of video:" },
			{ type: "image_url", image_url: { url: normalizedUrl1 } },
			{ type: "text", text: "Frame at second third of video:" },
			{ type: "image_url", image_url: { url: normalizedUrl2 } },
		]),
	];

	const response = await callLlm(messages);
	if (!response) {
		throw new Error("No category found");
	}

	for (const category of Object.values(VIDEO_CATEGORIES)) {
		if (response.includes(category)) {
			return category;
		}
	}

	throw new Error(`Unable to classify video category: ${response}`);
}

// ---------------------------------------------------------------------------
// Prompt builders — each category has a tailored system prompt
// ---------------------------------------------------------------------------

async function buildCategoryMessages(
	category: VideoCategory,
	imageUrl1: string,
	imageUrl2: string,
	prompt: string,
	videoDescription: string,
): Promise<(HumanMessage | SystemMessage)[]> {
	const promptsByCategory: Record<VideoCategory, string> = {
		[VIDEO_CATEGORIES.HUMAN]: `You are a video description specialist. You will be provided two images from a video of a person doing something, one taken at 1/3 of the video's duration and another at 2/3. Your task is to write a DESCRIPTION of what is happening in the video of FIVE SENTENCES, including the MAXIMUM NUMBER OF RELEVANT KEYWORDS. Use the following guidelines to help categorize the footage:

1. What is the person doing?
2. What nationality, race, gender and age is the person?
3. What is the person wearing? What is the color of their clothing? Is it sportswear or business attire?
4. What is the setting? Is it indoors or outdoors? Is it a city, nature, or something else?
5. What is the time of day? Is it morning, afternoon, evening, or night?
6. What is the person's facial expression and emotion, if visible?

DO NOT DISCUSS EACH TIMESTAMP SEPARATELY. NEVER FOCUS ON THE TIMES WHEN THE SCREENSHOTS ARE TAKEN. Rather, generalize the description of the video.`,

		[VIDEO_CATEGORIES.MAN_MADE_OBJECT]: `You are a video description specialist. You will be provided two images from a video of a man-made object, one taken at 1/3 of the video's duration and another at 2/3. Your task is to write a DESCRIPTION of what is shown in the video of FIVE SENTENCES, including the MAXIMUM NUMBER OF RELEVANT KEYWORDS. Use the following guidelines:

1. What type of object is it? (e.g., vehicle, building, technology, furniture)
2. What are its physical characteristics? (size, color, material, condition)
3. What is its purpose or function?
4. What is the setting or context where the object is shown?
5. Are there any unique features or identifying marks?
6. What is the brand, make, or model if applicable?

DO NOT DISCUSS EACH TIMESTAMP SEPARATELY. NEVER FOCUS ON THE TIMES WHEN THE SCREENSHOTS ARE TAKEN. Rather, generalize the description of the video.`,

		[VIDEO_CATEGORIES.NATURE]: `You are a video description specialist. You will be provided two images from a video of a natural scene, one taken at 1/3 of the video's duration and another at 2/3. Your task is to write a DESCRIPTION of what is shown in the video of FIVE SENTENCES, including the MAXIMUM NUMBER OF RELEVANT KEYWORDS. Use the following guidelines:

1. What type of natural environment is shown? (e.g., forest, ocean, mountain, desert, space)
2. What are the main natural elements visible? (e.g., trees, water, rocks, sky, planet name)
3. What is the weather or atmospheric condition?
4. What time of day does it appear to be?
5. Are there any notable natural phenomena or events occurring?
6. What is the overall mood or atmosphere of the scene?
7. Are there any animals present? What are they doing?

DO NOT DISCUSS EACH TIMESTAMP SEPARATELY. NEVER FOCUS ON THE TIMES WHEN THE SCREENSHOTS ARE TAKEN. Rather, generalize the description of the video.`,

		[VIDEO_CATEGORIES.FOOD]: `You are a video description specialist. You will be provided two images from a video of food, one taken at 1/3 of the video's duration and another at 2/3. Your task is to write a DESCRIPTION of what is shown in the video of FIVE SENTENCES, including the MAXIMUM NUMBER OF RELEVANT KEYWORDS. Use the following guidelines:

1. What type of food or dish is shown?
2. What are the main ingredients visible?
3. What action is being performed with the food?
4. What cuisine or cultural origin does it represent?
5. What is the setting? (e.g., restaurant, home kitchen, outdoor)
6. How does the food appear? (texture, color, portion size)
7. Are there any garnishes or accompaniments?

DO NOT DISCUSS EACH TIMESTAMP SEPARATELY. NEVER FOCUS ON THE TIMES WHEN THE SCREENSHOTS ARE TAKEN. Rather, generalize the description of the video.`,

		[VIDEO_CATEGORIES.ANIMAL]: `You are a video description specialist. You will be provided two images from a video of an animal, one taken at 1/3 of the video's duration and another at 2/3. Your task is to write a DESCRIPTION of what is shown in the video of FIVE SENTENCES, including the MAXIMUM NUMBER OF RELEVANT KEYWORDS. Use the following guidelines:

1. What species of animal is shown?
2. What is the animal doing or how is it behaving?
3. What is the animal's physical appearance? (size, color, distinctive features)
4. What is the setting or habitat?
5. Is the animal alone or with others?
6. What is the animal's apparent age and condition?
7. Is there any interaction with humans or other animals?

DO NOT DISCUSS EACH TIMESTAMP SEPARATELY. NEVER FOCUS ON THE TIMES WHEN THE SCREENSHOTS ARE TAKEN. Rather, generalize the description of the video.`,

		[VIDEO_CATEGORIES.ABSTRACT]: `You are a video description specialist. You will be provided two images from a video of abstract content, one taken at 1/3 of the video's duration and another at 2/3. Your task is to write a DESCRIPTION of what is shown in the video of FIVE SENTENCES, including the MAXIMUM NUMBER OF RELEVANT KEYWORDS. Use the following guidelines:

1. What visual elements are present? (shapes, patterns, colors)
2. What is the overall composition or arrangement?
3. What is the movement or transition style?
4. What mood or emotion does the abstract content evoke?
5. Are there any recognizable elements within the abstraction?
6. What artistic style or technique does it resemble?
7. What is the overall visual impact or effect?

DO NOT DISCUSS EACH TIMESTAMP SEPARATELY. NEVER FOCUS ON THE TIMES WHEN THE SCREENSHOTS ARE TAKEN. Rather, generalize the description of the video.`,
	};

	const systemPrompt = promptsByCategory[category];
	const messages: (HumanMessage | SystemMessage)[] = [
		new SystemMessage(systemPrompt),
	];

	if (videoDescription) {
		messages.push(
			new HumanMessage(
				`This video is a single scene from a longer video downloaded from youtube. Here is the context: ${videoDescription}`,
			),
		);
	}

	if (prompt) {
		messages.push(
			new HumanMessage(
				`The user has provided a prompt on how to describe the video: ${prompt}`,
			),
		);
	}

	const normalizedUrl1 = await normalizeImageUrl(imageUrl1);
	const normalizedUrl2 = await normalizeImageUrl(imageUrl2);

	messages.push(
		new HumanMessage([
			{ type: "text", text: "Frame at first third of video:" },
			{ type: "image_url", image_url: { url: normalizedUrl1 } },
			{ type: "text", text: "Frame at second third of video:" },
			{ type: "image_url", image_url: { url: normalizedUrl2 } },
		]),
	);

	return messages;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a keyword-rich description for a video based on two frame screenshots.
 *
 * Classifies the video into a category, then uses a category-specific prompt
 * to generate a 5-sentence description via the local LLM.
 *
 * @param params.imageUrl1 — URL of the first frame screenshot
 * @param params.imageUrl2 — URL of the second frame screenshot
 * @param params.prompt — optional user-provided description guidance
 * @param params.videoDescription — optional YouTube video description for context
 * @returns A description string suitable for embedding
 */
export async function describeVideoBasedOnFrame({
	imageUrl1,
	imageUrl2,
	prompt,
	videoDescription,
}: {
	imageUrl1: string;
	imageUrl2: string;
	prompt: string;
	videoDescription: string;
}): Promise<string> {
	try {
		const category = await getVideoCategory(imageUrl1, imageUrl2);
		logger.debug("Video categorized", { category });

		const messages = await buildCategoryMessages(
			category,
			imageUrl1,
			imageUrl2,
			prompt,
			videoDescription,
		);
		return callLlm(messages);
	} catch (error) {
		logger.error("Error generating video description", {
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}
