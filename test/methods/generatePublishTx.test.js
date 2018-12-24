const expect = require('chai').expect;
const fs = require('fs');
const generatePublishTx = require('../../src/methods/generatePublishTx');

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
// ./dnp_0.0.0/             => build directory
//
// Then it will expect the function to generate transaction data
// and output it to the console and to ./dnp_0.0.0/deploy.txt

describe.skip('generatePublishTx', () => {
  const manifest = {
    name: 'admin.dnp.dappnode.eth',
    version: '0.1.0',
  };
  const manifestPath = './dappnode_package.json';
  const buildDir = 'dnp_0.0.0';
  const deployTextPath = `${buildDir}/deploy.txt`;
  let logAggregated = '';
  function logAggregator(data) {
    logAggregated += data;
  }

  before(async () => {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    fs.mkdirSync(buildDir);
  });

  it('Should generate a publish TX', async () => {
    await generatePublishTx({
      manifestIpfsPath: '/ipfs/Qm',
      buildDir,
      developerAddress: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      ethProvider: 'infura',
      log: logAggregator,
    });
    const expectedString = 'To: 0x266BFdb2124A68beB6769dC887BD655f78778923';
    // Check that the console output is correct
    expect(logAggregated).to.include(expectedString);
    // Check that the deploy.txt file is correct
    const deployText = fs.readFileSync(deployTextPath, 'utf8');
    expect(deployText).to.include(expectedString);
  }).timeout(20000);

  after(async () => {
    fs.unlinkSync(manifestPath);
    fs.unlinkSync(deployTextPath);
    fs.rmdirSync(buildDir);
  });
});
