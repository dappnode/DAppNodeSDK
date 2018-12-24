const expect = require('chai').expect;
const shell = require('../../src/utils/shell');

describe('shell utility', () => {
  it('Execute a command without crashing', async () => {
    const output = await shell('cat ./package.json');
    expect(output).to.be.ok;
  });
});
