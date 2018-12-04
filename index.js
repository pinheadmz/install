#!/usr/bin/env node

'use strict'

const Path = require('path');
const fs = require('fs');
const os = require('os');
const child_process = require('child_process');
const inquirer = require('inquirer');

const HOME = os.homedir ? os.homedir() : '/';
const {lib, bpanel} = require('./lib/survey');

// TODO: check whats installed in libs & data
// TODO: check whats running and inform user (check port in use?)

(async () => {
  const defaultPath = Path.join(HOME, 'ezbcoin');
  const libOptions = {
    defaultPath: defaultPath,
  };

  console.log('Welcome to ezbcoin installer!');

  const libAnswers = await inquirer.prompt(lib(libOptions));
  
  const PATH = libAnswers.path;
  const bPanelInstalled = fs.existsSync(Path.join(PATH, 'bpanel'));

  const bpanelOptions = {
    bPanelInstalled: bPanelInstalled
  };

  const bpanelAnswers = await inquirer.prompt(bpanel(bpanelOptions));

  makeIfNone(PATH);
  makeIfNone(Path.join(PATH, 'libs'));
  makeIfNone(Path.join(PATH, 'pidlocks'));
  makeIfNone(Path.join(PATH, 'data'));


console.log(libAnswers);
console.log(bpanelAnswers);
})();






// UTILITY

function makeIfNone(path) {
  if (!fs.existsSync(path))
    fs.mkdirSync(path);
}