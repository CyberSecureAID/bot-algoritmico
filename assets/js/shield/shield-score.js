/* shield-score.js — Health Score de la wallet (0-100).
   Calcula una puntuación de seguridad a partir de los permisos escaneados:
   penaliza los permisos ilimitados externos, los spenders desconocidos, y
   el número total de permisos abiertos. Los permisos a NUESTROS contratos
   no penalizan (son confiables). Devuelve score + desglose + consejos. */

/* Calcula el score a partir de la lista de permisos (la que da escanearApprovals). */
export function calcularScore(permisos) {
  const externos = permisos.filter(p => !p.nuestro);
  const nuestros = permisos.filter(p => p.nuestro);
  const ilimitadosExt = externos.filter(p => p.ilimitado);
  const limitadosExt = externos.filter(p => !p.ilimitado);

  // Puntuación base 100, se resta por riesgo.
  let score = 100;
  // cada permiso ilimitado externo pesa mucho (-14, hasta 70)
  score -= Math.min(70, ilimitadosExt.length * 14);
  // cada permiso limitado externo pesa poco (-4, hasta 20)
  score -= Math.min(20, limitadosExt.length * 4);
  // muchos permisos totales externos abiertos = más superficie de ataque (-2 c/u desde el 6º)
  const extra = Math.max(0, externos.length - 5);
  score -= Math.min(10, extra * 2);
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  // nivel y color
  let nivel, color;
  if (score >= 85) { nivel = 'Excellent'; color = '#34d399'; }
  else if (score >= 65) { nivel = 'Good'; color = '#5ac8fa'; }
  else if (score >= 40) { nivel = 'At risk'; color = '#f8b34b'; }
  else { nivel = 'Critical'; color = '#f87171'; }

  // desglose de factores
  const factores = [];
  if (ilimitadosExt.length > 0)
    factores.push({ tipo: 'bad', texto: `${ilimitadosExt.length} unlimited external permission${ilimitadosExt.length>1?'s':''}`, detalle: 'These let a contract move all of that token. Highest risk.' });
  if (limitadosExt.length > 0)
    factores.push({ tipo: 'warn', texto: `${limitadosExt.length} limited external permission${limitadosExt.length>1?'s':''}`, detalle: 'Lower risk, but still worth reviewing.' });
  if (externos.length === 0)
    factores.push({ tipo: 'ok', texto: 'No external permissions', detalle: 'Nothing outside our platform can touch your tokens.' });
  if (nuestros.length > 0)
    factores.push({ tipo: 'ok', texto: `${nuestros.length} trusted permission${nuestros.length>1?'s':''} (Cripto Cuba)`, detalle: 'These are safe and needed to use our services.' });

  // consejos accionables
  const consejos = [];
  if (ilimitadosExt.length > 0) consejos.push('Revoke unlimited permissions you don\'t actively use.');
  if (externos.length > 8) consejos.push('You have many open permissions — clean up the old ones.');
  if (score >= 85) consejos.push('Your wallet is in great shape. Re-scan monthly to stay safe.');

  return { score: Math.round(score), nivel, color, factores, consejos,
    resumen: { ilimitados: ilimitadosExt.length, limitados: limitadosExt.length, nuestros: nuestros.length, total: permisos.length } };
}
