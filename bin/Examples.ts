import JsonFile, { JSONObject } from '@expo/json-file';
import chalk from 'chalk';
import fs from 'fs';
import got from 'got';
import path from 'path';
import prompts from 'prompts';
import { Stream } from 'stream';
import tar from 'tar';
import terminalLink from 'terminal-link';
import { promisify } from 'util';

import log from './Logger';

// @ts-ignore
const pipeline = promisify(Stream.pipeline);

type RepoInfo = {
  username: string;
  name: string;
  branch: string;
  filePath: string;
};

export async function promptAsync(): Promise<string | null> {
  //for languages prompt
  let languagesJson: any;

  try {
    languagesJson = await listAsync();
  } catch (error) {
    console.log();
    console.log('Failed to fetch the list of Languages with the following error:');
    console.error(error);
    process.exit(1);
  }

  if (languagesJson) {
    let choices = languagesJson.map(({ name }: any) => ({
      title: name,
      value: name,
    }));

    choices.push({
      title: 'Python',
      value: 'Python',
    });
    choices.push({
      title: 'Go',
      value: 'Go',
    });
    choices.push({
      title: 'Java',
      value: 'Java',
    });

    choices.push({
      title: 'Asp/C#',
      value: 'Asp/C#',
    });

    const languageRes = await prompts({
      type: 'autocomplete',
      name: 'lanuageName',
      message: 'Pick a Language',
      choices,
      suggest: (input: any, choices: any) => {
        const regex = new RegExp(input, 'i');
        return choices.filter((choice: any) => regex.test(choice.title));
      },
    });

    if (!languageRes.lanuageName) {
      console.log();
      console.log('Please specify an example or use the default starter app.');
      process.exit(1);
    }
    const lanuageName = languageRes.lanuageName.trim();

    //for examples prompt
    let examplesJson: any;

    try {
      examplesJson = await listAsync(`/${lanuageName}`);
    } catch (error) {
      console.log();
      console.log('Failed to fetch the list of Examples with the following error:');
      console.error(error);
      process.exit(1);
    }

    if (examplesJson) {
      const choices = examplesJson.map(({ name }: any) => ({
        title: name,
        value: name,
      }));

      const nameRes = await prompts({
        type: 'autocomplete',
        name: 'exampleName',
        message: 'Pick a Boilerplate',
        choices,
        suggest: (input: any, choices: any) => {
          const regex = new RegExp(input, 'i');
          return choices.filter((choice: any) => regex.test(choice.title));
        },
      });

      if (!nameRes.exampleName) {
        console.log();
        console.log('Please specify an example or use the default starter app.');
        process.exit(1);
      }
      const exampleName = nameRes.exampleName;
      let extractTemplateStep = log.logNewSection(`Locating project files.`);
      try {
        await downloadAndExtractExampleAsync(lanuageName, exampleName);
      } catch (error) {
        extractTemplateStep.fail(
          'Something went wrong in downloading and extracting the project files.'
        );
        process.exit(1);
      }
      extractTemplateStep.succeed('Downloaded and extracted project files.');
    }
  }

  return null;
}

async function isUrlOk(url: string): Promise<boolean> {
  const res = await got(url).catch(e => e);
  return res.statusCode === 200;
}

async function getRepoInfo(url: any, examplePath?: string): Promise<RepoInfo | undefined> {
  const [, username, name, t, _branch, ...file] = url.pathname.split('/');
  const filePath = examplePath ? examplePath.replace(/^\//, '') : file.join('/');

  // Support repos whose entire purpose is to be an example, e.g.
  // https://github.com/:username/:my-cool-example-repo-name.
  if (t === undefined) {
    const infoResponse = await got(`https://api.github.com/repos/${username}/${name}`).catch(
      e => e
    );
    if (infoResponse.statusCode !== 200) {
      return;
    }
    const info = JSON.parse(infoResponse.body);
    return { username, name, branch: info['default_branch'], filePath };
  }

  // If examplePath is available, the branch name takes the entire path
  const branch = examplePath
    ? `${_branch}/${file.join('/')}`.replace(new RegExp(`/${filePath}|/$`), '')
    : _branch;

  if (username && name && branch && t === 'tree') {
    return { username, name, branch, filePath };
  }
  return undefined;
}

function hasRepo({ username, name, branch, filePath }: RepoInfo) {
  const contentsUrl = `https://api.github.com/repos/${username}/${name}/contents`;
  const packagePath = `${filePath ? `/${filePath}` : ''}/package.json`;

  return isUrlOk(contentsUrl + packagePath + `?ref=${branch}`);
}

function hasExample(name: string): Promise<boolean> {
  return isUrlOk(
    `https://api.github.com/repos/nomi9995/boilerplate-examples/contents/${encodeURIComponent(
      name
    )}/package.json`
  );
}

function downloadAndExtractExampleAsync(language: string, name: string): Promise<void> {
  return pipeline(
    got.stream('https://codeload.github.com/nomi9995/boilerplate-examples/tar.gz/master'),
    tar.extract({ cwd: './', strip: 2 }, [`boilerplate-examples-master/${language}/${name}`])
  );
}

async function listAsync(subdir = ''): Promise<any> {
  const res = await got(
    `https://api.github.com/repos/nomi9995/boilerplate-examples/contents${subdir}`
  );
  const results = JSON.parse(res.body);
  return results.filter(({ name, type }: any) => type === 'dir' && !name?.startsWith('.'));
}
