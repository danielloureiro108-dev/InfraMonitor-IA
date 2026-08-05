// Pacotes sem tipos oficiais no DefinitelyTyped: declaramos como "any" para
// não travar a compilação. As chamadas a essas libs já são encapsuladas em
// pingService.ts e snmpService.ts, então a falta de tipagem fina aqui não
// afeta o resto do código (que continua tipado normalmente).
declare module "ping";
declare module "net-snmp";
