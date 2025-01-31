import { Action, IAgentRuntime, Memory, State, elizaLogger, composeContext, generateText, ModelClass } from "@elizaos/core";
import { Scraper } from "agent-twitter-client";

export const replyAction: Action = {
    name: "TWEET_REPLY",
    similes: ["REPLY_TWEET", "RESPOND_TWEET"],
    description: "Reply to a tweet based on blockchain event",
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Reply to tweet https://twitter.com/user/status/123456789",
                    action: "TWEET_REPLY"
                }
            }
        ]
    ],
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const username = runtime.getSetting("TWITTER_USERNAME");
        const password = runtime.getSetting("TWITTER_PASSWORD");
        const email = runtime.getSetting("TWITTER_EMAIL");
        return !!username && !!password && !!email;
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            elizaLogger.info("Starting tweet reply handler", {
                messageId: message.id,
                userId: message.userId
            });

            const content = message.content as unknown as { 
                tweet_link: string; 
                user: string;
                template: string;
            };
            const { tweet_link, user, template } = content;
            const tweetId = extractTweetId(tweet_link);
            
            elizaLogger.debug("Extracted tweet details", {
                tweetId,
                user,
                tweet_link
            });

            // Initialize Twitter client
            const scraper = new Scraper();
            const username = runtime.getSetting("TWITTER_USERNAME");
            const password = runtime.getSetting("TWITTER_PASSWORD");
            const email = runtime.getSetting("TWITTER_EMAIL");
            const twitter2faSecret = runtime.getSetting("TWITTER_2FA_SECRET");

            // Login to Twitter
            elizaLogger.debug("Attempting Twitter login");
            await scraper.login(username, password, email, twitter2faSecret);
            if (!(await scraper.isLoggedIn())) {
                elizaLogger.error("Twitter authentication failed", { username });
                return false;
            }
            elizaLogger.debug("Twitter login successful");

            // Check if we've already replied to this tweet
            const tweetData = await scraper.getTweet(tweetId);
            elizaLogger.debug("Checking for existing replies", { 
                tweetId,
                hasReplies: !!tweetData?.replies,
                replyCount: tweetData?.replies?.length
            });

            if (Array.isArray(tweetData?.replies) && tweetData.replies.some(reply => reply.username === username)) {
                elizaLogger.info("Already replied to this tweet", { tweetId });
                return true;
            }

            // Fetch the original tweet text
            if (!tweetData || !tweetData.text) {
                elizaLogger.error("Failed to fetch tweet content", { tweetId });
                return false;
            }

            // Generate and send response
            elizaLogger.debug("Generating response", { 
                tweetId,
                originalText: tweetData.text.substring(0, 50) + '...'
            });

            const response = await generateResponse({
                template,
                user,
                tweet_text: tweetData.text,
                runtime
            });

            elizaLogger.debug("Sending tweet reply", {
                tweetId,
                responseLength: response.length
            });

            await scraper.sendTweet(response, tweetId);
            
            elizaLogger.info("Tweet reply sent successfully", {
                tweetId,
                user,
                responseLength: response.length
            });

            await runtime.processActions(message, [{
                content: {
                    ...content,
                    status: "COMPLETED",
                    text: `Reply sent to tweet ${tweet_link} for user ${user}`
                },
                userId: message.userId,
                agentId: runtime.agentId,
                roomId: message.roomId
            }]);
            
            return true;
        } catch (error) {
            elizaLogger.error("Tweet reply action failed", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            return false;
        }
    }
};

function extractTweetId(tweetLink: string): string {
    const matches = tweetLink.match(/\/status\/(\d+)/);
    return matches?.[1] || '';
}

interface ResponseParams {
    template: string;
    user: string;
    tweet_text: string;
    runtime: IAgentRuntime;
}

async function generateResponse({ template, user, tweet_text, runtime }: ResponseParams): Promise<string> {
    const context = composeContext({
        state: {
            user,
            tweet_text,
        } as unknown as State,
        template,
    });

    let response = await generateText({
        runtime,
        context,
        modelClass: ModelClass.SMALL,
    });

    // Remove any @mentions from the start of the response
    response = response.replace(/^(@[\w\d_]+\s*)+/, '').trim();

    // Ensure response is within Twitter's character limit (280) and complete
    if (response.length > 280) {
        // Find the last complete sentence or list item before the limit
        const truncated = response.substring(0, 277);
        const lastSentence = truncated.match(/^.*[.!?](?:\s|$)/);
        const lastListItem = truncated.match(/^.*(?:-\s+[^-]+)(?:\s|$)/);
        
        if (lastSentence || lastListItem) {
            const endIndex = Math.max(
                lastSentence ? lastSentence[0].length : 0,
                lastListItem ? lastListItem[0].length : 0
            );
            return response.substring(0, endIndex).trim();
        }
        return truncated + '...';
    }

    return response;
} 
