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
    .name('luis-version')
    .description('Updates the application with the supporting .lu file ')
    .option('--appId [appid]', 'The LUIS application')
    .option('--authoringKey [sub key]', 'LUIS user authoring key')
    .option('--region [region]', 'The region where the app is deployed')
    .option('--publish', 'Publishes the new version of the application')
    .option('--model [model file]', 'The .lu file supporting the application')
    .option('--luisrc [luisrc file]', 'The .luisrc file we want to use, perhaps if we want to use a different LUIS app if you have an app per environment setup.')
    .option('--verbose')
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

update.updateModel(program);