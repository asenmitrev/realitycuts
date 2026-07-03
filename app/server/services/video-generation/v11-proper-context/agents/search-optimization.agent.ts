import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getLlm } from '../../../../config/llm';

const llm = getLlm();

const outputParser = new StringOutputParser();

const chatPrompt = ChatPromptTemplate.fromMessages<{
  sentence: string;
  context: string;
  previousSearchTerms: string;
  guidance: string;
}>([
  new SystemMessage(`You are an expert at optimizing search terms for a video transcript.`),
  new HumanMessage(`
      Your task is to provide search terms for overlaying footage on top of a person speaking in a video. You will receive a part of a transcript along with the context for this sentence, meaning the entire paragraph where the sentence is present, for better understanding of the wider meaning. \nYour job is to find suitable search terms for this part of the transcript. Follow these steps:\nSpecific Search Term: This term should fit well with the highlighted part and creatively explore the exact topic. Keep it no more than 4 words long.\nExample: For "Murders occur once every month", a specific search term could be "Murderer in New York."\nGeneral Search Term: Provide a broader search term that’s more likely to return a match if the specific one doesn’t. Keep it no more than 3 words long.\nExample: For the sawme phrase, the general search term might be "Attacker."\nVector Search Term: This term can be longer, up to 20 words. It should describe detailed meaning of the highlighted portion for a vector-based search engine, which relies on encoded meaning. In this search term, please supply details about the pacing of the video, fast pacing, slow, static, setting and action you think would be appropriate. Example: "Man menacingly attacking a person."\nAdditional Guidelines for Improving B-Roll Relevance:\nEmotion and Tone: Consider the emotional tone of the highlighted section. Does it convey tension, calmness, excitement, or sadness? Make sure the B-roll captures the emotional feeling of the moment.\nExample: If the speaker is talking about a tragic event, the B-roll might need to reflect a somber or tense tone.\nPacing: Match the pace of the B-roll footage with the speed and delivery of the speaker. Is the speaker energetic or calm? Choose footage that complements the speaker’s rhythm.\nVisual Conditions: If relevant, consider whether the B-roll should take place indoors or outdoors, during the day or night, or in specific environments (e.g., city, nature, office). If this information is present, align the footage accordingly.\nContext and Flow: Review any search terms already used to find B-roll for this paragraph. Avoid repeating the same or similar footage and instead build upon the previous suggestions to create a visually engaging sequence that matches the overall narrative. Previous searches might be empty, as it is possible this is the first term.\nAudience and Subject Relevance: Make sure the B-roll is relevant to the subject matter and target audience. For example, a professional corporate video would need different B-roll than a casual travel vlog.\nResponse Format: Return the search terms in the following format:\nspecificsearchterm$&$generalsearchterm$&$vectorsearchterm\nImportant:\nDo not include any extra text, explanations, or greetings. Only provide the search terms in the specified format, as this will be used programmatically. Adding anything beyond the required terms will cause the program to break."\n\nExample Output with Revisions:\nFor the phrase "Murders occur once every month", and considering a tense emotional tone, the output should look like this:\nMurderer in New York$&$Attacker$&$Man menacingly attacking a person in the streets at night, anger and fear, fast video pacing\n`),
  [
    'human',
    `The user wants to influence the search terms for the video. Keep in mind their guidance could include other details, like the theme of the video and the scriptwriting. Please only taker into account the guidance for search term generation. Here is their guidance: {guidance}`
  ],
  [
    'human',
    `Transcript portion: {sentence}
      Context: {context}
      Previous Search Terms: {previousSearchTerms}`
  ]
]);
export const searchOptimizationAgent = chatPrompt.pipe(llm).pipe(outputParser);
