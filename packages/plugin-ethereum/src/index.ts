import { Plugin } from '@elizaos/core';
import { EthereumAnalytics } from './providers/analytics';
import { analyzeWallet } from './actions/analyze';

export const ethereumPlugin: Plugin = {
  name: 'ethereum',
  description: 'Plugin for Ethereum analytics and wallet analysis',
  actions: [analyzeWallet],
  providers: [new EthereumAnalytics({ rpcUrl: 'https://mainnet.infura.io/v3/bf46c8ba51a74962930bcf1a1c63bcbf' })],
  services: [],
  clients: [],
};