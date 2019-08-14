'use strict';

const fs                  = require('fs');
const fse                 = require("fs-extra");
const branch              = require('git-branch');
const updateNotifier      = require("update-notifier");
const chalk               = require('chalk');
const clear               = require('clear');
const figlet              = require('figlet');
const emoji               = require('node-emoji');
const inquirer            = require('inquirer');
const rm                  = require('rimraf');
const pkg                 = require('./package.json');

updateNotifier({packageName: pkg.name, packageVersion: pkg.version, updateCheckInterval:1000}).notify();

const init = () => {
  clear();
  console.log(
    chalk.green(
      figlet.textSync('MTF', { horizontalLayout: 'full' })
    ),
    chalk.green(`\n Translations Managment tool, made with ${emoji.emojify(':hearts:')}`),
    chalk.yellow(`\n Version: ${pkg.version} \n\n`)
  );
};

const actionQuestions = () => {
  const questions = [
    {
      type: 'list',
      name: 'ACTION',
      message: 'What action would you like to do?',
      choices: [
        {
          name: 'Copy i18n files from active branch from specific path',
          value: 2,
        },
        {
          name: 'Merge the i18n files between two branches previously copied',
          value: 3
        },
        {
          name: 'Update translations by external files',
          value: 1,
        },
        {
          name: 'View branch folders in I18n',
          value: 5,
        },
        {
          name: 'View external folders',
          value: 6,
        },
        {
          name: 'Generate missing strings from i18n folder',
          value: 7,
        },
        {
          name: 'Exit (or press Ctrl + c)',
          value: 4,
        },
      ],
      filter: (value) => {
        return value;
      }
    },
  ];
  return inquirer.prompt(questions);
};

const i18nPathQuestion = () => {
  const questions = [
    {
      name: 'REPOSITORYPATH',
      type: 'input',
      default: '../project',
      message: 'What is the repository path?',
    },
    {
      name: 'I18NFOLDER',
      type: 'input',
      default: 'src/assets/i18n',
      message: 'What is the path of the current i18n files?',
    },
  ];
  return inquirer.prompt(questions);
};

const mergeQuestion = (listChoices) => {
  const questions = [
    {
      type: 'list',
      name: 'FOLDERFROM',
      message: 'What is the folder of the feature branch that has the changes? (it will be the feature branch that will overwrite the chains)',
      choices: listChoices,
    },
    {
      type: 'list',
      name: 'FOLDERTO',
      message: 'What is the folder of the branch that will receive the new changes?',
      choices: listChoices,
    },
  ];
  return inquirer.prompt(questions);
};

const missingStringsQuestion = (listChoices) => {
  const questions = [
    {
      type: 'list',
      name: 'FOLDER',
      message: 'Select the translation folder you want to extract all the missing strings to translate.',
      choices: listChoices,
    },
  ];
  return inquirer.prompt(questions);
};

const externalFoldersQuestion = (externalListChoices, branchListChoices) => {
  const questions = [
    {
      type: 'list',
      name: 'EXTERNALFOLDERSELECTED',
      message: 'Select external folder to merge (it will be the feature branch that will overwrite the chains) ',
      choices: externalListChoices,
    },
    {
      type: 'list',
      name: 'BRANCHFOLDERSELECTED',
      message: 'What is the folder of the branch that will receive the new changes?',
      choices: branchListChoices,
    },
  ];
  return inquirer.prompt(questions);
};

const success = () => {
  console.log(chalk.green.bold(`\n This current job was finished successfully ${emoji.emojify(':the_horns:')} \n\n`));
  launchQuestions().then();
};

const copyFolder = async (currentBranch, currentPath) => {
  const source = currentPath;
  const destination = `i18n/${currentBranch}`;

  if (fs.existsSync(destination)) {
    await rm.sync(destination);
    console.log(chalk.blue.bold(`${emoji.emojify(':construction:')} ${destination} folder was removed`));
  }
  return await fse.copy(source, destination);
};

const getBranchNameToCopyI18nFiles = async (repositoryPath) => {
  return branch(repositoryPath);
};

const mergeCultureByBranchs = async (culture, folderFrom, folderTo) => {
  let enCaFrom, enCaTo, cultureFilePathSource, cultureFilePathDestination;

  try {
    cultureFilePathSource = `${folderFrom}/${culture}.json`;
    enCaFrom = JSON.parse(fs.readFileSync(cultureFilePathSource, 'utf8'));
  } catch (e) {
    console.log(`${cultureFilePathSource} path not found! or it was a error: ${e}`);
    return;
  }

  try {
    cultureFilePathDestination = `${folderTo}/${culture}.json`;
    enCaTo = JSON.parse(fs.readFileSync(cultureFilePathDestination, 'utf8'));
  } catch (e) {
    console.log(`${cultureFilePathDestination} path not found! or it was a error: ${e}`);
    return;
  }

  let final = {};

  for (var prop in enCaTo) {
    let value = enCaTo[prop].trim();
    let key = prop.trim();
    final[key] = (value.indexOf('($)') === -1) ? `($)${value}` : value;
  }

  for (var prop in enCaFrom) {
    let value = enCaFrom[prop].trim();
    let key = prop.trim();
    final[key] = value;
  }

  const folder = `i18n-merged/${folderFrom.split('/').join('-')}---${folderTo.split('/').join('-')}`;
  const fileToCreate = `${folder}/${culture}.json`;

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }

  fs.writeFileSync(fileToCreate, JSON.stringify(final, null, 4), {encoding:'utf8',flag:'w'});
  console.log(chalk.green.bold(`${emoji.emojify(':construction:')} File ${fileToCreate} was created with ${Object.keys(final).length} properties`));
};

