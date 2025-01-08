import { Action } from '@elizaos/core';

export const analyzeWallet: Action = {
  name: 'analyzeWallet',
  description: 'Analyze an Ethereum wallet address for transaction history and balances',
  parameters: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Ethereum wallet address to analyze'
      },
      days: {
        type: 'number',
        description: 'Number of days of history to analyze',
        default: 30
      },
      includeTokens: {
        type: 'boolean',
        description: 'Include token balances in the analysis',
        default: true
      }
    },
    required: ['address']
  },

  async execute({ address, days, includeTokens }, { providers }) {
    const analytics = providers.get('analytics');

    const [balance, transactions, tokenBalances] = await Promise.all([
      analytics.getWalletBalance(address),
      analytics.getTransactionHistory(address),
      includeTokens ? analytics.getAllCommonTokenBalances(address) : Promise.resolve([])
    ]);

    // Calculate analytics as before
    const txCount = transactions.length;
    const totalSent = transactions
      .filter(tx => tx.from.toLowerCase() === address.toLowerCase())
      .reduce((sum, tx) => sum + parseFloat(tx.value), 0);
    const totalReceived = transactions
      .filter(tx => tx.to?.toLowerCase() === address.toLowerCase())
      .reduce((sum, tx) => sum + parseFloat(tx.value), 0);

    return {
      address,
      currentBalance: balance,
      tokenBalances: tokenBalances.map(token => ({
        symbol: token.symbol,
        name: token.name,
        balance: token.balance,
        address: token.tokenAddress
      })),
      transactionCount: txCount,
      totalSent,
      totalReceived,
      recentTransactions: transactions.slice(0, 10)
    };
  }
};