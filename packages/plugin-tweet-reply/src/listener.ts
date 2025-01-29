import { IAgentRuntime, Service, ServiceType, elizaLogger } from "@elizaos/core";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { Scraper } from "agent-twitter-client";
import { Memory } from "@elizaos/core";

interface TweetReplyEvent {
    user: string;
    tweet_link: string;
    status: string;
    amount_paid: string;
}

export const tweetReplyListener: Service = {
    serviceType: ServiceType.BROWSER,
    
    
    initialize: async (runtime: IAgentRuntime) => {
        const network = runtime.getSetting("APTOS_NETWORK") as Network;
        const aptosClient = new Aptos(new AptosConfig({ network }));
        
        // Initialize Twitter client
        const scraper = new Scraper();
        const username = runtime.getSetting("TWITTER_USERNAME");
        const password = runtime.getSetting("TWITTER_PASSWORD");
        const email = runtime.getSetting("TWITTER_EMAIL");
        const twitter2faSecret = runtime.getSetting("TWITTER_2FA_SECRET");

        try {
            // Login to Twitter
            await scraper.login(username, password, email, twitter2faSecret);
            if (!(await scraper.isLoggedIn())) {
                elizaLogger.error("Failed to login to Twitter");
                return;
            }

            // Get all TweetReplyEvents
            const events = await aptosClient.getAccountResource({
                accountAddress: runtime.getSetting("BOT_PORTAL_ADDRESS"),
                resourceType: "BotPortal::actions::TweetReplyEvent"
            });

            // Track processed tweet links to avoid duplicates
            const processedTweets = new Set();

            for (const event of events.data) {
                try {
                    const eventData = event as unknown as TweetReplyEvent;
                    
                    // Only process PENDING events that haven't been handled before
                    if (eventData.status === "PENDING" && !processedTweets.has(eventData.tweet_link)) {
                        processedTweets.add(eventData.tweet_link);
                        
                        const memory: Memory = {
                            content: {
                                tweet_link: eventData.tweet_link,
                                user: eventData.user,
                                text: `Reply to tweet: ${eventData.tweet_link} for user ${eventData.user}`
                            },
                            userId: runtime.agentId,
                            agentId: runtime.agentId,
                            roomId: runtime.agentId
                        };
                        
                        await runtime.processActions(memory, [memory]);
                    }
                } catch (error) {
                    elizaLogger.error('Error processing tweet reply event:', error);
                }
            }
        } catch (error) {
            elizaLogger.error('Error initializing tweet reply listener:', error);
        }
    }
};