import { Plugin } from '@elizaos/core';
import { EthereumAnalytics } from './providers/analytics';
import { analyzeWallet } from './actions/analyze';

export default class EthereumPlugin implements Plugin {
  name = 'ethereum';
  providers = {
    analytics: EthereumAnalytics
  };
  actions = {
    analyzeWallet
  };
}