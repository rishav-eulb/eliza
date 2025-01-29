import { IAgentRuntime, Service, ServiceType, elizaLogger } from "@elizaos/core";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { Scraper } from "agent-twitter-client";
import { Memory } from "@elizaos/core";
import { DEFAULT_NETWORK, MOVEMENT_NETWORK_CONFIG } from "./constants";

interface TweetReplyEvent {
    user: string;
    tweet_link: string;
    status: string;
    amount_paid: string;
}

export const tweetReplyListener: Service = {
    serviceType: ServiceType.BROWSER,
    
    initialize: async (runtime: IAgentRuntime) => {
        try {
            elizaLogger.info("Starting tweet reply listener initialization...");
            
            const networkConfig = MOVEMENT_NETWORK_CONFIG[DEFAULT_NETWORK];
            if (!networkConfig) {
                const error = new Error(`Invalid network configuration for ${DEFAULT_NETWORK}`);
                elizaLogger.error("Network configuration error:", {
                    network: DEFAULT_NETWORK,
                    availableNetworks: Object.keys(MOVEMENT_NETWORK_CONFIG),
                    error: error.message
                });
                throw error;
            }
            elizaLogger.debug("Network configuration loaded:", {
                network: DEFAULT_NETWORK,
                fullnode: networkConfig.fullnode,
                chainId: networkConfig.chainId
            });

            let aptosClient;
            try {
                aptosClient = new Aptos(
                    new AptosConfig({
                        network: Network.TESTNET,
                        fullnode: networkConfig.fullnode
                    })
                );
                elizaLogger.info("Aptos client initialized successfully");
            } catch (aptosError) {
                elizaLogger.error("Failed to initialize Aptos client:", {
                    error: aptosError.message,
                    network: DEFAULT_NETWORK,
                    fullnode: networkConfig.fullnode,
                    stack: aptosError.stack
                });
                throw aptosError;
            }

            // Initialize Twitter client with detailed logging
            const scraper = new Scraper();
            const username = runtime.getSetting("TWITTER_USERNAME");
            const password = runtime.getSetting("TWITTER_PASSWORD");
            const email = runtime.getSetting("TWITTER_EMAIL");
            const twitter2faSecret = runtime.getSetting("TWITTER_2FA_SECRET");

            if (!username || !password) {
                const missingCreds = [];
                if (!username) missingCreds.push("TWITTER_USERNAME");
                if (!password) missingCreds.push("TWITTER_PASSWORD");
                const error = new Error(`Missing required Twitter credentials: ${missingCreds.join(", ")}`);
                elizaLogger.error("Twitter authentication error:", {
                    missingCredentials: missingCreds,
                    error: error.message
                });
                throw error;
            }

            elizaLogger.debug("Twitter credentials validation passed", { 
                hasUsername: true,
                hasPassword: true,
                hasEmail: !!email,
                has2FA: !!twitter2faSecret
            });

            try {
                // Login to Twitter
                elizaLogger.info("Attempting Twitter login...");
                await scraper.login(username, password, email, twitter2faSecret);
                const isLoggedIn = await scraper.isLoggedIn();
                
                if (!isLoggedIn) {
                    const error = new Error("Twitter login failed after attempt");
                    elizaLogger.error("Twitter authentication failed:", {
                        hasEmail: !!email,
                        has2FA: !!twitter2faSecret,
                        error: error.message
                    });
                    throw error;
                }
                elizaLogger.info("Twitter login successful");
            } catch (twitterError) {
                elizaLogger.error("Twitter login error:", {
                    error: twitterError.message,
                    stack: twitterError.stack,
                    hasEmail: !!email,
                    has2FA: !!twitter2faSecret
                });
                throw twitterError;
            }

            const botPortalAddress = runtime.getSetting("BOT_PORTAL_ADDRESS");
            if (!botPortalAddress) {
                const error = new Error("BOT_PORTAL_ADDRESS is not configured");
                elizaLogger.error("Configuration error:", {
                    missing: "BOT_PORTAL_ADDRESS",
                    error: error.message
                });
                throw error;
            }
            elizaLogger.debug("Bot portal configuration loaded:", { address: botPortalAddress });

            // Fetch TweetReplyEvents from Aptos
            elizaLogger.info("Fetching TweetReplyEvents from Aptos...");
            let events;
            try {
                events = await aptosClient.getEventsByEventHandle({
                    address: botPortalAddress,
                    eventHandleStruct: `${botPortalAddress}::BotPortal::actions::TweetReplyEvent`,
                    fieldName: "tweet_reply_events",
                });
            } catch (fetchError) {
                elizaLogger.error("Failed to fetch events from Aptos:", {
                    error: fetchError.message,
                    botPortalAddress,
                    network: DEFAULT_NETWORK,
                    fullnode: networkConfig.fullnode,
                    stack: fetchError.stack
                });
                throw fetchError;
            }

            if (!Array.isArray(events)) {
                const error = new Error("Unexpected response format: events is not an array");
                elizaLogger.error("Event format error:", {
                    receivedType: typeof events,
                    events,
                    error: error.message
                });
                throw error;
            }

            elizaLogger.info("TweetReplyEvents fetched successfully", { 
                eventCount: events.length,
                network: DEFAULT_NETWORK
            });

            // Track processed tweet links to avoid duplicates
            const processedTweets = new Set();
            let processedCount = 0;
            let errorCount = 0;

            for (const event of events) {
                try {
                    if (!event || !event.data) {
                        elizaLogger.warn("Skipping malformed event:", {
                            event,
                            reason: !event ? "null event" : "missing data"
                        });
                        continue;
                    }

                    const eventData: TweetReplyEvent = event.data;
                    elizaLogger.debug("Processing event:", {
                        tweetLink: eventData.tweet_link,
                        user: eventData.user,
                        status: eventData.status
                    });

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
                        processedCount++;
                        elizaLogger.info(`Successfully processed tweet reply for ${eventData.tweet_link}`, {
                            user: eventData.user,
                            processedCount
                        });
                    }
                } catch (eventError) {
                    errorCount++;
                    elizaLogger.error('Failed to process tweet reply event:', {
                        error: eventError.message,
                        stack: eventError.stack,
                        eventData: event.data,
                        errorCount
                    });
                }
            }

            elizaLogger.info("Tweet reply processing complete", {
                totalEvents: events.length,
                processedCount,
                errorCount,
                skippedCount: events.length - processedCount - errorCount
            });

        } catch (error) {
            elizaLogger.error('Fatal error in tweet reply listener:', {
                error: error.message,
                stack: error.stack,
                type: error.constructor.name
            });
            throw error; // Re-throw to ensure the error is properly handled by the runtime
        }
    }
};
