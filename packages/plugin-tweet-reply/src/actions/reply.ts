import { Action, IAgentRuntime, Memory, State, elizaLogger } from "@elizaos/core";
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
            const content = message.content as unknown as { 
                tweet_link: string; 
                user: string;
                template: string;
            };
            const { tweet_link, user, template } = content;
            const tweetId = extractTweetId(tweet_link);
            
            // Initialize Twitter client
            const scraper = new Scraper();
            const username = runtime.getSetting("TWITTER_USERNAME");
            const password = runtime.getSetting("TWITTER_PASSWORD");
            const email = runtime.getSetting("TWITTER_EMAIL");
            const twitter2faSecret = runtime.getSetting("TWITTER_2FA_SECRET");

            // Login to Twitter
            await scraper.login(username, password, email, twitter2faSecret);
            if (!(await scraper.isLoggedIn())) {
                elizaLogger.error("Failed to login to Twitter");
                return false;
            }

            // Fetch the original tweet text
            elizaLogger.info("Fetching original tweet content", { tweetId });
            const tweetData = await scraper.getTweet(tweetId);
            if (!tweetData || !tweetData.text) {
                elizaLogger.error("Failed to fetch tweet content", { tweetId });
                return false;
            }

            // Generate response using template
            const response = generateResponse({
                template,
                user,
                tweet_text: tweetData.text
            });

            // Send the generated reply
            await scraper.sendTweet(response, tweetId);
            
            // Update event status to COMPLETED
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
            
            elizaLogger.info(`Reply sent successfully to tweet ${tweetId}`, {
                originalTweet: tweetData.text,
                generatedReply: response
            });
            return true;
        } catch (error) {
            elizaLogger.error("Error in reply action:", error);
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
}

function generateResponse({ template, user, tweet_text }: ResponseParams): string {
    // Replace template variables
    let response = template
        .replace('{{user}}', user)
        .replace('{{tweet_text}}', tweet_text);

    // Ensure response is within Twitter's character limit (280)
    if (response.length > 280) {
        response = response.substring(0, 277) + '...';
    }

    return response;
} 
