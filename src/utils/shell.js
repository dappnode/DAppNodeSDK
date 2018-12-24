const util = require('util');
const exec = util.promisify(require('child_process').exec);

/**
 * If this method is invoked as its util.promisify()ed version,
 * it returns a Promise for an Object with stdout and stderr properties.
 * In case of an error (including any error resulting in an exit code other than 0),
 * a rejected promise is returned, with the same error object given in the callback,
 * but with an additional two properties stdout and stderr.
 */

/**
 * If timeout is greater than 0, the parent will send the signal
 * identified by the killSignal property (the default is 'SIGTERM')
 * if the child runs longer than timeout milliseconds.
 */
const timeout = 3*60*1000; // ms

function shell(cmd) {
  return exec(cmd, {timeout})
      .then((res) => res.stdout)
      .catch((err) => {
        if (err.signal === 'SIGTERM') {
          throw Error(`cmd "${err.cmd}" timed out (${timeout} ms)`);
        }
        throw err;
      });
}


/**
 * About the error object
 * ======================
 *
 * Sample error object:

Error: Command failed: cat aa.txt
cat: aa.txt: No such file or directory

user-laptop:src user$ node src/utils/test.js
{ Error: Command failed: cat aa.txt
cat: aa.txt: No such file or directory

    at ChildProcess.exithandler (child_process.js:276:12)
    at emitTwo (events.js:126:13)
    at ChildProcess.emit (events.js:214:7)
    at maybeClose (internal/child_process.js:915:16)
    at Socket.stream.socket.on (internal/child_process.js:336:11)
    at emitOne (events.js:116:13)
    at Socket.emit (events.js:211:7)
    at Pipe._handle.close [as _onclose] (net.js:561:12)
  killed: false,
  code: 1,
  signal: null,
  cmd: 'cat aa.txt',
  stdout: '',
  stderr: 'cat: aa.txt: No such file or directory\n' }

 * console.log(err) will return all the info above
 * console.log(`${err}`) will return the same as err.message
 *
 * Conclusion
 * ==========
 *
 * Using child_process it's best to just rethrow the recieved error.
 */


module.exports = shell;
