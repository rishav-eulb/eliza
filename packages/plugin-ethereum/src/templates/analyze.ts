export const walletAnalysisTemplate = {
  basic: (data: {
    address: string;
    balance: string;
    txCount: number;
    sent: string;
    received: string;
  }) => `
Wallet Analysis Results for ${data.address}:
Current Balance: ${data.balance} ETH
Total Transactions: ${data.txCount}
Total Sent: ${data.sent} ETH
Total Received: ${data.received} ETH
`,

  detailed: (data: {
    address: string;
    balance: string;
    txCount: number;
    sent: string;
    received: string;
    tokens: Array<{ symbol: string; balance: string }>;
    recentTx: Array<{ hash: string; value: string }>;
  }) => `
Detailed Wallet Analysis for ${data.address}

ETH Balance: ${data.balance} ETH
Transaction Count: ${data.txCount}
Total Sent: ${data.sent} ETH
Total Received: ${data.received} ETH

Token Balances:
${data.tokens.map(token => `${token.symbol}: ${token.balance}`).join('\n')}

Recent Transactions:
${data.recentTx.map(tx => `${tx.hash}: ${tx.value} ETH`).join('\n')}
`
};