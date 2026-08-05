// Mapa de portas conhecidas -> nome de aplicação. Heurística simples (não é
// inspeção profunda de pacotes), mas cobre a grande maioria do tráfego real
// de uma rede corporativa.
const PORTAS_CONHECIDAS: Record<number, string> = {
  20: "FTP (dados)", 21: "FTP", 22: "SSH", 23: "Telnet",
  25: "SMTP", 53: "DNS", 67: "DHCP", 68: "DHCP",
  80: "HTTP", 110: "POP3", 123: "NTP", 143: "IMAP",
  161: "SNMP", 162: "SNMP Trap", 389: "LDAP", 443: "HTTPS",
  445: "SMB", 465: "SMTPS", 500: "IPsec VPN", 587: "SMTP (submissão)",
  636: "LDAPS", 993: "IMAPS", 995: "POP3S", 1433: "SQL Server",
  1723: "PPTP", 1812: "RADIUS", 1813: "RADIUS", 2055: "NetFlow",
  3306: "MySQL", 3389: "RDP", 4500: "IPsec VPN (NAT-T)",
  5060: "SIP", 5432: "PostgreSQL", 5900: "VNC", 6379: "Redis",
  8080: "HTTP (alt)", 8443: "HTTPS (alt)", 9995: "NetFlow", 27017: "MongoDB",
};

export function mapearAplicacao(porta: number | null | undefined): string {
  if (!porta) return "Desconhecida";
  return PORTAS_CONHECIDAS[porta] || `Outro (porta ${porta})`;
}

const PROTOCOLOS_IP: Record<number, string> = { 1: "ICMP", 6: "TCP", 17: "UDP", 47: "GRE", 50: "ESP", 51: "AH" };
export function nomeProtocoloIp(numero: number | null | undefined): string {
  if (numero == null) return "?";
  return PROTOCOLOS_IP[numero] || `Proto ${numero}`;
}
