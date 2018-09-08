# luis-version-tools
`luis-version-tools` is an opinionated tool around versioning LUIS apps born from a frustration of other engineers breaking LUIS applications, publishing into the wrong slot and not maintaining their changes in source control. A blog entry on the motivations behind the tool coming soon...

The tool is meant as a companion for the various command line tools in the [botbuilder-tools](https://github.com/Microsoft/botbuilder-tools) repo.
# Usage
Tool assumes your working directory has a `.lu` file, called `model.lu` in this example. Optionally, you should have a `.luisrc file` as per documentation [here](https://github.com/Microsoft/botbuilder-tools/tree/master/packages/LUIS#configuration). Otherwise, you must provide the `--appId`, `--authoringKey` and `--region` parameters via the command line.

If you have a `.luisrc` file, you can use the following command.

`luis-version --model model.lu --publish`.

If you do not have a `.luisrc`, use:

`luis-version --model model.lu --appId id --authoringKey authKey --region azure_region --publish`

This will created a new version of your LUIS app with the contents defined in `model.lu` and publish the version to the `endpointBasePath` specified in the `.luisrc` file. Removing the `--publish` flag will stop the script at the publishing step.

The tool will also generate a `.luis-app-version`, which includes the crc-32 hash of the `.lu` file contents as well as the latest version of the LUIS model.

Keep the `.lu` file and the `.luis-app-version` file in source control. Your `.lu` file is the source of truth of what is the latest model in LUIS. Anytime there is a `.lu` change, run the script and commit `.luis-app-version` and `.lu` file. Now you know which version had which data, at any point.

# License
Freely distributable under the terms of the MIT license.