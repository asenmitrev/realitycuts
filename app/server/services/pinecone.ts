/**
 * Pinecone vector database integration — lazy-initialized singleton.
 *
 * Provides upsert operations for video metadata. Used by the
 * library-item-processing BullMQ worker.
 *
 * Note: Pinecone upsert is currently disabled in the embedding pipeline
 * (MongoDB is the source of truth). This module exists for future re-enablement.
 */

import type { PineconeRecord } from "@pinecone-database/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import type { PineconeVideoMetadata } from "shared/types";
import { logger } from "../logging";

// ---------------------------------------------------------------------------
// Lazy-initialized Pinecone client
// ---------------------------------------------------------------------------

let pineconeInstance: Pinecone | null = null;

async function getPinecone(): Promise<Pinecone> {
	if (!pineconeInstance) {
		const apiKey = process.env.PINECONE_KEY;
		if (!apiKey) {
			logger.warn("PINECONE_KEY not set — Pinecone operations will fail");
		}
		pineconeInstance = new Pinecone({ apiKey: apiKey ?? "" });
	}
	return pineconeInstance;
}

// ---------------------------------------------------------------------------\n// Public API
// ---------------------------------------------------------------------------

/**
 * Upsert a record to the Pinecone 'librarysearchv2' index.
 *
 * @param record — Pinecone record with video metadata
 * @returns true if upsert succeeded
 */
export async function upsertToPinecone(
	record: PineconeRecord<PineconeVideoMetadata>,
): Promise<boolean> {
	try {
		const pc = await getPinecone();
		const index = pc.Index<PineconeVideoMetadata>("librarysearchv2");
		await index.upsert([record]);
		return true;
	} catch (error) {
		logger.error("Error upserting to Pinecone", {
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}
