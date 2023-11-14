const { exec } = require('child_process');
const fs = require('fs/promises');

const commands = ["build", "from_github", "increase", "init", "next", "publish", "github-action"];

async function processCommand(command) {
  return new Promise((resolve, reject) => {
    
    // Execute the command and get the options section
    const bashCode = `dappnodesdk ${command} --help`;
    exec(bashCode, async (error, stdout, _stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        reject(error.message);
        return;
      }

      // Use regular expression to extract lines for Options:
      const optionsSectionRegex = /(Options:[\s\S]*)/i;
      const optionsSectionMatch = stdout.match(optionsSectionRegex);

      if (optionsSectionMatch) {
        const optionsSection = "```" + optionsSectionMatch[1].trim() + "\n```";

        // Define path and flags
        const filePath = 'docs/dev/sdk/commands.md';
        const flagStart = `<!--flag_${command}_start-->`;
        const flagEnd = `<!--flag_${command}_end-->`;

        try {
          // Read content of file
          let data = await fs.readFile(filePath, 'utf8');

          const startIdx = data.indexOf(flagStart);
          const endIdx = data.indexOf(flagEnd);

          if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
            console.error('Invalid file format. Flags not found or in the wrong order.');
            reject('Invalid file format');
            return;
          }

          // Insert the optionsSection between flags
          const updatedContent =
            data.substring(0, startIdx + flagStart.length) +
            '\n' +
            optionsSection +
            '\n' +
            data.substring(endIdx);

          // Write content to file
          await fs.writeFile(filePath, updatedContent, 'utf8');
          console.log(`Options for ${command} inserted successfully!`);
          resolve();
        } catch (err) {
          console.error(`Error processing ${command}:`, err);
          reject(err);
        }
      }
    });
  });
}

async function processCommands() {
  for (let command of commands) {
    await processCommand(command);
  }
}

// Call the function to start processing commands
processCommands();
