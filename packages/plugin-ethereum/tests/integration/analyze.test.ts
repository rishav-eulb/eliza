import { expect } from 'chai';
import { createAgent } from '@elizaos/core';
import EthereumPlugin from '../../src';

describe('Ethereum Plugin Integration', () => {
  let agent;
  const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

  before(async () => {
    // Make sure to set INFURA_KEY in env for tests
    const rpcUrl = `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`;

    agent = createAgent({
      plugins: [
        new EthereumPlugin({ rpcUrl })
      ]
    });
  });

  describe('analyzeWallet action', () => {
    it('should analyze wallet without tokens', async () => {
      const result = await agent.actions.analyzeWallet({
        address: TEST_ADDRESS,
        includeTokens: false
      });

      expect(result).to.have.property('address', TEST_ADDRESS);
      expect(result).to.have.property('currentBalance');
      expect(result).to.have.property('transactionCount');
      expect(result).to.have.property('totalSent');
      expect(result).to.have.property('totalReceived');
      expect(result).to.have.property('recentTransactions');
    });

    it('should analyze wallet with tokens', async () => {
      const result = await agent.actions.analyzeWallet({
        address: TEST_ADDRESS,
        includeTokens: true
      });

      expect(result).to.have.property('tokenBalances');
      expect(result.tokenBalances).to.be.an('array');

      if (result.tokenBalances.length > 0) {
        const token = result.tokenBalances[0];
        expect(token).to.have.property('symbol');
        expect(token).to.have.property('balance');
        expect(token).to.have.property('address');
      }
    });
  });
});