const extractMissingStrings = async (culture, folder) => {
  let contentFile, cultureFilePathSource;

  try {
    cultureFilePathSource = `${folder}/${culture}.json`;
    contentFile = JSON.parse(fs.readFileSync(cultureFilePathSource, 'utf8'));
  } catch (e) {
    console.log(`${cultureFilePathSource} path not found! or it was a error: ${e}`);
    return;
  }

  let final = {};

  for (var prop in contentFile) {
    let value = contentFile[prop].trim();
    let key = prop.trim();
    if (value.indexOf('($)') !== -1) {
      final[key] = value;
    }
  }

  const destinationFolder = `i18n-missing-strings/${folder.split('/').join('-')}`;
  const fileToCreate = `${destinationFolder}/${culture}.json`;

  if (!fs.existsSync(destinationFolder)) {
    fs.mkdirSync(destinationFolder);
  }

  fs.writeFileSync(fileToCreate, JSON.stringify(final, null, 4), {encoding:'utf8',flag:'w'});
  console.log(chalk.green.bold(`${emoji.emojify(':construction:')} File ${fileToCreate} was created with ${Object.keys(final).length} properties`));
};

const iteratePath = async (path) => {
  const externalFilesList = fs.readdirSync(path);
  for (const source of externalFilesList) {
    let stats = fs.statSync(`${path}/${source}`);
    if (stats.isDirectory()) {
      console.log(chalk.green.bold(`${emoji.emojify(':file_folder:')} ${source}`));
    }
  }
};

const launchQuestions = async () => {
  // ask questions
  const answers = await actionQuestions();
  const { ACTION } = answers;
  const i18nBasePath = 'i18n/';

  // create the file
  switch (ACTION) {
    case 1:
      const forldersListFromExternalFiles = fs.readdirSync('external-files');
      const branchFoldersListFromI18nFolder = fs.readdirSync('i18n');
      const { EXTERNALFOLDERSELECTED, BRANCHFOLDERSELECTED } = await externalFoldersQuestion(forldersListFromExternalFiles, branchFoldersListFromI18nFolder);

      const externalCompletedPath = `external-files/${EXTERNALFOLDERSELECTED}`;
      const branchCompletedPath = `${i18nBasePath}${BRANCHFOLDERSELECTED}`;

      await mergeCultureByBranchs('en-us', externalCompletedPath, branchCompletedPath);
      await mergeCultureByBranchs('es-es', externalCompletedPath, branchCompletedPath);
    break;
    case 2:
      const { REPOSITORYPATH, I18NFOLDER } = await i18nPathQuestion();
      let branchName = '';

      try {
        branchName = await getBranchNameToCopyI18nFiles(REPOSITORYPATH);
        console.log(chalk.blue.bold(`${emoji.emojify(':construction:')} Current branch: ${branchName}`));

        if (branchName.indexOf('feature') !== -1) {
          branchName = branchName.split('/')[1];
        }
      } catch(e) {
        console.log(chalk.red.bold(`${e}`));
      }

      try {
        const pathToDestinationFolder = `${REPOSITORYPATH}/${I18NFOLDER}`
        await copyFolder(branchName, pathToDestinationFolder).then(() => {
          console.log(chalk.blue.bold(`${emoji.emojify(':construction:')} I18n files were copied successfully to i18n/${branchName}`));
        });
      } catch(e) {
        console.log(chalk.red.bold(`${e}`));
      }
    break;
    case 3:
      const folders = fs.readdirSync('i18n');
      const { FOLDERFROM, FOLDERTO } = await mergeQuestion(folders);

      await mergeCultureByBranchs('en-us', `${i18nBasePath}${FOLDERFROM}`, `${i18nBasePath}${FOLDERTO}`);
      await mergeCultureByBranchs('es-es', `${i18nBasePath}${FOLDERFROM}`, `${i18nBasePath}${FOLDERTO}`);
    break;
    case 5:
      await iteratePath('i18n');
      break;
    case 6:
      await iteratePath('external-files');
      break;
    case 7:
      const folderListFromI18nFolder = fs.readdirSync('i18n');
      const { FOLDER } = await missingStringsQuestion(folderListFromI18nFolder);

      await extractMissingStrings('en-us', `${i18nBasePath}${FOLDER}`);
      await extractMissingStrings('es-es', `${i18nBasePath}${FOLDER}`);

      break;
    case 4:
      console.log(chalk.blue.bold(`See you later! ${emoji.emojify(':handshake:')} \n\n`));
      return false;
  }

  success();
};

init();
launchQuestions().then();

return;
