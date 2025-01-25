import { Action, IAgentRuntime, Memory, HandlerCallback, Content } from "@elizaos/core";
import { BrowserService } from "../services/browser";
import { ServiceType } from "@elizaos/core";

export const browseUrl: Action = {
    name: "BROWSE_URL",
    similes: ["visit url", "check website", "open link"],
    description: "Browse a URL and extract its content",
    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const urlPattern = /(?:https?:\/\/)?(?:www\.)?[^\s]+\.[^\s]+/i;
        return urlPattern.test(message.content?.text ?? '');
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: any, options: any, callback: HandlerCallback): Promise<void> => {
        try {
            const browserService = runtime.getService(ServiceType.BROWSER) as BrowserService;
            if (!browserService) {
                throw new Error('Browser service not available');
            }

            const urlMatch = message.content?.text?.match(/(?:https?:\/\/)?(?:www\.[^\s]+\.[^\s]+)/)?.[0];
            if (!urlMatch) {
                throw new Error('No valid URL found in message');
            }

            const url = urlMatch.startsWith('http') ? urlMatch : `https://${urlMatch}`;

            // Initialize browser before fetching content
            await browserService.initializeBrowser();

            const content = await browserService.getPageContent(url, runtime);

            if (!content || !content.description) {
                throw new Error('Failed to fetch content');
            }

            callback({ text: `Here's what I found at ${url}:\n${content.description}` });
        } catch (error) {
            callback({ text: `Sorry, I couldn't fetch the content: ${error.message}` });
        } finally {
            // Clean up browser resources
            const browserService = runtime.getService(ServiceType.BROWSER) as BrowserService;
            if (browserService) {
                await browserService.closeBrowser();
            }
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Can you check what's on https://example.com?" },
            },
            {
                user: "{{user2}}",
                content: { text: "Here's what I found at https://example.com:\nThis is an example website used for illustrative purposes.", action: "BROWSE_URL" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Visit http://news.example.com/latest and tell me what you see" },
            },
            {
                user: "{{user2}}",
                content: { text: "Here's what I found at http://news.example.com/latest:\nLatest news and updates from around the world.", action: "BROWSE_URL" },
            },
        ]
    ]
};
