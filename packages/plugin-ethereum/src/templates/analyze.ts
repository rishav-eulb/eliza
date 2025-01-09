export const walletAnalysisTemplate = {
  basic: (data: {
    address: string;
    balance: string;
  }) => `
I've analyzed the Ethereum wallet ${data.address}:

Current Balance: ${data.balance} ETH

This wallet's balance was fetched from the Ethereum mainnet using the latest block data.`,
};