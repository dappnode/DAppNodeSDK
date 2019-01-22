const expect = require('chai').expect;
const Apm = require('../../src/utils/Apm');

describe('Apm constructor', () => {
  const dnpName = 'admin.dnp.dappnode.eth';

  let apm;
  it('Should get a new instance of Apm', async () => {
    apm = new Apm('infura');
    expect(apm).to.be.ok;
    expect(apm.providerUrl).to.equal('https://mainnet.infura.io');
  });

  it('Should get the contract the registry contract of a DNP name', async () => {
    const registry = await apm.getRegistryContract(dnpName);
    expect(registry).to.be.ok;
    expect(registry._address).to.equal('0x266BFdb2124A68beB6769dC887BD655f78778923');
  }).timeout(60*1000);

  it('Should get the contract the repo contract of a DNP name', async () => {
    const repo = await apm.getRepoContract(dnpName);
    expect(repo).to.be.ok;
    expect(repo._address).to.equal('0xEe66C4765696C922078e8670aA9E6d4F6fFcc455');
  }).timeout(60*1000);
});
