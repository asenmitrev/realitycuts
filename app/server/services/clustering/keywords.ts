/**
 * Per-cluster keyword extraction — a plain TF-IDF stand-in for the original
 * pipeline's BERTopic step. Good enough to label a cluster in the UI
 * ("beach, sunset, ocean") without pulling in a topic-modeling library.
 */

const STOPWORDS = new Set([
	"a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
	"in", "into", "is", "it", "its", "of", "on", "or", "our", "over", "some",
	"such", "that", "the", "their", "there", "these", "this", "to", "up", "was",
	"were", "will", "with", "you", "your", "video", "clip", "shot", "footage",
]);

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(token => token.length > 2 && !STOPWORDS.has(token) && Number.isNaN(Number(token)));
}

/**
 * Ranks each cluster's terms by (in-cluster frequency) x (inverse cluster
 * frequency), so words common to every cluster ("beach" in a travel library)
 * are pushed down in favor of terms distinctive to that cluster.
 */
export function extractClusterKeywords(
	clusterTexts: Map<number, string[]>,
	topN = 5,
): Map<number, string[]> {
	const termFrequencyByCluster = new Map<number, Map<string, number>>();
	const clusterCountByTerm = new Map<string, number>();

	for (const [clusterId, texts] of clusterTexts) {
		const termFrequency = new Map<string, number>();
		for (const text of texts) {
			for (const token of tokenize(text)) {
				termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
			}
		}
		termFrequencyByCluster.set(clusterId, termFrequency);
		for (const term of termFrequency.keys()) {
			clusterCountByTerm.set(term, (clusterCountByTerm.get(term) ?? 0) + 1);
		}
	}

	const numClusters = clusterTexts.size;
	const keywordsByCluster = new Map<number, string[]>();

	for (const [clusterId, termFrequency] of termFrequencyByCluster) {
		const scored = Array.from(termFrequency.entries()).map(([term, frequency]) => {
			const clustersContainingTerm = clusterCountByTerm.get(term) ?? 1;
			const idf = Math.log((numClusters + 1) / clustersContainingTerm) + 1;
			return { term, score: frequency * idf };
		});
		scored.sort((a, b) => b.score - a.score);
		keywordsByCluster.set(clusterId, scored.slice(0, topN).map(s => s.term));
	}

	return keywordsByCluster;
}
