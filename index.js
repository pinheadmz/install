
'use strict'

const crypto = require('crypto');
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
    chain: 'handshake',
    commit: '7f6e6ba277f43011fa873338fa693e85d4e3a907'
  },
  bpanel: {
    repo: 'https://github.com/bpanel-org/bpanel',
    commit: 'current-client-bug'
  },
  bmultisig: {
    repo: 'https://github.com/bcoin-org/bmultisig'
  }
};

// will be "module.exports =..."
const bpanelConfig = {
  plugins: [
    "@bpanel/genesis-theme",
    "@bpanel/price-widget",
    "@bpanel/recent-blocks",
    "@bpanel/simple-wallet",
    "@bpanel/connection-manager"
  ],
  localPlugins: []
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

  // CONF - node
  // note: SPV is not a valid config file option, but we'll use it internally
  const libOpts = {
    api_key: crypto.randomBytes(32).toString('hex'),
    network: options.network,
    prune: options.node === 'prune',
    spv: options.node === 'SPV'
  };
  const walletOpts = {
    api_key: crypto.randomBytes(32).toString('hex'),
    network: options.network,
    node_api_key: libOpts.api_key,
    wallet_auth: false
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
    walletOpts.node_port = libOpts.http_port;
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

  // CONF - wallet
  // create directory for this lib's network-- main will just stay empty unused
  const pathThisNetwork = Path.join(pathThisData, options.network);
  makeIfNone(pathThisNetwork);

  // print wallet conf file -- maybe it never gets used but here it is
  const walletConfString = configFileFromObject(walletOpts);
  const pathWallet =
    options.network === 'main' ? pathThisData : pathThisNetwork;
  fs.writeFileSync(
    Path.join(pathWallet, 'wallet.conf'),
    walletConfString
  );  

  // CONF - bpanel
  if (options.bpanel) {
    // create directory for bpanel
    const pathBpanel = Path.join(pathData, 'bpanel');
    const pathBpanelClients = Path.join(pathBpanel, 'clients');
    makeIfNone(pathBpanel);
    makeIfNone(pathBpanelClients);

    // CLIENT conf file
    const bPanelOpts = {
      api_key: libOpts.api_key,
      wallet_api_key: walletOpts.api_key,
      network: libOpts.network,
      chain: libs[options.library].chain,
      wallet: options.wallet === 'bwallet',
      multisig: options.wallet === 'bmultisig'
    };

    if (conflict) {
      bPanelOpts.port = libOpts.http_port;
      bPanelOpts.wallet_port = walletOpts.http_port;
    }

    const bpanelClientConfString = configFileFromObject(bPanelOpts);
    fs.writeFileSync(
      Path.join(pathBpanelClients, options.library + '.conf'),
      bpanelClientConfString
    );

    // BPANEL conf file
    const bpanelConfString =
      'module.exports = ' +
      JSON.stringify(bpanelConfig).replace(/\"([^(\")"]+)\":/g,"$1:");

    fs.writeFileSync(
      Path.join(pathBpanel, 'config.js'),
      bpanelConfString
    );
    // TODO: need to get wallet token and insert it, after node and wallet are up
  }

  /**
   * DOWNLOAD LIBRARIES
   */

  // DOWNLOAD - node
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

  if (libs[options.library].commit) {
    await spawnAsyncPrint(
      'git',
      ['checkout', libs[options.library].commit],
      {cwd: Path.join(pathLibs, options.library)}
    );
  }

  // DOWNLOAD - bmultisig
  if (
    options.wallet === 'bmultisig' &&
    options.installedLibs.indexOf('bmultisig') === -1
  ) {
    console.log('\n***\nDownloading from GitHub: bmultisig...\n***\n');

    await spawnAsyncPrint(
      'git',
      ['clone', libs['bmultisig'].repo],
      {cwd: pathLibs}
    );

    if (libs['bmultisig'].commit) {
      await spawnAsyncPrint(
        'git',
        ['checkout', libs['bmultisig'].commit],
        {cwd: Path.join(pathLibs, 'bmultisig')}
      );
    }
  }

  // DOWNLOAD - bPanel
  if (options.bpanel && options.installedLibs.indexOf('bpanel') === -1) {
    console.log('\n***\nDownloading from GitHub: bPanel...\n***\n');
  
    await spawnAsyncPrint(
      'git',
      ['clone', libs['bpanel'].repo],
      {cwd: pathLibs}
    );

    if (libs['bpanel'].commit) {
      await spawnAsyncPrint(
        'git',
        ['checkout', libs['bpanel'].commit],
        {cwd: Path.join(pathLibs, 'bpanel')}
      );
    }
  }

  /**
   * NPM INSTALL
   */

  // INSTALL - node
  console.log('\n***\nInstalling: ' + options.library + '...\n***\n');

  await spawnAsyncPrint(
    'npm',
    ['install'],
    {cwd: Path.join(pathLibs, options.library)}
  );

  // INSTALL - bmultisig
  if (
      options.wallet === 'bmultisig' &&
      options.installedLibs.indexOf('bmultisig') === -1
    ) {
      console.log('\n***\nInstalling: bmultisig...\n***\n');

      await spawnAsyncPrint(
        'npm',
        ['install'],
        {cwd: Path.join(pathLibs, 'bmultisig')}
      );
    }

  // INSTALL - bpanel
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

  // RUN - node
  console.log('\n***\nRunning: ' + options.library + '...\n***\n');

  const args = [];
  args.push('--daemon');
  args.push('--prefix=' + Path.join(pathData, options.library));
  if (options.node === 'SPV')
    args.push('--spv');
  if (options.wallet !== 'bwallet')
    args.push('--no-wallet');

  child_process.spawn(
    './' + options.library,
    args,
    {
      cwd: Path.join(pathLibs, options.library, 'bin'),
      detached: true
    }
  );

  // RUN - bmultisig
  if (options.wallet === 'bmultisig') {
    console.log('\n***\nRunning: bmultisig...\n***\n');

    const BWprefix = '--prefix=' + pathWallet;

    child_process.spawn(
      './bmultisig',
      [BWprefix],
      {
        cwd: Path.join(pathLibs, 'bmultisig', 'bin'),
        detached: true,
      }
    );
  }

  // RUN - bpanel
  if (options.bpanel) {
    console.log('\n***\nRunning: bPanel...\n***\n');

    const prefix = '--prefix=' + Path.join(pathData, 'bpanel');

    const bpanelProc = child_process.spawn(
      'npm',
      ['run', 'start:poll', '--', prefix],
      {
        cwd: Path.join(pathLibs, 'bpanel'),
        detached: false,
        stdio: 'inherit'
      }
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