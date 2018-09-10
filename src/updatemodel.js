const utils = require('./utils');
const fs = require('fs');
const textFile = require('read-text-file');
const chalk = require('chalk');
const moment = require('moment');
const npmrun = require('npm-run');
const replaceExt = require('replace-ext');

const VersionFile = '.luis-app-version';
const LuisRcFile = '.luisrc';

function npmrunExecSync(cmd) {
    console.log(chalk.default.white(`exec: ${cmd}`));
    return npmrun.execSync(cmd);
}

exports.exportlu = function (program) {
    const appConfig = setupAppConfig(program);
    const tempJson = '___temp.json';

    try {
        let latestVersion = program.versionId;
        if (latestVersion) {
            console.log(chalk.default.green(`Using version ${latestVersion} ...`));
        } else {
            console.log(chalk.default.green('Fetching versions ...'));
            const getVersions = `luis list versions --appId ${appConfig.appId} --authoringKey ${appConfig.authoringKey}`;
            const getVersionsResult = JSON.parse(npmrunExecSync(getVersions));
            latestVersion = getVersionsResult[getVersionsResult.length - 1].version;
        }

        console.log(chalk.default.green(`Exporting version ${latestVersion} ...`));
        const exportCmd = `luis export version --appId ${appConfig.appId} --authoringKey ${appConfig.authoringKey} --versionId ${latestVersion} > ${tempJson}`;
        const exportCmdResult = npmrunExecSync(exportCmd);

        console.log(chalk.default.green(`Refreshing .lu ...`));
        const ludownCmd = `ludown refresh -i ${tempJson} -n ${program.model} --skip_header`;
        const ludownCmdResult = npmrunExecSync(ludownCmd);

        console.log(chalk.default.green(`Done! Created ${program.model} ...`));

        if (ludownCmdResult.toString().length > 0) {
            // there was an issue with ludown
            throw new Error('Issue with ludown: ' + ludownCmdResult);
        }
    } catch (error) {
        console.log(chalk.default.redBright(`Unexpected error: ${error}`));
    }
    if (fs.existsSync(tempJson)) {
        fs.unlinkSync(tempJson);
    }
};

exports.updateModel = function (program) {
    const appConfig = setupAppConfig(program);

    if (!fs.existsSync(program.model)) {
        console.log(chalk.default.redBright(`Model ${program.model} not found`));
        process.exit();
        return;
    }

    console.log(chalk.default.green(`Getting app id ${appConfig.appId}...`));
    const appCmd = `luis get application --appId ${appConfig.appId} --authoringKey ${appConfig.authoringKey}`;
    const appCmdResult = npmrunExecSync(appCmd);
    if (appCmdResult.indexOf('is not a valid value for appId') >= 0) {
        console.log(chalk.default.redBright(`Application ${appConfig.appId} not found.`));
        process.exit();
        return;
    }
    const appCmdResultJson = JSON.parse(appCmdResult);

    console.log(chalk.default.green(`Calculating hash...`));

    const verhash = utils.checksum(fs.readFileSync(program.model));
    const vertag = moment().utc().format('YYMMDDHHmm');
    console.log(chalk.default.green(`Hash ${verhash} and tag ${vertag} generated`));

    const ver = {
        tag: vertag,
        hash: verhash
    };

    if (fs.existsSync(VersionFile)) {
        const oldVer = JSON.parse(textFile.readSync(VersionFile));
        if (oldVer.hash === ver.hash) {
            console.log(chalk.default.green(`Found old version with hash ${oldVer.hash}. Using version ${oldVer.tag}`));
            ver.tag = oldVer.tag;
        }
    }
    fs.writeFileSync(VersionFile, JSON.stringify(ver, null, 2));


    const version = ver.tag;
    console.log(chalk.default.green(`Checking if version ${version} exists...`));
    const getVersion = `luis get version --versionId ${version} --appId ${appConfig.appId} --authoringKey ${appConfig.authoringKey}`;
    let getVersionResult = null;

    let versionExists = false;
    try {
        getVersionResult = npmrunExecSync(getVersion, { stdio: 'ignore' });
        console.log(chalk.default.yellowBright(`Version ${version} exists...`));
        versionExists = true;
    } catch (error) {
        console.log(chalk.default.green(`Version ${version} doesn't exist. Continuing...`));
        // we will get this if the version doesn't exist. which is fine... :)
    }

    let ludownResult = null;
    try {
        if (!versionExists
            // || (versionExists && program.force)
        ) {
            ludownResult = runLudown(program, version, appCmdResultJson);
        }
        if (!versionExists) {
            importVersion(program, appConfig, version, ludownResult);
        } else {
            // if (program.force) {
            //     console.log(chalk.default.yellowBright('Forcing...'));
            //     deleteVersion(program, version, appConfig);
            //     importVersion(program, version, ludownResult);
            // } else {
            console.log(chalk.default.yellowBright('Version exists. Not updating...'));
            //console.log(chalk.default.redBright('Enable --force arg to force delete and import.'));
            // }
        }

        trainVersion(version, appConfig);

        if (program.publish) {
            if (!appConfig.endpointBasePath) {
                console.log(chalk.default.redBright('No endpointBasePath or region specified. Cannot publish.'));
                process.exit();
                return;
            }

            console.log(chalk.default.green('Publishing...'));
            const publishCmd = `luis publish version --appId ${appConfig.appId} --versionId ${version} --authoringKey ${appConfig.authoringKey} --endpointBasePath ${appConfig.endpointBasePath}`;
            const publishResult = JSON.parse(npmrunExecSync(publishCmd));
        } else {
            console.log(chalk.default.yellowBright('Skipping publish. Use --publish option to include publish.'));
        }
        console.log(chalk.default.green('All done.'));
    } catch (error) {
        if (ludownResult && fs.existsSync(ludownResult)) {
            fs.unlinkSync(ludownResult);
        }

        console.log(chalk.default.redBright('UNEXPECTED ERROR'));
        console.log(chalk.default.redBright(error));
    }
};

