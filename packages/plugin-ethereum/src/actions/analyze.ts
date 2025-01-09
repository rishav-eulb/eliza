import { Action, IAgentRuntime, Memory, ActionExample } from '@elizaos/core';
import { EthereumAnalytics } from '../providers/analytics';
import { walletAnalysisTemplate } from '../templates/analyze';

interface AnalyzeParams {
  address: string;
  days?: number;
  includeTokens?: boolean;
}

export const analyzeWallet: Action = {
  name: 'analyzeWallet',
  description: 'Analyze an Ethereum wallet address for transaction history and balances',
  similes: ['examine', 'inspect', 'review'],
  examples: [[
    {
      user: "{{user1}}",
      content: { text: "analyze wallet 0x123...", action: "analyzeWallet" }
    }
  ]],
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: any,
    options?: any,
    callback?: (content: { text: string, action?: string }) => void
  ) => {
    try {
        // Send initial response
        callback?.({
            text: "Let's take a look at that wallet. Analyzing now...",
            action: "analyzeWallet"
        });

        // Extract address from message content
        const words = message.content?.text?.split(' ') || [];
        const address = words.find(word => word.startsWith('0x') && word.length === 42);

        if (!address) {
            throw new Error('Address is undefined. Please provide a valid Ethereum address.');
        }

        console.log("Executing analyzeWallet with address:", address);
        const analytics = runtime.providers.find(p => p instanceof EthereumAnalytics) as EthereumAnalytics;
        if (!analytics) throw new Error('Analytics provider not found');

        const balance = await analytics.getWalletBalance(address);
        console.log("Retrieved balance:", balance);

        const analysisResponse = walletAnalysisTemplate.basic({
            address,
            balance
        });
        console.log("Formatted response:", analysisResponse);

        // Send the analysis response
        callback?.({
            text: analysisResponse,
            action: "analyzeWallet"
        });

        return { success: true };
    } catch (error) {
        console.error("Error in analyzeWallet handler:", error);
        throw error;
    }
  },
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    const hasAnalyzeIntent = text.includes('analyze') ||
                           text.includes('examine') ||
                           text.includes('inspect') ||
                           text.includes('check') ||
                           text.includes('look at');

    const words = message.content?.text?.split(' ') || [];
    const address = words.find(word => word.startsWith('0x') && word.length === 42);

    // Add debug logging
    console.log('Validate analyzeWallet:', {
      text,
      hasAnalyzeIntent,
      address,
      content: message.content
    });

    if (hasAnalyzeIntent && address) {
        // Ensure we're setting both text and action in content
        message.content = {
            text: message.content?.text || '',
            action: 'analyzeWallet'
        };
        return true;
    }
    return false;
  }
};