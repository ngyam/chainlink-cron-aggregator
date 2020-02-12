const fs = require('fs');
const path = require('path');
const HDWalletProvider = require('truffle-hdwallet-provider');
const cwd = path.resolve('.');
require("dotenv").config();

module.exports = {
  networks: {
    development: {
      provider: () => new HDWalletProvider(process.env.PRIVATE_KEY.trim(), 'http://localhost:8545'),
      gasPrice: "1",
      port: 8545,
      gas: 6000000,
      network_id: "*"
    },

    volta: {
      network_id: "73799",
      gasPrice: "1",
      confirmations: 1,
      from: process.env.FROM,
      provider: () => new HDWalletProvider(process.env.PRIVATE_KEY.trim(), 'https://volta-rpc.energyweb.org'),
      production: true
    },

    ewc: {
      network_id: "246",
      gasPrice: "1",
      confirmations: 1,
      from: process.env.FROM,
      provider: () => new HDWalletProvider(process.env.PRIVATE_KEY.trim(), 'https://rpc.energyweb.org'),
      production: true
    },
  },
  compilers: {
     solc: {
       version: "0.4.24"
     }
  },
  plugins: ["solidity-coverage"]
};
