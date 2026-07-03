import type Anthropic from "@anthropic-ai/sdk";
import {
	AROLL_BROLL_CATEGORIES,
	CAMERA_ANGLE_CATEGORIES,
	COMPLEXITY_CATEGORIES,
	DEPTH_OF_FIELD_CATEGORIES,
	FOCUS_POSITION_CATEGORIES,
	FRAMING_CATEGORIES,
	PERSPECTIVE_CATEGORIES,
	type VideoCategorizationMetadata,
} from "shared/types";
import { configureDotenv } from "../config/dotenv";
import { toInternalMediaUrl } from "../config/storage";
import { createClaudeVisionCheapCompletion } from "../services/ai/anthropic";
import { logger } from "../services/logging";

configureDotenv();

/**
 * Claude's vision API only accepts HTTPS URLs. For non-HTTPS URLs (e.g.,
 * http://localhost MinIO endpoints), download the image and convert to base64.
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

async function normalizeImageSource(
	url: string,
): Promise<Anthropic.URLImageSource | Anthropic.Base64ImageSource> {
	if (url.startsWith("https://")) {
		return { type: "url", url };
	}

	try {
		const response = await fetch(toInternalMediaUrl(url));
		if (!response.ok) {
			throw new Error(
				`Failed to fetch image: ${response.status} ${response.statusText}`,
			);
		}
		const buffer = Buffer.from(await response.arrayBuffer());
		// Detect actual image type from magic bytes — don't trust the
		// Content-Type header (it may be missing or wrong, causing
		// Anthropic to reject the request with invalid_request_error).
		const mimeType = detectMimeTypeFromBytes(buffer) as
			| "image/jpeg"
			| "image/png"
			| "image/gif"
			| "image/webp";
		const base64 = buffer.toString("base64");
		return {
			type: "base64",
			media_type: mimeType,
			data: base64,
		};
	} catch (error) {
		logger.error("Failed to fetch non-HTTPS image", {
			url,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

async function buildImageBlock(
	url: string,
): Promise<Anthropic.ImageBlockParam> {
	const source = await normalizeImageSource(url);
	return { type: "image", source };
}

const framingAndCameraAgent = async ({
	screenshot1,
	screenshot2,
}: {
	screenshot1: string;
	screenshot2: string;
}) => {
	const messages: Anthropic.MessageParam[] = [
		{
			role: "user",
			content:
				"You are an expert at analyzing framing and camera angles in videos. You will receive two screenshots and categorize both the framing distance and camera angle. /no_think",
		},
		{
			role: "user",
			content: `Analyze both the framing (distance based) and camera angle in these screenshots based on these categories:

Framing Categories:
-Extreme Close-Up (${FRAMING_CATEGORIES.EXTREME_CLOSE_UP}): Focus on tiny details (e.g., an eye, a ring).
-Close-Up (${FRAMING_CATEGORIES.CLOSE_UP}): Frames the face or a specific object.
-Medium Close-Up (${FRAMING_CATEGORIES.MEDIUM_CLOSE_UP}): Chest or shoulders up.
-Medium Shot (${FRAMING_CATEGORIES.MEDIUM_SHOT}): Waist up, balancing subject and environment.
-Medium Long Shot (${FRAMING_CATEGORIES.MEDIUM_LONG_SHOT}): Knees up, showing more surroundings.
-Long Shot (${FRAMING_CATEGORIES.LONG_SHOT}): Entire body with background context.
-Wide Shot (${FRAMING_CATEGORIES.WIDE_SHOT}): Subject surrounded by environment.
-Extreme Long Shot (${FRAMING_CATEGORIES.EXTREME_LONG_SHOT}): Vast landscapes, tiny subjects.

Camera Angle Categories:
-Eye-Level (${CAMERA_ANGLE_CATEGORIES.EYE_LEVEL}): Neutral, mimics natural human perspective.
-Low Angle (${CAMERA_ANGLE_CATEGORIES.LOW_ANGLE}): Camera looks up, emphasizing power/dominance.
-High Angle (${CAMERA_ANGLE_CATEGORIES.HIGH_ANGLE}): Camera looks down, suggesting vulnerability.
-Dutch Angle (${CAMERA_ANGLE_CATEGORIES.DUTCH_ANGLE}): Diagonal framing for tension or unease.
-Bird's-Eye View (${CAMERA_ANGLE_CATEGORIES.BIRD_EYE_VIEW}): Directly overhead view.
-Worm's-Eye View (${CAMERA_ANGLE_CATEGORIES.WORM_EYE_VIEW}): Extreme low angle.
-Shoulder-Level (${CAMERA_ANGLE_CATEGORIES.SHOULDERS_LEVEL}): Aligns with shoulders.
-Hip-Level (${CAMERA_ANGLE_CATEGORIES.HIP_LEVEL}): Waist height view.
-Knee-Level (${CAMERA_ANGLE_CATEGORIES.KNEES_LEVEL}): Emphasizes movement.
-Aerial Angle (${CAMERA_ANGLE_CATEGORIES.AERIAL_ANGLE}): From drones/aircraft.

Respond with two category codes separated by a comma. First the framing code, then the camera angle code. Example: ECU,EL`,
		},
		{
			role: "user",
			content: [
				{
					type: "text",
					text: "Screenshot 1:",
				},
				await buildImageBlock(screenshot1),
				{
					type: "text",
					text: "Screenshot 2:",
				},
				await buildImageBlock(screenshot2),
			],
		},
	];

	return createClaudeVisionCheapCompletion(messages);
};

const perspectiveAndDepthOfFieldAgent = async ({
	screenshot1,
	screenshot2,
}: {
	screenshot1: string;
	screenshot2: string;
}) => {
	const messages: Anthropic.MessageParam[] = [
		{
			role: "user",
			content:
				"You are an expert at analyzing perspective and depth of field in videos. You will receive two screenshots and categorize both the perspective and depth of field. /no_think",
		},
		{
			role: "user",
			content: `Analyze both the perspective and depth of field in these screenshots based on these categories:

Perspective Categories:
-Point-of-View (${PERSPECTIVE_CATEGORIES.POINT_OF_VIEW}): Through character's eyes.
-Over-the-Shoulder (${PERSPECTIVE_CATEGORIES.OVER_THE_SHOULDER}): Behind character view.
-Subjective Perspective (${PERSPECTIVE_CATEGORIES.SUBJECTIVE_PERSPECTIVE}): Mimics character movement.
-Objective Perspective (${PERSPECTIVE_CATEGORIES.OBJECTIVE_PERSPECTIVE}): Neutral observation.

Depth of Field Categories:
-Deep Focus (${DEPTH_OF_FIELD_CATEGORIES.DEEP_FOCUS}): Everything sharp and clear.
-Shallow Focus (${DEPTH_OF_FIELD_CATEGORIES.SHALLOW_FOCUS}): One subject in focus, blurred background.
-Rack Focus (${DEPTH_OF_FIELD_CATEGORIES.RACK_FOCUS}): Shifting focus between subjects.
-Soft Focus (${DEPTH_OF_FIELD_CATEGORIES.SOFT_FOCUS}): Slightly blurred dreamy effect.
-Split Diopter Shot (${DEPTH_OF_FIELD_CATEGORIES.SPLIT_DIOPTER_SHOT}): Two focal planes in focus.
-Tilt-Shift Shot (${DEPTH_OF_FIELD_CATEGORIES.TILT_SHIFT_SHOT}): Selective blur for miniature effect.

Respond with two category codes separated by a comma. First the perspective code, then the depth of field code. Respond with nothing else, even if the two screenshots have different content, try to guess what the entire video is about. IT IS PARAMOUNT YOU DO NOT RESPOND WITH ANY EXPLANATIONS OR TEXT. Example of your entire output: POV,DF`,
		},
		{
			role: "user",
			content: [
				{
					type: "text",
					text: "Screenshot 1:",
				},
				await buildImageBlock(screenshot1),
				{
					type: "text",
					text: "Screenshot 2:",
				},
				await buildImageBlock(screenshot2),
			],
		},
	];

	return createClaudeVisionCheapCompletion(messages);
};

const complexityAndArollBrollAgent = async ({
	screenshot1,
	screenshot2,
}: {
	screenshot1: string;
	screenshot2: string;
}) => {
	const messages: Anthropic.MessageParam[] = [
		{
			role: "user",
			content:
				"You are an expert at analyzing the complexity, focus position, and type of a video. You will receive two screenshots and categorize both the complexity, focus position, and whether it is A-roll or B-roll. /no_think",
		},
		{
			role: "user",
			content: `Analyze both the complexity, focus position, and type of the video based on these categories:

Complexity Categories:
- Simple (${COMPLEXITY_CATEGORIES.SIMPLE}): Static camera, few moving elements, minimal depth.
- Moderate (${COMPLEXITY_CATEGORIES.MODERATE}): Slow pan/tilt, foreground + background separation, mild dynamic elements.
- Complex (${COMPLEXITY_CATEGORIES.COMPLEX}): Rapid motion, multi-plane focus, technical demands.

A-roll/B-roll Categories:
- A-roll (${AROLL_BROLL_CATEGORIES.AROLL}): A person actively speaking or presenting directly to the camera or audience, such as in interviews, meetings, presentations, or verbal explanations. The primary focus is on verbal communication and dialogue.
- B-roll (${AROLL_BROLL_CATEGORIES.BROLL}): Any footage that is NOT focused on active speaking/verbal communication, including: static shots, people performing actions or activities (like shooting a bow, cooking, exercising, walking, working), product demonstrations, landscapes, establishing shots, cutaway shots, or any supplementary visual content that supports the narrative without being the primary speaking content.

Key distinction: If the person is primarily engaged in speaking/talking (even while gesturing), classify as A-roll. If the person is primarily engaged in any other activity (even if they might be speaking incidentally), classify as B-roll.

Focus Position Categories:
- Left Focus (${FOCUS_POSITION_CATEGORIES.LEFT}): The primary subject or point of interest is positioned at or near the first vertical line (left third of the frame), following the rule of thirds composition.
- Central Focus (${FOCUS_POSITION_CATEGORIES.CENTER}): The primary subject or point of interest is positioned in the center of the frame, between the two vertical lines.
- Right Focus (${FOCUS_POSITION_CATEGORIES.RIGHT}): The primary subject or point of interest is positioned at or near the second vertical line (right third of the frame), following the rule of thirds composition.

Key distinction: Identify where the main subject, person, or most visually prominent element is positioned horizontally within the frame. If the primary focus falls on the left vertical gridline, classify as Left Focus. If centered between the gridlines, classify as Central Focus. If the primary focus falls on the right vertical gridline, classify as Right Focus.

Respond with three category codes separated by commas. Respond with nothing else, even if the two screenshots have different content, try to guess what the entire video is about. IT IS PARAMOUNT YOU DO NOT RESPOND WITH ANY EXPLANATIONS OR TEXT. First the complexity code, then the A-roll/B-roll code, then the focus position code. Example of your entire output: COMPLEX,BROLL,CENTER

AND YOUR RESPONSE IS:`,
		},
		{
			role: "user",
			content: [
				{
					type: "text",
					text: `Screenshot 1:`,
				},
				await buildImageBlock(screenshot1),
				{
					type: "text",
					text: `Screenshot 2:`,
				},
				await buildImageBlock(screenshot2),
			],
		},
	];

	return createClaudeVisionCheapCompletion(messages);
};

export const generateMetadataForVideo = async (
	screenshotDataUris: string[],
): Promise<VideoCategorizationMetadata> => {
	const [
		framingAndCamera,
		perspectiveAndDepthOfField,
		complexityAndArollBroll,
	] = await Promise.all([
		framingAndCameraAgent({
			screenshot1: screenshotDataUris[0],
			screenshot2: screenshotDataUris[1],
		}),
		perspectiveAndDepthOfFieldAgent({
			screenshot1: screenshotDataUris[0],
			screenshot2: screenshotDataUris[1],
		}),
		complexityAndArollBrollAgent({
			screenshot1: screenshotDataUris[0],
			screenshot2: screenshotDataUris[1],
		}),
	]);

	if (
		!framingAndCamera ||
		!perspectiveAndDepthOfField ||
		!complexityAndArollBroll
	) {
		throw new Error("Failed to generate complete metadata");
	}

	const [framing, cameraAngle] = framingAndCamera.split(",");
	const [perspective, depthOfField] = perspectiveAndDepthOfField.split(",");
	const [complexity, arollBroll, focusPosition] =
		complexityAndArollBroll.split(",");

	return {
		framing: mapFramingToEnum(framing?.trim()),
		cameraAngle: mapCameraAnglesToEnum(cameraAngle?.trim()),
		perspective: mapPerspectiveToEnum(perspective?.trim()),
		depthOfField: mapDepthOfFieldToEnum(depthOfField?.trim()),
		complexity: mapComplexityToEnum(complexity?.trim()),
		arollBroll: mapArollBrollToEnum(arollBroll?.trim()),
		focusPosition: mapFocusPositionToEnum(focusPosition?.trim()),
	};
};

const mapArollBrollToEnum = (
	arollBroll: string,
): (typeof AROLL_BROLL_CATEGORIES)[keyof typeof AROLL_BROLL_CATEGORIES] => {
	switch (arollBroll) {
		case AROLL_BROLL_CATEGORIES.AROLL:
			return AROLL_BROLL_CATEGORIES.AROLL;
		case AROLL_BROLL_CATEGORIES.BROLL:
			return AROLL_BROLL_CATEGORIES.BROLL;
		default:
			return AROLL_BROLL_CATEGORIES.UNKNOWN;
	}
};
const mapComplexityToEnum = (
	complexity: string,
): (typeof COMPLEXITY_CATEGORIES)[keyof typeof COMPLEXITY_CATEGORIES] => {
	switch (complexity) {
		case COMPLEXITY_CATEGORIES.SIMPLE:
			return COMPLEXITY_CATEGORIES.SIMPLE;
		case COMPLEXITY_CATEGORIES.MODERATE:
			return COMPLEXITY_CATEGORIES.MODERATE;
		case COMPLEXITY_CATEGORIES.COMPLEX:
			return COMPLEXITY_CATEGORIES.COMPLEX;
		default:
			return COMPLEXITY_CATEGORIES.UNKNOWN;
	}
};

const mapFramingToEnum = (
	framing: string,
): (typeof FRAMING_CATEGORIES)[keyof typeof FRAMING_CATEGORIES] => {
	switch (framing) {
		case FRAMING_CATEGORIES.EXTREME_CLOSE_UP:
			return FRAMING_CATEGORIES.EXTREME_CLOSE_UP;
		case FRAMING_CATEGORIES.CLOSE_UP:
			return FRAMING_CATEGORIES.CLOSE_UP;
		case FRAMING_CATEGORIES.MEDIUM_CLOSE_UP:
			return FRAMING_CATEGORIES.MEDIUM_CLOSE_UP;
		case FRAMING_CATEGORIES.MEDIUM_SHOT:
			return FRAMING_CATEGORIES.MEDIUM_SHOT;
		case FRAMING_CATEGORIES.MEDIUM_LONG_SHOT:
			return FRAMING_CATEGORIES.MEDIUM_LONG_SHOT;
		case FRAMING_CATEGORIES.LONG_SHOT:
			return FRAMING_CATEGORIES.LONG_SHOT;
		case FRAMING_CATEGORIES.WIDE_SHOT:
			return FRAMING_CATEGORIES.WIDE_SHOT;
		case FRAMING_CATEGORIES.EXTREME_LONG_SHOT:
			return FRAMING_CATEGORIES.EXTREME_LONG_SHOT;
		default:
			return FRAMING_CATEGORIES.UNKNOWN;
	}
};
const mapCameraAnglesToEnum = (
	cameraAngles: string,
): (typeof CAMERA_ANGLE_CATEGORIES)[keyof typeof CAMERA_ANGLE_CATEGORIES] => {
	switch (cameraAngles) {
		case CAMERA_ANGLE_CATEGORIES.EYE_LEVEL:
			return CAMERA_ANGLE_CATEGORIES.EYE_LEVEL;
		case CAMERA_ANGLE_CATEGORIES.LOW_ANGLE:
			return CAMERA_ANGLE_CATEGORIES.LOW_ANGLE;
		case CAMERA_ANGLE_CATEGORIES.HIGH_ANGLE:
			return CAMERA_ANGLE_CATEGORIES.HIGH_ANGLE;
		case CAMERA_ANGLE_CATEGORIES.DUTCH_ANGLE:
			return CAMERA_ANGLE_CATEGORIES.DUTCH_ANGLE;
		case CAMERA_ANGLE_CATEGORIES.BIRD_EYE_VIEW:
			return CAMERA_ANGLE_CATEGORIES.BIRD_EYE_VIEW;
		case CAMERA_ANGLE_CATEGORIES.WORM_EYE_VIEW:
			return CAMERA_ANGLE_CATEGORIES.WORM_EYE_VIEW;
		case CAMERA_ANGLE_CATEGORIES.SHOULDERS_LEVEL:
			return CAMERA_ANGLE_CATEGORIES.SHOULDERS_LEVEL;
		case CAMERA_ANGLE_CATEGORIES.HIP_LEVEL:
			return CAMERA_ANGLE_CATEGORIES.HIP_LEVEL;
		case CAMERA_ANGLE_CATEGORIES.KNEES_LEVEL:
			return CAMERA_ANGLE_CATEGORIES.KNEES_LEVEL;
		case CAMERA_ANGLE_CATEGORIES.AERIAL_ANGLE:
			return CAMERA_ANGLE_CATEGORIES.AERIAL_ANGLE;
		default:
			return CAMERA_ANGLE_CATEGORIES.UNKNOWN;
	}
};

const mapPerspectiveToEnum = (
	perspective: string,
): (typeof PERSPECTIVE_CATEGORIES)[keyof typeof PERSPECTIVE_CATEGORIES] => {
	switch (perspective) {
		case PERSPECTIVE_CATEGORIES.POINT_OF_VIEW:
			return PERSPECTIVE_CATEGORIES.POINT_OF_VIEW;
		case PERSPECTIVE_CATEGORIES.OVER_THE_SHOULDER:
			return PERSPECTIVE_CATEGORIES.OVER_THE_SHOULDER;
		case PERSPECTIVE_CATEGORIES.SUBJECTIVE_PERSPECTIVE:
			return PERSPECTIVE_CATEGORIES.SUBJECTIVE_PERSPECTIVE;
		case PERSPECTIVE_CATEGORIES.OBJECTIVE_PERSPECTIVE:
			return PERSPECTIVE_CATEGORIES.OBJECTIVE_PERSPECTIVE;
		default:
			return PERSPECTIVE_CATEGORIES.UNKNOWN;
	}
};

const mapDepthOfFieldToEnum = (
	depthOfField: string,
): (typeof DEPTH_OF_FIELD_CATEGORIES)[keyof typeof DEPTH_OF_FIELD_CATEGORIES] => {
	switch (depthOfField) {
		case DEPTH_OF_FIELD_CATEGORIES.SHALLOW_FOCUS:
			return DEPTH_OF_FIELD_CATEGORIES.SHALLOW_FOCUS;
		case DEPTH_OF_FIELD_CATEGORIES.DEEP_FOCUS:
			return DEPTH_OF_FIELD_CATEGORIES.DEEP_FOCUS;
		case DEPTH_OF_FIELD_CATEGORIES.RACK_FOCUS:
			return DEPTH_OF_FIELD_CATEGORIES.RACK_FOCUS;
		case DEPTH_OF_FIELD_CATEGORIES.SOFT_FOCUS:
			return DEPTH_OF_FIELD_CATEGORIES.SOFT_FOCUS;
		case DEPTH_OF_FIELD_CATEGORIES.SPLIT_DIOPTER_SHOT:
			return DEPTH_OF_FIELD_CATEGORIES.SPLIT_DIOPTER_SHOT;
		case DEPTH_OF_FIELD_CATEGORIES.TILT_SHIFT_SHOT:
			return DEPTH_OF_FIELD_CATEGORIES.TILT_SHIFT_SHOT;
		default:
			return DEPTH_OF_FIELD_CATEGORIES.UNKNOWN;
	}
};

const mapFocusPositionToEnum = (
	focusPosition: string,
): (typeof FOCUS_POSITION_CATEGORIES)[keyof typeof FOCUS_POSITION_CATEGORIES] => {
	switch (focusPosition) {
		case FOCUS_POSITION_CATEGORIES.LEFT:
			return FOCUS_POSITION_CATEGORIES.LEFT;
		case FOCUS_POSITION_CATEGORIES.CENTER:
			return FOCUS_POSITION_CATEGORIES.CENTER;
		case FOCUS_POSITION_CATEGORIES.RIGHT:
			return FOCUS_POSITION_CATEGORIES.RIGHT;
		default:
			return FOCUS_POSITION_CATEGORIES.UNKNOWN;
	}
};
