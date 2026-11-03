// The enumerations the world and the game state use. They are strings, so a
// save file reads plainly and the editor can name them.

// -- companies ---------------------------------------------------------------

export const CO_LABEL = {
  tech: 'TECHNOLOGY', bank: 'FINANCE', health: 'HEALTHCARE', retail: 'RETAIL',
  media: 'MEDIA', aiLab: 'AI RESEARCH', gov: 'GOVERNMENT', energy: 'ENERGY',
  telecom: 'TELECOM', crypto: 'CRYPTO', security: 'SECURITY', logistics: 'LOGISTICS',
  university: 'ACADEMIC',
};

/// The extra hardening a company of this kind gives its hosts.
export const CO_SEC_BONUS = {
  bank: 2, gov: 2, security: 3, aiLab: 2, crypto: 2, tech: 1, telecom: 1, health: 1,
};

/// Which group of name endings a company takes.
export const CO_PREFIX_GROUP = {
  bank: 'fin', crypto: 'fin', media: 'media', tech: 'tech', aiLab: 'tech', security: 'tech',
  health: 'health', gov: 'gov', energy: 'energy', telecom: 'telecom', retail: 'retail',
  logistics: 'logistics', university: 'university',
};

// -- hosts -------------------------------------------------------------------

export const HOST_LABEL = {
  public: 'PUBLIC', corporate: 'CORPORATE', bank: 'FINANCIAL', gov: 'GOVERNMENT',
  aiLab: 'AI CLUSTER', relay: 'RELAY', router: 'ROUTER', datacenter: 'DATACENTER',
};

// -- services ----------------------------------------------------------------

export const SERVICE_LABEL = {
  web: 'WEB', mail: 'MAIL', admin: 'ADMIN', records: 'RECORDS', bank: 'BANKING',
  voice: 'VOICE', db: 'DATABASE', ai: 'AI CONTROL', proxy: 'PROXY', auth: 'AUTH',
};

// -- work --------------------------------------------------------------------

export const MISSION_KINDS = [
  'retrieve', 'delete', 'modify', 'transfer', 'destroy', 'model', 'story',
];

export const MISSION_LABEL = {
  retrieve: 'RETRIEVAL', delete: 'ERASURE', modify: 'ALTERATION', transfer: 'TRANSFER',
  destroy: 'SABOTAGE', model: 'EXTRACTION', story: 'DIRECTIVE',
};

/// The highest operator rating: the LEGEND rank starts at 120.
export const RATING_MAX = 150;

/// The hardware kinds the gateway takes.
export const HW_KINDS = ['cpu', 'accel', 'fpga', 'hsm', 'storage', 'modem', 'security'];

export const HW_LABEL = {
  cpu: 'COMPUTE', accel: 'ACCELERATOR', fpga: 'FPGA', hsm: 'HSM', storage: 'STORAGE', modem: 'MODEM', security: 'SECURITY', gateway: 'GATEWAY',
};

/// The price of a tool at a level, over its level one price.
export const SW_PRICE_MULT = [1, 1, 3.4, 9, 21, 46];

/// The tools the operator starts with.
export const STARTER_TOOLS = ['PasswordCracker', 'FileCopier', 'LogDeleter'];