function runLudown(program, version, applicationJson) {
    console.log(chalk.default.green('Running ludown.'));
    const n = applicationJson.name;
    const ludownCmd = `ludown parse ToLuis --in ${program.model} --luis_name ${n} --luis_desc "${applicationJson.description}" --luis_versionId ${version} --luis_culture ${applicationJson.culture}`;
    const ludownCmdResult = npmrunExecSync(ludownCmd);
    if (ludownCmdResult.toString().length > 0) {
        // there was an issue with ludown
        throw new Error('Issue with ludown: ' + ludownCmdResult);
    }
    const filename = replaceExt(program.model, '.json');
    if (fs.existsSync(`${n}.json`)) {
        fs.renameSync(`${n}.json`, filename);
    } else {
        fs.renameSync(`${n}`, filename);
    }
    return filename;
}

function deleteVersion(program, version, appConfig) {
    console.log(chalk.default.green('Backing version up before delete'));
    const backupVersionCmd = `luis export version --versionId ${version} --appId ${appConfig.appId} --authoringKey ${appConfig.authoringKey}`;
    const backupVersionCmdResult = npmrunExecSync(backupVersionCmd);

    const deleteVersionCmd = `luis delete version --versionId ${version} --appId ${appConfig.appId} --authoringKey ${appConfig.authoringKey}`;
    const deleteVersionCmdProcess = npmrun.exec(deleteVersionCmd, {}, function (err, stdout, stderr) {

    });

    deleteVersionCmdProcess.stdin.write('yes')
    console.log(chalk.default.green('Version deleted.'));
}

function importVersion(program, appConfig, version, jsonFilename) {
    console.log(chalk.green(`Importing version ${version}...`));
    const updateCmd = `luis import version --appId ${appConfig.appId} --authoringKey ${appConfig.authoringKey} --in ${jsonFilename}`;
    const updateCmdResult = npmrunExecSync(updateCmd);

    fs.unlinkSync(jsonFilename); // get rid of the old file

    console.log(chalk.green(`Version ${version} imported.`));
}

function trainVersion(version, appConfig) {
    console.log(chalk.default.green(`Training ${version}...`));
    // now we train the new version
    let notTrained = true;
    let retryCount = 0;
    while (notTrained) {
        const trainVersion = `luis train version --appId ${appConfig.appId} --versionId ${version} --authoringKey ${appConfig.authoringKey}`;
        if (retryCount > 0) {
            console.log(chalk.default.yellow(`Retry ${retryCount}: ${trainVersion}`));
        }
        npmrunExecSync(trainVersion);
        utils.waitfor(5);
        var start = moment();
        while (true) {
            const getStatus = `luis get status --appId ${appConfig.appId} --versionId ${version} --authoringKey ${appConfig.authoringKey}`;

            const statusStr = npmrunExecSync(getStatus).toString();

            let isDone = null;
            let needsRetrain = null;
            let inProgress = null;
            let status = null;
            try {
                status = JSON.parse(statusStr);
                isDone = status.every(p => [0, 2].indexOf(p.details.statusId) >= 0);
                needsRetrain = status.every(p => [0, 1, 2].indexOf(p.details.statusId) >= 0);
                inProgress = status.some(p => [3].indexOf(p.details.statusId) >= 0);
            } catch (error) {
                process.stderr.write(chalk.default.redBright('Unexpected error.\n' + statusStr + '\n' + error));
                process.exit(0);
                return;
            }

            if (isDone) {
                notTrained = false;
                break;
            } else {
                if (inProgress) {
                    // no-op ... just keep getting status.
                }
                else if (needsRetrain) {
                    // console.log(chalk.default.redBright(JSON.stringify(status, null, 2)));
                    console.log(chalk.default.yellowBright('Model training need re-train. Trying again.'));
                    break;
                }
            }
            utils.waitfor(5); // pausing
        }

        retryCount++;
        if (retryCount > 10) {
            process.stderr.write(chalk.default.redBright('TRAIN FAILURE!'));
            process.exit();
            return;
        }
        console.log(chalk.default.green('Done training ...'));
    }
}

function setupAppConfig(program) {
    let luisrcFile = LuisRcFile;
    if (program.luisrc) {
        luisrcFile = program.luisrc;
    }

    const appConfig = {
        appId: program.appId,
        authoringKey: program.authoringKey,
        endpointBasePath: program.region ? `https://${program.region}.api.cognitive.microsoft.com/luis/api/v2.0` : undefined
    };
    if (fs.existsSync(luisrcFile)) {
        const luisrc = JSON.parse(textFile.readSync(luisrcFile));
        if (!appConfig.appId) appConfig.appId = luisrc.appId;
        if (!appConfig.authoringKey) appConfig.authoringKey = luisrc.authoringKey;
        if (!appConfig.endpointBasePath) appConfig.endpointBasePath = luisrc.endpointBasePath;
    }
    return appConfig;
}