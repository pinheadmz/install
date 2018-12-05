#!/usr/bin/env node

'use strict'

const bcrypto = require('bcrypto');
const Path = require('path');
const fs = require('fs');
const os = require('os');
const child_process = require('child_process');
const inquirer = require('inquirer');

const libs = {
  bcoin: {
    repo: 'https://github.com/bcoin-org/bcoin',
    chain: 'bitcoin'
  },
  bcash: {
    repo: 'https://github.com/bcoin-org/bcash',
    chain: 'bitcoincash'
  },
  hsd: {
    repo: 'https://github.com/handshake-org/hsd',
    chain: 'handshake'
  },
  bpanel: {
    repo: 'https://github.com/bpanel-org/bpanel',
  }
};

const {
  lib,
  node,
  bpanel
} = require('./lib/survey');

let options = {};
(async () => {

  /**
   * USER CONFIG SURVEY
   */

  console.log('\n***\nWelcome to EZ bcoin installer!\n***\n');

  const defaultPath = Path.join(__dirname, 'app');
  options = { defaultPath: defaultPath };

  const libAnswers = await inquirer.prompt(lib(options));
  options = { ...options, ...libAnswers };
  options.installedLibs = listDir(Path.join(options.path, 'libs'));  

  const nodeAnswers = await inquirer.prompt(node(options));
  options = { ...options, ...nodeAnswers };

  const bpanelAnswers = await inquirer.prompt(bpanel(options));
  options = { ...options, ...bpanelAnswers };

  // Create app directory and subdirs
  const pathApp = options.path
  const pathLibs = Path.join(pathApp, 'libs');
  const pathPIDLocks = Path.join(pathApp, 'pidlocks');
  const pathData = Path.join(pathApp, 'data');
  makeIfNone(pathApp);
  makeIfNone(pathLibs);
  makeIfNone(pathPIDLocks);
  makeIfNone(pathData);

  /**
   * WRITE CONF FILES
   */

   console.log('\nWriting configuration files...');

  // note: SPV is not a valid config file option, but we'll use it internally
  const libOpts = {
    api_key: bcrypto.random.randomBytes(32).toString('hex'),
    network: options.network,
    prune: options.node === 'prune',
    spv: options.node === 'spv',
    wallet_auth: true
  };
  const walletOpts = {
    api_key: bcrypto.random.randomBytes(32).toString('hex')
  };

  const conflict =
    (options.library === 'bcoin' && 
      options.installedLibs.indexOf('bcash') >= 0) ||
    (options.library === 'bcash' &&
      options.installedLibs.indexOf('bcoin') >= 0);

  if (conflict) {
    switch (options.network) {
      case 'main':
        libOpts.port = 8033;
        libOpts.public_port = 8033;
        libOpts.http_port = 8032;
        walletOpts.http_port = 8034;
        break;
      case 'testnet':
        libOpts.port = 18033;
        libOpts.public_port = 18033;
        libOpts.http_port = 18032;
        walletOpts.http_port = 18034;
        break;
      case 'regtest':
        libOpts.port = 48033;
        libOpts.public_port = 48033;
        libOpts.http_port = 48032;
        walletOpts.http_port = 48034;
        break;
      case 'simnet':
        libOpts.port = 18055;
        libOpts.public_port = 18055;
        libOpts.http_port = 18056;
        walletOpts.http_port = 18058;
        break;
    }
  }

  // create directory for this lib
  const pathThisData = Path.join(pathData, options.library);
  makeIfNone(pathThisData);

  // print conf file for this lib
  const confString = configFileFromObject(libOpts);
  fs.writeFileSync(
    Path.join(pathThisData, options.library + '.conf'),
    confString
  );

  // create directory for this lib's network
  const pathThisNetwork = Path.join(pathThisData, options.network);
  makeIfNone(pathThisNetwork);

  // print wallet conf file -- maybe it never gets used but here it is
  const walletConfString = configFileFromObject(walletOpts);
  fs.writeFileSync(
    Path.join(pathThisNetwork, 'wallet.conf'),
    walletConfString
  );  

  // create directory for bpanel
  const pathBpanel = Path.join(pathData, 'bpanel');
  const pathBpanelClients = Path.join(pathBpanel, 'clients');
  makeIfNone(pathBpanel);
  makeIfNone(pathBpanelClients);

  // print bpanel client conf file -- maybe we never use it but here it is
  const bPanelOpts = {
    api_key: libOpts.api_key,
    wallet_api_key: walletOpts.api_key,
    network: libOpts.network,
    chain: libs[options.library].chain
  };

  if (conflict) {
    bPanelOpts.port = libOpts.http_port;
    bPanelOpts.wallet_port = walletOpts.http_port;
  }

  const bpanelConfString = configFileFromObject(bPanelOpts);
  fs.writeFileSync(
    Path.join(pathBpanelClients, options.library + '.conf'),
    bpanelConfString
  );
  // TODO: this is just a hard-coded plugin list
  fs.copyFileSync('lib/config.js', Path.join(pathBpanel, 'config.js'));
  // TODO: need to get wallet token and insert it, after node and wallet are up

  /**
   * DOWNLOAD LIBRARIES
   */

  console.log('\nDownloading from GitHub: ' + options.library + '...');

  child_process.spawnSync(
    'git',
    ['clone', libs[options.library].repo],
    {cwd: pathLibs}
  );

  if (options.bpanel && options.installedLibs.indexOf('bpanel') === -1) {
    console.log('\nDownloading from GitHub: bPanel...');
  
    child_process.spawnSync(
      'git',
      ['clone', libs['bpanel'].repo],
      {cwd: pathLibs}
    );
  }

  /**
   * NPM INSTALL
   */

  console.log('\nInstalling: ' + options.library + '...');

  child_process.spawnSync(
    'npm',
    ['install'],
    {cwd: Path.join(pathLibs, options.library)}
  );

  if (options.bpanel && options.installedLibs.indexOf('bpanel') === -1) {
    console.log('\nInstalling: bPanel...');

    child_process.spawnSync(
      'npm',
      ['install'],
      {cwd: Path.join(pathLibs, 'bpanel')}
    );
  }

  /**
   * RUN THE PROGRAMS!!
   */

  console.log('\nRunning: ' + options.library + '...');

  const prefix = '--prefix=' + Path.join(pathData, options.library);
  const spv = options.node === 'spv' ? '--spv' : null;
  child_process.spawnSync(
    options.library,
    ['--daemon', spv, prefix],
    {cwd: Path.join(pathLibs, options.library, 'bin')}
  );

  if (options.bpanel){
    console.log('\nRunning: bPanel...');

    const prefix = '--prefix=' + Path.join(pathData, 'bpanel');
    child_process.spawnSync(
      'npm',
      ['run', 'start', '--', prefix],
      {cwd: Path.join(pathLibs, 'bpanel')}
    );

    console.log('\nOpening bPanel: HIT REFRESH UNTIL IT WORKZ');

    // THIS ONLY WORKS ON OSX
    child_process.spawnSync(
      'open',
      ['http://localhost:5000'],
    );
  }

})();






// UTILITY

function makeIfNone(path) {
  if (!fs.existsSync(path))
    fs.mkdirSync(path);
}

function listDir(path) {
  let list = [];
  if (fs.existsSync(path)) {
    list = fs.readdirSync(path);
  }
  return list;
}

function configFileFromObject(obj) {
  const keys = Object.keys(obj);

  let output = '';
  for (let key of keys) {
    const ObjKey = key;
    key = key.replace(/_/g, '-');
    output += key;
    output += ': ';
    output += obj[ObjKey];
    output += '\n';
  }
  return output;
}