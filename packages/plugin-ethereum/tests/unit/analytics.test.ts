import { expect } from 'chai';
import { ethers } from 'ethers';
import { EthereumAnalytics } from '../../src/providers/analytics';

describe('EthereumAnalytics', () => {
  let analytics: EthereumAnalytics;

  beforeEach(() => {
    analytics = new EthereumAnalytics({
      rpcUrl: 'http://localhost:8545' // Use local test node
    });
  });

  describe('getWalletBalance', () => {
    it('should return formatted balance', async () => {
      const mockProvider = {
        getBalance: async () => ethers.BigNumber.from('1000000000000000000') // 1 ETH
      };

      // @ts-ignore - Mock provider
      analytics.provider = mockProvider;

      const balance = await analytics.getWalletBalance('0x1234...');
      expect(balance).to.equal('1.0');
    });
  });

  describe('getTokenBalance', () => {
    it('should return token balance with correct decimals', async () => {
      const mockContract = {
        balanceOf: async () => ethers.BigNumber.from('1000000'), // 1 token with 6 decimals
        decimals: async () => 6,
        symbol: async () => 'TEST',
        name: async () => 'Test Token'
      };

      // @ts-ignore - Mock ethers Contract
      ethers.Contract = jest.fn().mockImplementation(() => mockContract);

      const balance = await analytics.getTokenBalance(
        '0x1234...',
        '0x5678...'
      );

      expect(balance).to.deep.equal({
        tokenAddress: '0x5678...',
        symbol: 'TEST',
        name: 'Test Token',
        decimals: 6,
        rawBalance: '1000000',
        balance: '1.0'
      });
    });
  });
});