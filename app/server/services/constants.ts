export const SYSTEM_PROMPT = `You are a professional editor. I am inputting a conversation between some characters in my novel. The characters are discussing a topic in freeform. The discussion is very long. I have added line numbers to every line so that I can better understand your output. Ignore the line numbers when thinking about the content, but include them in the output.
Read through the conversation and extract the main topics discussed in it. Later on, you will be asked to extract quotes from the conversation that correspond to each topic, and are a good representation of it.`;

export const TRANSCRIPT_TOPIC_PROMPT = `At this point, please only provide the list of the 6 to 10 main topics that you've identified from the transcript without including any filler. Specify the lines covered by each of the topics following this format: 1. <Topic name> (<lines range>)`;

export const QUOTE_FROM_TOPIC_PROMPT = `Having in mind the topic that you identified - '__topic__', give me several quotes from this discussion, verbatim, that reflect the topic and I can send to my followers on social media. I want the quotes to be of interest to my followers, so they want to read my book, but also contain a complete thought, so that the post doesn't seem meaningless without the complete work. Each quote should be between 10 and 25 lines. Please include the line numbers from the transcript in each line, so I can easily identify them in my original work. Please do not discuss or augment the quote in any way, as I am using a computer program to process your response, and it relies on a precise format of the answer.  Please respond with as many messages as possible, separating them with a specific string, in this case '!SEPARATOR!', so I can easily split them programatically and parse them as separate. Don't include anything else aside from the quotes and the separator in your response.`;

export const ASK_MORE_QUOTE_FROM_TOPIC_PROMPT = `Thank you. Do you think there's another meaningful quote representing the topic that you can extract? If not, please reply with !NO!`;

export const ASK_BETTER_QUOTE_FROM_TOPIC_PROMPT = `The quote you provided

__quote__

is a bit too short, could you come up with another similar and meaningful quote from the same topic that is at least 10 lines long? Make sure the quote is not longer than 25 lines. If not, please reply with !NO!`;
