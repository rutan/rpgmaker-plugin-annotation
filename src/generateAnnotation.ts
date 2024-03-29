import { PluginConfigSchema, PluginParameter } from './schema';

export interface BuildOptions {
  languages: string[];
  defaultLanguage: string;
}

export function generateAnnotation(config: PluginConfigSchema, { languages, defaultLanguage }: BuildOptions) {
  return languages
    .map((language) => {
      const omitLanguageSignature = language === defaultLanguage;

      function pickString(value: string | { [key: string]: string }) {
        if (typeof value === 'string') return value;
        if (Object.prototype.hasOwnProperty.call(value, language)) return value[language];
        if (Object.prototype.hasOwnProperty.call(value, defaultLanguage)) return value[defaultLanguage];
        return '';
      }

      function pickObject(value: { [key: string]: any }) {
        if (Object.prototype.hasOwnProperty.call(value, language)) return value[language];
        if (Object.prototype.hasOwnProperty.call(value, defaultLanguage)) return value[defaultLanguage];
        return value;
      }

      function push(lines: string[], annotation: string, stringValue: string) {
        stringValue.split(/\r?\n/).forEach((line, i) => {
          lines.push(`${i === 0 ? `@${annotation} ` : ''}${line}`);
        });
      }

      function pushParameter(lines: string[], name: string, param: PluginParameter) {
        push(lines, name, param.name);

        if (param.parent) push(lines, 'parent', pickString(param.parent));
        if (param.text) push(lines, 'text', pickString(param.text));
        if (param.description) push(lines, 'desc', pickString(param.description));

        // type
        switch (param.type) {
          case 'struct':
            push(lines, 'type', `struct<${param.struct}>`);
            break;
          case 'struct[]':
            push(lines, 'type', `struct<${param.struct}>[]`);
            break;
          default:
            if (config.target.includes('MV') && param.type.startsWith('multiline_string')) {
              push(lines, 'type', param.type.replace('multiline_string', 'note'));
            } else {
              push(lines, 'type', param.type);
            }
        }

        switch (param.type) {
          case 'string':
            if (param.default) push(lines, 'default', pickString(param.default));
            break;
          case 'string[]':
            push(lines, 'default', JSON.stringify(param.default.map((n) => pickString(n))));
            break;
          case 'multiline_string':
            if (param.default) {
              if (config.target.includes('MV')) {
                push(lines, 'default', JSON.stringify(pickString(param.default)));
              } else {
                push(lines, 'default', pickString(param.default));
              }
            }
            break;
          case 'multiline_string[]':
            if (config.target.includes('MV')) {
              push(lines, 'default', JSON.stringify(param.default.map((n) => JSON.stringify(pickString(n)))));
            } else {
              push(lines, 'default', JSON.stringify(param.default.map((n) => pickString(n))));
            }
            break;
          case 'note':
            if (param.default) push(lines, 'default', JSON.stringify(pickString(param.default)));
            break;
          case 'note[]':
            push(lines, 'default', JSON.stringify(param.default.map((n) => JSON.stringify(pickString(n)))));
            break;
          case 'number':
          case 'number[]':
            if (param.min !== undefined) push(lines, 'min', param.min.toString());
            if (param.max !== undefined) push(lines, 'max', param.max.toString());
            if (param.decimals > 0) push(lines, 'decimals', param.decimals.toString());
            push(lines, 'default', JSON.stringify(param.default));
            break;
          case 'boolean':
          case 'boolean[]':
            push(lines, 'on', pickString(param.on));
            push(lines, 'off', pickString(param.off));
            push(lines, 'default', JSON.stringify(param.default));
            break;
          case 'file':
          case 'file[]':
            push(lines, 'dir', param.dir);
            if (param.type === 'file') {
              if (param.default) push(lines, 'default', param.default);
            } else {
              push(lines, 'default', JSON.stringify(param.default));
            }
            if (config.target.includes('MV')) push(lines, 'require', '1');
            break;
          case 'select':
          case 'select[]':
            param.options.forEach((option) => {
              push(lines, 'option', pickString(option.name));
              push(lines, 'value', option.value.toString());
            });
            if (param.type === 'select') push(lines, 'default', param.default);
            else push(lines, 'default', JSON.stringify(param.default));
            break;
          case 'combo':
            param.options.forEach((option) => {
              push(lines, 'option', pickString(option));
            });
            push(lines, 'default', param.default);
            break;
          case 'actor':
          case 'class':
          case 'skill':
          case 'item':
          case 'weapon':
          case 'armor':
          case 'enemy':
          case 'troop':
          case 'state':
          case 'animation':
          case 'tileset':
          case 'common_event':
          case 'switch':
          case 'variable':
            push(lines, 'default', param.default.toString());
            break;
          case 'actor[]':
          case 'class[]':
          case 'skill[]':
          case 'item[]':
          case 'weapon[]':
          case 'armor[]':
          case 'enemy[]':
          case 'troop[]':
          case 'state[]':
          case 'animation[]':
          case 'tileset[]':
          case 'common_event[]':
          case 'switch[]':
          case 'variable[]':
            push(lines, 'default', JSON.stringify(param.default));
            break;
          case 'struct':
            push(lines, 'default', escapeStructParam(pickObject(param.default)));
            break;
          case 'struct[]':
            push(lines, 'default', JSON.stringify(param.default.map((n) => escapeStructParam(pickObject(n)))));
            break;
          default: {
            const badParameter: never = param;
            throw new Error(`unknown parameter: ${badParameter}`);
          }
        }
      }

      function endSection(lines: string[]) {
        const len = lines.length;
        if (len === 0) return;
        if (lines[len - 1] === '') return;
        lines.push('');
      }

      function generateMain() {
        const lines: string[] = [];

        // base
        config.target.forEach((target) => push(lines, 'target', target));
        push(lines, 'plugindesc', pickString(config.title));
        if (config.version) push(lines, 'version', pickString(config.version));
        push(lines, 'author', pickString(config.author));
        if (config.license) push(lines, 'license', pickString(config.license));
        if (config.url) push(lines, 'url', pickString(config.url));
        endSection(lines);

        // dependencies
        config.base?.forEach((base) => push(lines, 'base', base));
        config.orderAfter?.forEach((orderAfter) => push(lines, 'orderAfter', orderAfter));
        config.orderBefore?.forEach((orderBefore) => push(lines, 'orderBefore', orderBefore));
        endSection(lines);

        // description
        if (config.help) push(lines, 'help', pickString(config.help));
        endSection(lines);

        // assets
        config.requiredAssets?.forEach((requiredAssets) => push(lines, 'requiredAssets', requiredAssets));
        endSection(lines);

        config.requiredNoteAssets?.forEach((requiredNoteAssets) => {
          push(lines, 'noteParam', requiredNoteAssets.name);
          push(lines, 'noteDir', requiredNoteAssets.dir);
          push(lines, 'noteType', requiredNoteAssets.type);
          push(lines, 'noteData', requiredNoteAssets.data);
          endSection(lines);
        });

        // parameter
        config.params?.forEach((param) => {
          pushParameter(lines, 'param', param);
          endSection(lines);
        });

        // commands
        config.commands?.forEach((command) => {
          push(lines, 'command', command.name);
          push(lines, 'text', pickString(command.text));
          push(lines, 'desc', pickString(command.description));
          endSection(lines);

          command.args.forEach((arg) => {
            pushParameter(lines, 'arg', arg);
            endSection(lines);
          });
        });

        if (lines[lines.length - 1] === '') lines.pop();
        return `/*:${omitLanguageSignature ? '' : language}\n * ${lines.join('\n * ')}\n */`;
      }

      function generateStruct() {
        return config.structs
          .map((struct) => {
            const lines: string[] = [];

            struct.params.forEach((param) => {
              pushParameter(lines, 'param', param);
              endSection(lines);
            });

            if (lines[lines.length - 1] === '') lines.pop();
            return `/*~struct~${struct.name}:${omitLanguageSignature ? '' : language}\n * ${lines.join('\n * ')}\n */`;
          })
          .join('\n\n');
      }

      return [generateMain(), generateStruct()].filter(Boolean).join('\n\n');
    })
    .join('\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

function escapeStructParam(param: { [key: string]: any }) {
  const result: { [key: string]: string } = {};

  for (const key in param) {
    const value = param[key];
    if (Array.isArray(value)) {
      result[key] = JSON.stringify(value.map((n) => escapeStructParam(n)));
    } else if (typeof value === 'object') {
      result[key] = escapeStructParam(value);
    } else {
      result[key] = JSON.stringify(value);
    }
  }

  return JSON.stringify(result);
}
