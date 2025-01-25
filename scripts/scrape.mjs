import { Scraper } from "agent-twitter-client";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const OUTPUT_DIR = "twitter_data";
const TWEETS_FILE = `${OUTPUT_DIR}/tweets.json`;
const REPLIES_FILE = `${OUTPUT_DIR}/replies.json`;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

// Helper function to save data to file
const saveToFile = (filename, data) => {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
};

// Helper function to load existing data from file
const loadFromFile = (filename) => {
    if (fs.existsSync(filename)) {
        return JSON.parse(fs.readFileSync(filename, "utf-8"));
    }
    return [];
};

async function scrapeUserTwitterData(username, maxTweets = 3200) {
    try {
        const scraper = new Scraper();

        // Login
        await scraper.login(
            process.env.TWITTER_USERNAME,
            process.env.TWITTER_PASSWORD
        );

        if (!(await scraper.isLoggedIn())) {
            throw new Error("Login failed. Check credentials.");
        }

        console.log("Successfully logged in to Twitter");

        // Load existing data
        let existingTweets = loadFromFile(TWEETS_FILE);
        let existingReplies = loadFromFile(REPLIES_FILE);

        // Get user ID first
        const userIdResult = await scraper.getUserIdByScreenName(username);
        if (!userIdResult.success) {
            throw new Error(`Failed to get user ID for ${username}`);
        }
        const userId = userIdResult.value;

        // 1. Fetch regular tweets and retweets
        console.log("Fetching tweets and retweets...");
        const tweets = scraper.getTweetsByUserId(userId, maxTweets);
        for await (const tweet of tweets) {
            if (!existingTweets.some(t => t.id === tweet.id)) {
                existingTweets.push({
                    id: tweet.id,
                    type: tweet.isRetweet ? 'retweet' : 'tweet',
                    text: tweet.text,
                    createdAt: tweet.createdAt,
                    metrics: {
                        retweets: tweet.retweets,
                        likes: tweet.likes,
                        replies: tweet.replies,
                        views: tweet.views
                    },
                    urls: tweet.urls,
                    hashtags: tweet.hashtags,
                    mentions: tweet.mentions,
                    photos: tweet.photos,
                    videos: tweet.videos
                });

                // Save periodically
                if (existingTweets.length % 100 === 0) {
                    saveToFile(TWEETS_FILE, existingTweets);
                    console.log(`Saved ${existingTweets.length} tweets`);
                }
            }
        }

        // 2. Fetch tweets and replies
        console.log("Fetching replies...");
        const tweetsAndReplies = scraper.getTweetsAndRepliesByUserId(userId, maxTweets);
        for await (const reply of tweetsAndReplies) {
            if (!existingReplies.some(r => r.id === reply.id)) {
                existingReplies.push({
                    id: reply.id,
                    type: 'reply',
                    text: reply.text,
                    createdAt: reply.createdAt,
                    metrics: {
                        retweets: reply.retweets,
                        likes: reply.likes,
                        replies: reply.replies,
                        views: reply.views
                    },
                    inReplyToTweetId: reply.conversationId,
                    urls: reply.urls,
                    hashtags: reply.hashtags,
                    mentions: reply.mentions,
                    photos: reply.photos,
                    videos: reply.videos
                });

                // Save periodically
                if (existingReplies.length % 100 === 0) {
                    saveToFile(REPLIES_FILE, existingReplies);
                    console.log(`Saved ${existingReplies.length} replies`);
                }
            }
        }

        // Final save
        saveToFile(TWEETS_FILE, existingTweets);
        saveToFile(REPLIES_FILE, existingReplies);

        console.log("\nScraping completed successfully!");
        console.log(`Total tweets/retweets: ${existingTweets.length}`);
        console.log(`Total replies: ${existingReplies.length}`);

        // Logout
        await scraper.logout();
        console.log("Logged out successfully");

    } catch (error) {
        console.error("Error during scraping:", error);
        throw error;
    }
}

// Usage
const targetUsername = "@rishavj39";
scrapeUserTwitterData(targetUsername)
    .catch(error => {
        console.error("Script failed:", error);
        process.exit(1);
    });