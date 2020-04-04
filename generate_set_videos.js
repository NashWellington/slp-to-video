const {spawn} = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dir = require('node-dir');
const {default: SlippiGame} = require('slp-parser-js');

const INPUT_DIRECTORY = '/home/kjs/Projects/slp-to-video/test';
const OUTPUT_DIRECTORY = '/home/kjs/Projects/smash/videos/sets';
const DOLPHIN_PATH = '/home/kjs/Projects/Ishiiruka/build/Binaries/dolphin-emu';
const SSBM_ISO_PATH = '/home/kjs/Projects/smash/isos/SSBM-1.02.iso';
const NUM_PROCESSES = 2;


const generateReplayConfig = (file) => {
  const game = new SlippiGame(file);
  const metadata = game.getMetadata();
  const config = {
    mode: 'normal',
    replay: file,
    startFrame: -123,
    endFrame: metadata.lastFrame,
    isRealTimeMode: false,
    commandId: `${crypto.randomBytes(12).toString('hex')}`,
  };
  let configFn = file.replace(INPUT_DIRECTORY, OUTPUT_DIRECTORY);
  const parsed = path.parse(configFn);
  configFn = path.join(parsed.dir,
      `${metadata.startAt.replace(/:/g, '')}.json`);
  fs.mkdirSync(parsed.dir, {recursive: true});
  fs.writeFileSync(configFn, JSON.stringify(config));
};


const exit = (process) => new Promise((resolve, reject) => {
  process.on('exit', (code, signal) => {
    resolve(code, signal);
  });
});


const executeCommandsInQueue = async (command, argsArray, numWorkers,
  onSpawn) => {
  const worker = async () => {
    while (argsArray.length > 0) {
      const args = argsArray.pop();
      const process = spawn(command, args);
      if (onSpawn !== undefined) {
        onSpawn(process);
      }
      await exit(process);
    }
  };
  const workers = [];
  while (workers.length < NUM_PROCESSES) {
    workers.push(worker());
  }
  while (workers.length > 0) {
    await workers.pop();
  }
};


const killDolphinOnEndFrame = (process) => {
  process.stdout.setEncoding('utf8');
  process.stdout.on('data', (data) => {
    const lines = data.split('\r\n');
    lines.forEach((line) => {
      if (line.includes('[END_FRAME]')) {
        setTimeout(() => process.kill(), 1000);
      }
    });
  });
};


const processReplayConfigs = async (files) => {
  const dolphinCommandArgsArray = [];
  const ffmpegCommandArgsArray = [];
  files.forEach((file) => {
    const basename = path.join(path.dirname(file),
        path.basename(file, '.json'));
    dolphinCommandArgsArray.push([
      '-i', file,
      '-o', basename,
      '-b', '-e', SSBM_ISO_PATH,
    ]);
    ffmpegCommandArgsArray.push([
      '-i', `${basename}.avi`,
      '-i', `${basename}.wav`,
      '-b:v', '15M', `${basename}-merged.avi`,
    ]);
  });
  await executeCommandsInQueue(DOLPHIN_PATH, dolphinCommandArgsArray,
      NUM_PROCESSES, killDolphinOnEndFrame);
  await executeCommandsInQueue('ffmpeg', ffmpegCommandArgsArray,
      NUM_PROCESSES);
};


const concatenateVideos = (dir) => {
  fs.readdir(dir, async (err, files) => {
    if (err) throw err;
    files = files.filter((file) => file.endsWith('merged.avi'));
    if (!files.length) return;
    files.sort();
    concatFn = path.join(dir, 'concat.txt');
    const stream = fs.createWriteStream(concatFn);
    files.forEach((file) => {
      fn = path.join(dir, file)
      stream.write(`file '${fn}'\n`);
    });
    stream.end();
    args = ['-f', 'concat', '-safe', '0', '-i', concatFn, '-c', 'copy', `${dir}.avi`]
    const process = spawn('ffmpeg', args);
    await exit(process);
    fs.rmdir(dir, {recursive: true}, (err) => {if (err) throw err});
  });
};


const subdirs = (rootdir) => new Promise((resolve, reject) => {
  dir.subdirs(rootdir, (err, subdirs) => {
    if (err) reject(err);
    resolve(subdirs);
  });
});


const files = (rootdir) => new Promise((resolve, reject) => {
  dir.files(rootdir, (err, files) => {
    if (err) reject(err);
    resolve(files);
  });
});


const main = () => {
  fs.mkdirSync(OUTPUT_DIRECTORY);
  files(INPUT_DIRECTORY)
    .then((files) => {
      files.forEach(generateReplayConfig);
    })
    .then(() => files(OUTPUT_DIRECTORY))
    .then(async (files) => {
      await processReplayConfigs(files);
    })
    .then(() => subdirs(OUTPUT_DIRECTORY))
    .then((subdirs) => {
      subdirs.forEach(concatenateVideos);
    });
};


if (module === require.main) {
  main();
}
