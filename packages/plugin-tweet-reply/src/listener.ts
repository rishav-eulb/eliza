import { IAgentRuntime, Service, ServiceType, elizaLogger } from "@elizaos/core";
import { Event, AptosConfig, Network, Aptos } from "@aptos-labs/ts-sdk";
import { Scraper } from "agent-twitter-client";
import { Memory } from "@elizaos/core";
import { DEFAULT_NETWORK, MOVEMENT_NETWORK_CONFIG } from "./constants";
import { fetchBlocksWithEvents, BlockFetcherConfig, TweetReplyEvent } from './block-fetcher';

// Store last processed block height
// let lastProcessedHeight = 7620233; // Starting block height
const POLLING_INTERVAL = 5000; // 5 seconds

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
                        network: Network.CUSTOM,
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

            // Assuming 'aptosClient' is an instance of the 'Aptos' class
            console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(aptosClient)));
   

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

            // Start continuous event monitoring
            while (true) {
                try {
                    const blockFetcherConfig: BlockFetcherConfig = {
                        startHeight: await getLastProcessedHeight(runtime),
                        batchSize: 100,
                        maxRetries: 3,
                        retryDelay: 1000,
                        endHeight: await getLastProcessedHeight(runtime) + 100
                    };

                    const events = await fetchBlocksWithEvents(
                        aptosClient,
                        botPortalAddress,
                        blockFetcherConfig
                    );

                    if (events.length > 0) {
                        elizaLogger.info("Processing new events", {
                            startBlock: await getLastProcessedHeight(runtime),
                            endBlock: blockFetcherConfig.endHeight,
                            eventCount: events.length
                        });

                        for (const event of events) {
                            try {
                                if (!event || !event.data) {
                                    elizaLogger.warn("Skipping malformed event:", {
                                        event,
                                        reason: !event ? "null event" : "missing data"
                                    });
                                    continue;
                                }

                                const eventData = event.data as TweetReplyEvent;
                                
                                // Check if event was already processed by querying the chain
                                const isProcessed = await checkEventProcessed(aptosClient, eventData, botPortalAddress);
                                
                                if (eventData.status === "PENDING" && !isProcessed) {
                                    const memory = {
                                        content: {
                                            tweet_link: eventData.tweet_link,
                                            user: eventData.user,
                                            text: `Reply to tweet: ${eventData.tweet_link} for user ${eventData.user}`,
                                            action: "TWEET_REPLY"
                                        },
                                        userId: runtime.agentId,
                                        agentId: runtime.agentId,
                                        roomId: runtime.agentId
                                    };

                                    await runtime.processActions(memory, [memory]);
                                }
                            } catch (eventError) {
                                elizaLogger.error('Failed to process tweet reply event:', {
                                    error: eventError.message,
                                    stack: eventError.stack,
                                    eventData: event.data
                                });
                            }
                        }
                    }

                    // Update last processed height
                    let lastProcessedHeight = blockFetcherConfig.endHeight!;
                    await updateLastProcessedHeight(runtime, lastProcessedHeight);

                    // Wait before next polling
                    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));

                } catch (error) {
                    elizaLogger.error('Error in event polling loop:', {
                        error: error.message,
                        stack: error.stack
                    });
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
                }
            }

        } catch (error) {
            elizaLogger.error('Fatal error in tweet reply listener:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
};

// Helper function to check if an event was already processed
async function checkEventProcessed(aptosClient: Aptos, event: TweetReplyEvent, botPortalAddress: string): Promise<boolean> {
    try {
        // Query the chain for the event status
        const eventStatus = await aptosClient.view({
            payload: {
                function: `${botPortalAddress}::actions::get_event_status`,
                typeArguments: [],
                functionArguments: [event.tweet_link]
            }
        });
        return eventStatus[0] === "COMPLETED";
    } catch (error) {
        elizaLogger.error('Error checking event status:', {
            error: error.message,
            tweetLink: event.tweet_link
        });
        return false;
    }
}

// Add a function to get the last processed height
async function getLastProcessedHeight(runtime: IAgentRuntime): Promise<number> {
    const stored = await runtime.getSetting("LAST_PROCESSED_HEIGHT");
    if (!stored) {
        // If no height is stored, start from a default height
        const defaultHeight = 7620233;
        await runtime.setSetting("LAST_PROCESSED_HEIGHT", defaultHeight.toString());
        return defaultHeight;
    }
    return parseInt(stored, 10);
}

// Add a function to update the last processed height
async function updateLastProcessedHeight(runtime: IAgentRuntime, height: number): Promise<void> {
    await runtime.setSetting("LAST_PROCESSED_HEIGHT", height.toString());
}
