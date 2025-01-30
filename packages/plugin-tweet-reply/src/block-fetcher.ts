import { Event, Aptos } from "@aptos-labs/ts-sdk";
import { elizaLogger } from "@elizaos/core";

export interface BlockFetcherConfig {
    startHeight: number;
    batchSize: number;
    maxRetries: number;
    retryDelay: number; // in milliseconds
    endHeight?: number;  // Add optional end height
}

export interface TweetReplyEvent {
    user: string;
    tweet_link: string;
    status: string;
    amount_paid: string;
}

export async function fetchBlocksWithEvents(
    aptosClient: Aptos,
    botPortalAddress: string,
    config: BlockFetcherConfig
): Promise<Event[]> {
    const events: Event[] = [];
    let currentHeight = config.startHeight;
    let retryCount = 0;

    while (currentHeight <= (config.endHeight || currentHeight + config.batchSize)) {
        try {
            elizaLogger.debug("Fetching block at height:", { height: currentHeight });
            
            const block = await aptosClient.getBlockByHeight({
                blockHeight: currentHeight,
                options: {
                    withTransactions: true
                }
            });

            if (!block.transactions) {
                elizaLogger.debug("No transactions in block", { height: currentHeight });
                currentHeight++;
                continue;
            }

            // Filter transactions for TweetReplyEvents
            for (const tx of block.transactions) {
                if ('events' in tx && tx.events) {
                    const tweetReplyEvents = tx.events.filter(event => 
                        event.type === `${botPortalAddress}::actions::TweetReplyEvent`
                    );

                    if (tweetReplyEvents.length > 0) {
                        elizaLogger.info("Found TweetReplyEvents in block", {
                            height: currentHeight,
                            count: tweetReplyEvents.length
                        });
                        events.push(...tweetReplyEvents);
                    }
                }
            }

            if (currentHeight >= (config.endHeight || currentHeight + config.batchSize)) {
                return events;
            }
            
            currentHeight++;
            retryCount = 0;

        } catch (error) {
            retryCount++;
            elizaLogger.error("Error fetching block", {
                height: currentHeight,
                error: error.message,
                retry: `${retryCount}/${config.maxRetries}`
            });

            if (retryCount >= config.maxRetries) {
                throw new Error(`Max retries (${config.maxRetries}) exceeded while fetching block ${currentHeight}`);
            }

            await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }
    }
    return events;
} 
