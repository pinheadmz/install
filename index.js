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
    repo: 'https://github.com/bpanel-org/bpanel'
  }
};

const {
  path,
  menu,
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

  const pathAnswers = await inquirer.prompt(path(options));
  options = { ...options, ...pathAnswers };

  // Create app directory and subdirs
  const pathApp = options.path
  const pathLibs = Path.join(pathApp, 'libs');
  const pathData = Path.join(pathApp, 'data');
  makeIfNone(pathApp);
  makeIfNone(pathLibs);
  makeIfNone(pathData);

  options.installedLibs = listDir(pathLibs);
/*
  // Something is installed or running, awhat are we doing now?
  if (options.installedLibs.length > 0 || options.running.length > 0) {

    console.log('\n***\nInstalled: ' + JSON.stringify(options.installedLibs));
    console.log('Running: ' + JSON.stringify(options.running) + '\n***\n');

    const runnable = [];
    for (const proc of options.installedLibs) {
      if (options.running.indexOf(proc) === -1)
        runnable.push(proc);
    }

    const action = await inquirer.prompt(menu());

  }
*/
  const libAnswers = await inquirer.prompt(lib(options));
  options = { ...options, ...libAnswers };

  const nodeAnswers = await inquirer.prompt(node(options));
  options = { ...options, ...nodeAnswers };

  const bpanelAnswers = await inquirer.prompt(bpanel(options));
  options = { ...options, ...bpanelAnswers };

  /**
   * WRITE CONF FILES
   */

   console.log('\n***\nWriting configuration files...\n***\n');

  // note: SPV is not a valid config file option, but we'll use it internally
  const libOpts = {
    api_key: bcrypto.random.randomBytes(32).toString('hex'),
    network: options.network,
    prune: options.node === 'prune',
    spv: options.node === 'SPV',
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

  // create directory for this lib's network -- main will just stay empty unused
  const pathThisNetwork = Path.join(pathThisData, options.network);
  makeIfNone(pathThisNetwork);

  // print wallet conf file -- maybe it never gets used but here it is
  const walletConfString = configFileFromObject(walletOpts);
  const walletPath =
    options.network === 'main' ? pathThisData : pathThisNetwork;
  fs.writeFileSync(
    Path.join(walletPath, 'wallet.conf'),
    walletConfString
  );  

  if (options.bpanel) {
    // create directory for bpanel
    const pathBpanel = Path.join(pathData, 'bpanel');
    const pathBpanelClients = Path.join(pathBpanel, 'clients');
    makeIfNone(pathBpanel);
    makeIfNone(pathBpanelClients);

    // print bpanel client conf file
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
  }

  /**
   * DOWNLOAD LIBRARIES
   */

  console.log(
    '\n***\nDownloading from GitHub: ' +
    options.library +
    '...\n***\n'
  );

  await spawnAsyncPrint(
    'git',
    ['clone', libs[options.library].repo],
    {cwd: pathLibs}
  );

  if (options.bpanel && options.installedLibs.indexOf('bpanel') === -1) {
    console.log('\n***\nDownloading from GitHub: bPanel...\n***\n');
  
    await spawnAsyncPrint(
      'git',
      ['clone', libs['bpanel'].repo],
      {cwd: pathLibs}
    );
  }

  /**
   * NPM INSTALL
   */

  console.log('\n***\nInstalling: ' + options.library + '...\n***\n');

  await spawnAsyncPrint(
    'npm',
    ['install'],
    {cwd: Path.join(pathLibs, options.library)}
  );

  if (options.bpanel && options.installedLibs.indexOf('bpanel') === -1) {
    console.log('\n***\nInstalling: bPanel...\n***\n');

    await spawnAsyncPrint(
      'npm',
      ['install'],
      {cwd: Path.join(pathLibs, 'bpanel')}
    );
  }

  /**
   * RUN THE PROGRAMS!!
   */

  console.log('\n***\nRunning: ' + options.library + '...\n***\n');

  const prefix = '--prefix=' + Path.join(pathData, options.library);
  const spv = options.node === 'SPV' ? '--spv' : null;
  const libProc = child_process.spawn(
    './' + options.library,
    ['--daemon', spv, prefix],
    {
      cwd: Path.join(pathLibs, options.library, 'bin'),
      detached: true
    }
  );

  /*
  if (options.running.indexOf('bpanel') > 0) {
    console.log('\n***\nbPanel is already running\n***\n');
  } else 

  */
  if (options.bpanel) {
    console.log('\n***\nRunning: bPanel...\n***\n');

    const prefix = '--prefix=' + Path.join(pathData, 'bpanel');
    const bpanelProc = child_process.spawn(
      'npm',
      ['run', 'start:poll', '--', prefix],
      {
        cwd: Path.join(pathLibs, 'bpanel'),
        detached: true,
        stdio: 'inherit'
      }
    );
  }

  process.exit();
})();


// UTILITY

function makeIfNone(path) {
  if (!fs.existsSync(path))
    fs.mkdirSync(path);
}

function listDir(path) {
  let list = [];
  if (fs.existsSync(path)) {
    const readDir = fs.readdirSync(path);
    for (const dirItem of readDir)
      if (dirItem[0] !== '.') list.push(dirItem);
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

async function spawnAsyncPrint(cmd, arg, opt) {
  return new Promise ((resolve, reject) => {
    const proc = child_process.spawn(cmd, arg, opt);

    proc.stdout.on('data', (data) => {
      console.log('    ', data.toString());
    });


    proc.stderr.on('data', (data) => {
      console.log('    ', data.toString());
    });

    proc.on('close', (code) => {
      resolve(code);
    });
  });
}