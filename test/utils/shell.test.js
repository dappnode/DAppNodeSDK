const expect = require('chai').expect;
const fs = require('fs');
const shell = require('../../src/utils/shell');

describe('shell utility', () => {
  const scriptPath = 'test-script.sh';
  const scriptData = `
#!/bin/bash
sleep .01
echo "hello"
`.trim();

  before(() => {
    fs.writeFileSync(scriptPath, scriptData);
  });

  it('Execute a command without crashing', async () => {
    await shell(`chmod +x ${scriptPath}`);
    // Check that the output is correct
    const output = await shell(`./${scriptPath}`);
    expect(output.trim()).to.equal('hello');
    // Check that it errors on timeout
    const errorMessage = await shell(`./${scriptPath}`, {timeout: 1})
        .catch((e) => e.message);
    expect(errorMessage).to.include('timed out');
  });

  after(() => {
    fs.unlinkSync(scriptPath);
  });
});
