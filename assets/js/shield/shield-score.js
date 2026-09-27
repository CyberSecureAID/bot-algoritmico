/* shield-score.js — Wallet Security Score profesional (0-100).
   Modelo de 4 componentes ponderados, como los servicios de auditoría pro:
     Approvals 40% · Interactions 30% · Patterns 20% · Age 10%
   Devuelve el score global, el nivel de riesgo, cada componente con su
   puntuación y explicación, factores y consejos accionables. */

export function calcularScore(permisos, stats) {
  stats = stats || {};
  const externos = permisos.filter(p => !p.nuestro);
  const nuestros = permisos.filter(p => p.nuestro);
  const ilimitadosExt = externos.filter(p => p.ilimitado);
  const limitadosExt = externos.filter(p => !p.ilimitado);

  // ── Componente 1: APPROVALS (40%) ──
  let cApprovals = 100;
  cApprovals -= Math.min(70, ilimitadosExt.length * 18);
  cApprovals -= Math.min(25, limitadosExt.length * 5);
  cApprovals -= Math.min(10, Math.max(0, externos.length - 5) * 2);
  if (cApprovals < 0) cApprovals = 0;

  // ── Componente 2: INTERACTIONS (30%) ──
  // sin datos de verificación de contratos disponibles gratis; se estima por
  // la proporción de spenders externos desconocidos frente a los confiables.
  let cInteractions = 100;
  const totalSpenders = externos.length + nuestros.length;
  if (totalSpenders > 0) {
    const ratioExterno = externos.length / totalSpenders;
    cInteractions = Math.round(100 - ratioExterno * 45);
  }
  if (ilimitadosExt.length >= 3) cInteractions -= 15;
  if (cInteractions < 0) cInteractions = 0; if (cInteractions > 100) cInteractions = 100;

  // ── Componente 3: PATTERNS (20%) ──
  // actividad: una wallet con muchísimas tx concentradas o con muy poca
  // actividad puntúa distinto. Usamos txCount como señal de madurez de uso.
  let cPatterns = 85;
  const tx = Number(stats.txCount) || 0;
  if (tx > 50) cPatterns = 95;
  if (tx > 500) cPatterns = 100;
  if (tx > 0 && tx <= 5) cPatterns = 70;
  if (cPatterns > 100) cPatterns = 100;

  // ── Componente 4: AGE (10%) ──
  let cAge = 60;
  const dias = Number(stats.edadDias) || 0;
  if (dias > 30) cAge = 75;
  if (dias > 180) cAge = 90;
  if (dias > 365) cAge = 100;
  if (dias > 0 && dias <= 7) cAge = 40;

  // ── Score global ponderado ──
  let score = Math.round(cApprovals * 0.40 + cInteractions * 0.30 + cPatterns * 0.20 + cAge * 0.10);
  if (score < 0) score = 0; if (score > 100) score = 100;

  // nivel de riesgo (estándar de la industria)
  let nivel, color, riesgo;
  if (score >= 90) { nivel = 'Excellent'; riesgo = 'SAFE'; color = '#2ebd85'; }
  else if (score >= 70) { nivel = 'Good'; riesgo = 'LOW RISK'; color = '#5ac8fa'; }
  else if (score >= 50) { nivel = 'Fair'; riesgo = 'MEDIUM RISK'; color = '#e8b84b'; }
  else if (score >= 30) { nivel = 'At risk'; riesgo = 'HIGH RISK'; color = '#f8934b'; }
  else { nivel = 'Critical'; riesgo = 'CRITICAL'; color = '#f6465d'; }

  // componentes para mostrar (con barra y explicación)
  const componentes = [
    { nombre: 'Token approvals', peso: 40, valor: Math.round(cApprovals),
      detalle: ilimitadosExt.length > 0 ? (ilimitadosExt.length + ' unlimited approval' + (ilimitadosExt.length>1?'s':'') + ' found. These let a contract move all of a token.') : (externos.length > 0 ? 'Some external approvals, but none unlimited.' : 'No external approvals. Nothing can touch your tokens.') },
    { nombre: 'Contract interactions', peso: 30, valor: Math.round(cInteractions),
      detalle: externos.length > 0 ? (externos.length + ' external contract' + (externos.length>1?'s':'') + ' can act on this wallet.') : 'Only trusted contracts interact with this wallet.' },
    { nombre: 'Activity patterns', peso: 20, valor: Math.round(cPatterns),
      detalle: tx > 0 ? (tx.toLocaleString() + ' transactions. Healthy, consistent usage.') : 'Limited transaction history to analyse.' },
    { nombre: 'Wallet age', peso: 10, valor: Math.round(cAge),
      detalle: dias > 0 ? ('Active for ' + (dias > 365 ? (Math.floor(dias/365) + ' year' + (Math.floor(dias/365)>1?'s':'')) : (dias + ' days')) + '. Older wallets are lower risk.') : 'New or freshly seen wallet.' }
  ];

  // factores clave
  const factores = [];
  if (ilimitadosExt.length > 0) factores.push({ tipo: 'bad', texto: ilimitadosExt.length + ' unlimited external permission' + (ilimitadosExt.length>1?'s':''), detalle: 'Highest risk. A contract can drain all of that token.' });
  if (limitadosExt.length > 0) factores.push({ tipo: 'warn', texto: limitadosExt.length + ' limited external permission' + (limitadosExt.length>1?'s':''), detalle: 'Lower risk, still worth reviewing.' });
  if (externos.length === 0) factores.push({ tipo: 'ok', texto: 'No external permissions', detalle: 'Nothing outside our platform can move your tokens.' });
  if (nuestros.length > 0) factores.push({ tipo: 'ok', texto: nuestros.length + ' trusted permission' + (nuestros.length>1?'s':'') + ' (Cripto Cuba)', detalle: 'Safe and needed to use our services.' });

  const consejos = [];
  if (ilimitadosExt.length > 0) consejos.push('Revoke the unlimited permissions you do not actively use.');
  if (externos.length > 8) consejos.push('You have many open permissions. Clean up the old ones.');
  if (score >= 90) consejos.push('Your wallet is in great shape. Re-scan monthly to stay protected.');
  else if (score >= 70) consejos.push('Solid, but a few fixes would push you to excellent.');
  else consejos.push('Act on the flagged items to raise your score fast.');

  return {
    score, nivel, riesgo, color, componentes, factores, consejos,
    resumen: { ilimitados: ilimitadosExt.length, limitados: limitadosExt.length, nuestros: nuestros.length, total: permisos.length }
  };
}
