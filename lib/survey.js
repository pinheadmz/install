
const lib = (libOptions) => {
  return [
    {
      type: 'input',
      name: 'path',
      message: 'Select ezbcoin path: ',
      default: libOptions.defaultPath
    },
    {
      type: 'list',
      name: 'library',
      message: 'Choose a library to install: ',
      choices: ['bcoin', 'bcash', 'handshake']
    },
    {
      type: 'list',
      name: 'network',
      message: 'Choose a network to run on: ',
      choices: ['main', 'testnet', 'regtest', 'simnet']
    },
    {
      type: 'list',
      name: 'node',
      message: 'Choose a type of node: ',
      choices: ['full', 'prune', 'SPV', 'Neutrino']
    },
    {
      type: 'confirm',
      name: 'wallet',
      message: 'Would you like to run with a wallet? ',
      default: true
    }
  ];
}

const bpanel = (bpanelOptions) => {
  return [
    {
      type: 'confirm',
      name: 'bpanel',
      message: 
        bpanelOptions.bPanelInstalled ?
          'Would you like to connect this node to bPanel? ' :
          'Would you like to install and connect to bPanel? ',
      default: true
    }
  ]
}

module.exports = {
  lib,
  bpanel
};
