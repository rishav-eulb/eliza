import { ethers } from 'ethers';
import { Provider, IAgentRuntime, Memory, State } from '@elizaos/core';
import { TokenBalance, ERC20_ABI } from '../types/token';

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  blockNumber: number;
}

export class EthereumAnalytics implements Provider {
  private provider: ethers.providers.JsonRpcProvider;

  constructor(config: { rpcUrl: string }) {
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  }

  async get(runtime: IAgentRuntime, message: Memory, state?: State): Promise<any> {
    return this.provider;
  }

  async getTransactionHistory(
    address: string,
    fromBlock: number = 20783522,
    limit: number = 1
  ): Promise<Transaction[]> {
    try {
      const batchSize = 100;
     // const currentBlock = await this.provider.getBlockNumber();
     const currentBlock = 20783625;
      let allLogs: ethers.providers.Log[] = [];

      for (let batchStart = fromBlock; batchStart <= currentBlock; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize - 1, currentBlock);
        const logs = await this.provider.getLogs({
          address,
          fromBlock: batchStart,
          toBlock: batchEnd,
        });

        allLogs = allLogs.concat(logs);

        if (allLogs.length >= limit) {
          allLogs = allLogs.slice(0, limit);
          break;
        }
      }

      const txHashes = [...new Set(allLogs.map(log => log.transactionHash))];
      const transactions = await Promise.all(
        txHashes.map(async hash => {
          const tx = await this.provider.getTransaction(hash);
          const block = await this.provider.getBlock(tx.blockNumber!);
          return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to!,
            value: ethers.utils.formatEther(tx.value),
            timestamp: block.timestamp,
            blockNumber: tx.blockNumber!
          };
        })
      );

      return transactions;
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }
  }

  async getWalletBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.utils.formatEther(balance);
  }

  async getTokenBalance(walletAddress: string, tokenAddress: string): Promise<TokenBalance> {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

    const [balance, decimals, symbol, name] = await Promise.all([
      tokenContract.balanceOf(walletAddress),
      tokenContract.decimals(),
      tokenContract.symbol(),
      tokenContract.name()
    ]);

    return {
      tokenAddress,
      symbol,
      name,
      decimals,
      rawBalance: balance.toString(),
      balance: ethers.utils.formatUnits(balance, decimals)
    };
  }

  async getTokenBalances(address: string, tokenAddresses: string[]): Promise<TokenBalance[]> {
    const balancePromises = tokenAddresses.map(tokenAddress =>
      this.getTokenBalance(address, tokenAddress)
        .catch(error => {
          console.error(`Error fetching balance for token ${tokenAddress}:`, error);
          return null;
        })
    );

    const balances = await Promise.all(balancePromises);
    return balances.filter((balance): balance is TokenBalance => balance !== null);
  }

  // Optional: Add common token addresses for major networks
  private getCommonTokens(networkId: number): string[] {
    const COMMON_TOKENS = {
      1: [ // Ethereum Mainnet
        // '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
        // '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
        // '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
        // '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
        // '0x514910771af9ca656af840dff83e8264ecf986ca'  // LINK
      ],
      // Add other networks as needed
    };
    return COMMON_TOKENS[networkId] || [];
  }

  async getAllCommonTokenBalances(address: string): Promise<TokenBalance[]> {
    const networkId = (await this.provider.getNetwork()).chainId;
    const commonTokens = this.getCommonTokens(networkId);
    return this.getTokenBalances(address, commonTokens);
  }
}