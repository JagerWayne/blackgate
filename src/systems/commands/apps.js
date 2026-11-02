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
};
