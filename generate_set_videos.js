const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dir = require('node-dir');
const slp = require('slp-parser-js');

const INPUT_DIRECTORY = '/home/kjs/Projects/smash/slippi/slp_files/copies/sets';
const OUTPUT_DIRECTORY = '/home/kjs/Projects/smash/videos/sets';
const NUM_PROCESSES = 2


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
    configFn = path.join(parsed.dir, `${metadata.startAt}.json`);
    fs.mkdir(parsed.dir, { recursive: true }, (err) => {
        fs.writeFile(configFn, JSON.stringify(config), (err) => {
            if (err) throw err;
        });
    });
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


const processSetReplayConfigs = (setDir) => {
    fs.readdir(setDir, (err, files) => {
        if (err) throw err;
        files.forEach((file) => {
            if (path.extname(file) == '.json') {
                console.log(file);
            }
        });
    });
}


const subdirs = (rootdir) => new Promise((resolve, reject) => {
    dir.subdirs(rootdir, (err, subdirs) => {
        if (err) reject(err);
        resolve(subdirs);
    });
});


const main = () => {
    fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
    subdirs(INPUT_DIRECTORY).then((subdirs) => {
        subdirs.forEach(generateSetReplayConfigs);
    });
    subdirs(OUTPUT_DIRECTORY).then((subdirs) => {
        subdirs.forEach(processSetReplayConfigs);
    });
}


if (module === require.main) {
    main();
}
