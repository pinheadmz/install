const os = require('os');
const { execSync } = require('child_process');

const semver = require('../vendor/semver');

// simple utility to remove whitespace from string
function trim(string) {
  return string.replace(/^\s+|\s+$/g, '');
}

function preinstall() {
  try {
    // check minimum version of npm
    let npmVersion = execSync('npm --version', {
      encoding: 'utf8'
    });
    let nodeVersion = process.version;

    npmVersion = trim(npmVersion);

    const npmMin = '>=5.7.1';
    const nodeMin = '>=8.9.4';

    if (
      !semver.satisfies(npmVersion, npmMin) ||
      !semver.satisfies(nodeVersion, nodeMin)
    )
      throw new Error(
        `bPanel requires npm version ${npmMin} and node version ${nodeMin}. \
  You are running npm ${npmVersion} and node ${nodeVersion}. Please check your $PATH variable, \
  update and try again.`
      );

  } catch (e) {
    console.error('There was a problem initializing the project: ', e.stack);
    process.exit(1);
  }
}

module.exports = {preinstall};
