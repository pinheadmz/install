
const path = (options) => {
  return [
    {
      type: 'input',
      name: 'path',
      message: 'Select ezbcoin path: ',
      default: options.defaultPath
    }
  ]
}

const lib = (options) => {
  return [
    {
      type: 'list',
      name: 'library',
      message: 'Choose a library to install: ',
      choices: ['bcoin', 'bcash', 'hsd']
    }
  ]
}

const node = (options) => {
  return [
    {
      type: 'list',
      name: 'network',
      message: 'Choose a network to run on: ',
      choices:
        options.library === 'hsd' ?
          ['testnet', 'regtest', 'simnet'] :
          ['main', 'testnet', 'regtest', 'simnet']
    },
    {
      type: 'list',
      name: 'node',
      message: 'Choose a type of node: ',
      choices: 
        options.library === 'bcoin' ?
          ['full', 'prune', 'SPV', 'Neutrino'] :
          ['full', 'prune', 'SPV']
    },
    {
      type: 'list',
      name: 'wallet',
      message: 'Choose a type of wallet: ',
      choices: ['bwallet', 'bmultisig', 'none']
    }
  ];
}

const bpanel = (options) => {
  return [
    {
      type: 'confirm',
      name: 'bpanel',
      message: 
        options.installedLibs.includes('bpanel') ?
          'Would you like to connect this node to bPanel? ' :
          'Would you like to install and connect to bPanel? ',
      default: true
    }
  ]
}

module.exports = {
  path,
  lib,
  node,
  bpanel
};
