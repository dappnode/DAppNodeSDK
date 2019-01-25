const expect = require('chai').expect;
const fs = require('fs');
const rmSafe = require('../rmSafe');
const yaml = require('js-yaml');
const buildAndUpload = require('../../src/methods/buildAndUpload');

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
// ./dnp_0.0.0/             => build directory
//
// Then it will expect the function to generate transaction data
// and output it to the console and to ./dnp_0.0.0/deploy.txt

describe('buildAndUpload', () => {
  const version = '0.1.0';
  const manifest = {
    name: 'admin.dnp.dappnode.eth',
    version,
    image: {},
  };
  const manifestPath = './dappnode_package.json';
  const composePath = './docker-compose.yml';
  const buildDir = `./build_${version}/`;

  const Dockerfile = `FROM alpine:3.1
WORKDIR /usr/src/app
CMD [ "echo", "happy buidl" ]
`;

  const compose = {
    'version': '3.4',
    'services': {
      'admin.public.dappnode.eth': {
        'image': `admin.public.dappnode.eth:${version}`,
        'build': './build',
      },
    },
  };

  before(async () => {
    await rmSafe(manifestPath);
    await rmSafe(composePath);
    await rmSafe('./build');
    await rmSafe(buildDir);
    fs.mkdirSync('./build');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    fs.writeFileSync(composePath, yaml.dump(compose, {indent: 4}));
    fs.writeFileSync('./build/Dockerfile', Dockerfile);
  });

  it('Should build and upload the current version', async () => {
    const manifestIpfsPath = await buildAndUpload({
      buildDir,
      ipfsProvider: 'infura',
    });
    // Check returned hash is correct
    expect(manifestIpfsPath).to.include('/ipfs/Qm');
    // Check that the deploy.txt file is correct
    // const deployText = fs.readFileSync(deployTextPath, 'utf8');
    // expect(deployText).to.include(expectedString);
  }).timeout(60*1000);

  after(async () => {
    await rmSafe(manifestPath);
    await rmSafe(composePath);
    await rmSafe('./build');
    await rmSafe(buildDir);
  });
});
