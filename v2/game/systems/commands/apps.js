import { mailApp } from './apps/mail.js';
import { contractsApp } from './apps/contracts.js';
import { mapApp } from './apps/map.js';
import { blackgateApp } from './apps/blackgate.js';
import { gatewayApp } from './apps/gateway.js';
import { softwareApp } from './apps/software.js';
import { storageApp } from './apps/storage.js';
import { bankApp } from './apps/bank.js';
import { newsApp } from './apps/news.js';
import { operatorApp } from './apps/operator.js';
import { systemApp } from './apps/system.js';
import { dsnApp } from './apps/dsn.js';
import { peopleApp } from './apps/people.js';
import { notepadApp } from './apps/notepad.js';
import { cheatApp } from './apps/cheat.js';
import { evaluate, format } from '../../state/calc.js';
import { fail } from './helpers.js';
import { t as tl } from '../../data/language.js';

/// The calculator: `calc eval 12*(3+4)` works a sum out in the prompt.
const calcApp = {
  alias: ['calculator'],
  window: 'calc',
  about: tl('systems.commands.apps.a_calculator'),
  commands: {
    eval: {
      args: '<sum>', help: tl('systems.commands.apps.work_out_a_sum'),
      run(ctx, words) {
        try {
          return [{ text: `${words.join('')} = ${format(evaluate(words.join('')))}`, tone: 'ok' }];
        } catch (err) {
          return fail(err.message);
        }
      },
    },
  },
};

/// Every app's commands. `args` is the usage shown in help.
export const APPS = {
  mail: mailApp,
  contracts: contractsApp,
  map: mapApp,
  blackgate: blackgateApp,
  gateway: gatewayApp,
  software: softwareApp,
  storage: storageApp,
  bank: bankApp,
  news: newsApp,
  operator: operatorApp,
  system: systemApp,
  dsn: dsnApp,
  people: peopleApp,
  notepad: notepadApp,
  cheat: cheatApp,
  calc: calcApp,
};
