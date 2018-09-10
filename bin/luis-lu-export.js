#!/usr/bin/env node

const chalk = require('chalk');
const program = require('commander');
const update = require('../src/updatemodel');

program.Command.prototype.unknownOption = function (flag) {
    process.stderr.write(chalk.default.redBright(`\n  Unknown arguments: ${process.argv.slice(2).join(' ')}\n`));
    program.help();
    process.exit();
};

program
    .name('luis-lu-export')
    .description('Exports the latest version of an application and converts it to a .lu')
    .option('--appId [appid]', 'The LUIS application')
    .option('--authoringKey [sub key]', 'LUIS user authoring key')
    .option('--model [model file]', 'The destination .lu file')
    .option('--versionId [versionId]', 'The version id to export')
    .option('--luisrc [luisrc file]', 'The .luisrc file we want to use, perhaps if we want to use a different LUIS app if you have an app per environment setup.')
    .parse(process.argv);

if(!program.model) {
    process.stderr.write(chalk.default.redBright(`\n  --model parameter missing\n`));
    program.help();
    process.exit();
    return;
}

if (process.argv.length < 2) {
    program.help();
    process.exit();
    return;
}

update.exportlu(program);