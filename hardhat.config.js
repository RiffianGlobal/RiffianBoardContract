// require('@nomicfoundation/hardhat-toolbox');
require('dotenv/config');
require('@openzeppelin/hardhat-upgrades');
require('@nomiclabs/hardhat-truffle5');
require('solidity-coverage');
require('@nomicfoundation/hardhat-chai-matchers');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

function accounts() {
  privatekey = process.env.PrivateKey;
  if (!privatekey)
    return {
      mnemonic: 'test test test test test test test test test test test junk',
    };
  return [privatekey];
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // defaultNetwork: 'localhost',
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
      // accounts: accounts(),
      timeout: 1000000000,
    },
    goerli: {
      gasPrice: 3000000000,
      url: process.env.NETWORK_INFURA_URL_GOERLI,
      accounts: accounts(),
    },
    rifftestnet: {
      // gasPrice: 3000000000,
      url: process.env.NETWORK_RIFFTESTNET,
      accounts: accounts(),
    },
    ftmtestnet: {
      gasPrice: 3000000000,
      url: process.env.NETWORK_INFURA_URL_FANTOMTESTNET,
      accounts: accounts(),
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY ?? 'no_key',
    customChains: [
      {
        network: 'ftmtestnet',
        chainId: 0xfa2,
        urls: {
          apiURL: 'https://api-testnet.ftmscan.com/api',
          browserURL: 'https://testnet.ftmscan.com',
        },
      },
      {
        network: 'rifftestnet',
        chainId: 0xdddd,
        urls: {
          apiURL: 'https://scan.testnet.doid.tech/api',
          browserURL: 'https://scan.testnet.doid.tech',
        },
      },
    ],
  },
  solidity: {
    compilers: [
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
};
