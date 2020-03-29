const child_process = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dir = require('node-dir');
const slp = require('slp-parser-js');

const INPUT_DIRECTORY = '/home/kjs/Projects/slp-to-video/test';
const OUTPUT_DIRECTORY = '/home/kjs/Projects/smash/videos/sets';
const DOLPHIN_PATH = '/home/kjs/Projects/Ishiiruka/build/Binaries/dolphin-emu';
const SSBM_ISO_PATH = '/home/kjs/Projects/smash/isos/SSBM-1.02.iso';
const NUM_PROCESSES = 2;


const generateReplayConfig = (file) => {
    let game = new slp.default(file);
    let metadata = game.getMetadata();
    let config = {
        mode: 'normal',
        replay: file,
        startFrame: -123,
        endFrame: metadata.lastFrame,
        isRealTimeMode: false,
        commandId: `${crypto.randomBytes(12).toString('hex')}`
    };
    let configFn = file.replace(INPUT_DIRECTORY, OUTPUT_DIRECTORY);
    let parsed = path.parse(configFn);
    configFn = path.join(parsed.dir, `${metadata.startAt.replace(/:/g, '')}.json`);
    fs.mkdirSync(parsed.dir, { recursive: true });
    fs.writeFileSync(configFn, JSON.stringify(config));
}


const generateSetReplayConfigs = (setDir) => {
    fs.readdir(setDir, (err, files) => {
        if (err) throw err;
        files.forEach((file) => {
            if (path.extname(file) == '.slp') {
                generateReplayConfig(path.join(setDir, file));
            }
        });
    });
}


const exit = (process) => new Promise((resolve, reject) => {
    process.on('exit', (code, signal) => {
        resolve(code, signal);
    });
});


const executeDolphinCommands = (argsArray) => {
    const worker = async () => {
        while (argsArray.length > 0) {
            const args = argsArray.pop();
            const process = child_process.spawn(DOLPHIN_PATH, args);
            process.stdout.setEncoding('utf8');
            process.stdout.on('data', (data) => {
                const lines = data.split('\r\n');
                lines.forEach((line) => {
                    if (line.includes('[END_FRAME]')) {
                        setTimeout(() => process.kill(), 1000);
                    }
                });
            });
            await exit(process);
        }
    }
    for (let i = 0; i < NUM_PROCESSES; i++) {
        worker();
    }
}


const processReplayConfigs = (files) => {
    dolphinCommandArgsArray = [];
    files.forEach((file) => {
        dolphinCommandArgsArray.push([
            '-i', file,
            '-o', path.join(path.dirname(file), path.basename(file, '.json')),
            '-b', '-e', SSBM_ISO_PATH]);
    });
    executeDolphinCommands(dolphinCommandArgsArray);
}


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
    subdirs(INPUT_DIRECTORY)
        .then((subdirs) => {
            subdirs.forEach(generateSetReplayConfigs);
        })
        .then(() => files(OUTPUT_DIRECTORY))
        .then((files) => {
            processReplayConfigs(files);
        });
}


if (module === require.main) {
    main();
}
