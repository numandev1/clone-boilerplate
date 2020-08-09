#!/usr/bin/env node
import chalk from 'chalk';
import program from 'commander';
import { ensureDir, existsSync } from 'fs-extra';
import * as path from 'path';
import prompts from 'prompts';
// const program = require('commander')

import * as Examples from './Examples';
import log from './Logger';
// import * as Template from './Template';
import shouldUpdate, { shouldUseYarn } from './Update';

const packageJSON = require('../package.json');

let inputPath: string;

program
  .storeOptionsAsProperties(true)
  .passCommandToAction(false)
  .version(packageJSON.version);

program
  .option('-c, --clone <example>')
  .description('clone boilerplate example')
  .action(({ clone }) => runAsync(clone));

program
  .command('create')
  .description('coming soon')
  .option('-n, --name <name>', 'name')
  .action(({ name }) => console.log('coming soon'));

program.parse(process.argv);

async function runAsync(clone): Promise<void> {
  try {
    if (!clone) {
      Examples.promptAsync();
    }
  } catch (error) {
    await commandDidThrowAsync(error);
  }
}

async function commandDidThrowAsync(error: any) {
  log.newLine();
  log.nested(chalk.red(`An unexpected error occurred:`));
  log.nested(error);
  log.newLine();

  await shouldUpdate();

  process.exit(1);
}
