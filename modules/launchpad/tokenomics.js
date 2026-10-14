/* launchpad/tokenomics.js. Genera, en el navegador, la ficha tecnica y el tokenomics
   de UNA moneda concreta (nombre, simbolo, contrato, red) como PDF descargable.
   Una pagina por mecanismo, texto desarrollado, marca DecFreedom, sin guiones.
   Sirve como documentacion de respaldo para la solicitud de informacion y logo en BscScan.
   Usa jsPDF local (vendor), sin CDN ni backend. */

/* jsPDF se carga bajo demanda (UMD autocontenido), igual que WalletConnect:
   solo se descarga cuando el usuario pide su tokenomics, no en cada visita. */
let _jspdfCargando = null;
function cargarJsPDF() {
  if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (_jspdfCargando) return _jspdfCargando;
  _jspdfCargando = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = new URL('vendor/jspdf.umd.min.js', new URL('./', import.meta.url)).href;
    sc.async = true;
    sc.onload = () => (window.jspdf && window.jspdf.jsPDF) ? res(window.jspdf.jsPDF) : rej(new Error('jsPDF did not load'));
    sc.onerror = () => rej(new Error('Could not load the PDF library'));
    document.head.appendChild(sc);
  });
  return _jspdfCargando;
}

const GOLD = [201, 150, 42];
const INK = [26, 31, 40];
const INK2 = [60, 66, 75];
const GREY = [150, 157, 167];
const LINE = [223, 221, 213];
const NAVY = [11, 14, 18];
const GOLDSOFT = [232, 184, 75];

/* Contenido del estandar (igual para toda moneda; la ficha de arriba es por moneda). */
const MECANISMOS = [
  {
    titulo: 'Fixed supply',
    lead: 'Your coin follows the BEP20 standard with eighteen decimals, and its entire supply is created a single time, inside the constructor, at the moment of deployment. No function exists to create more units afterward.',
    bloques: [
      ['How it works', 'The total number of coins is written into the contract when it is deployed and can never change. The contract contains no mint function, no owner able to issue new units, and no proxy that could add one in a later version. The quantity that circulates today is the quantity that will exist permanently.'],
      ['Why it matters', 'Hidden or discretionary issuance is one of the most common ways a token loses value, because every new unit dilutes everyone who already holds the coin. By removing issuance entirely, the supply becomes a fixed and auditable quantity that anyone can confirm on chain. Scarcity stops being a claim and becomes a property of the code.'],
      ['For the creator', 'You can state, and let anyone verify, that the supply is permanently capped. This answers the first objection a careful buyer raises, and it lets you describe the economics of your coin with a denominator that never moves.'],
      ['For holders and buyers', 'Every holder keeps a share of the network that cannot be silently reduced. No team can create coins to fund itself or to sell into the market. The fraction a buyer acquires today represents the same fraction of the whole for as long as they hold it.']
    ]
  },
  {
    titulo: 'Guaranteed floor price',
    lead: 'A portion of every sale, between one and five percent chosen at creation, is converted to BNB and stored inside the coin as a permanent reserve. That reserve backs a floor price that any holder can claim at any time.',
    bloques: [
      ['How it works', 'On each sale through the pool, the chosen share of the proceeds is routed into the coin’s own reserve rather than to any person. The floor equals the reserve divided by the circulating supply. Any holder may redeem their coins at any moment: the coins are burned and the holder receives their proportional part of the reserve. Because redemption burns supply in the same proportion that it removes value, the floor per coin never falls, and it rises as trading continues.'],
      ['Why it matters', 'Most coins have no intrinsic value at all, and their price is only sentiment. A reserve backed floor replaces part of that uncertainty with a mathematical lower bound that the contract enforces and that grows with activity. It is not a market price and it is not a promise of profit. It is the minimum a holder can always recover.'],
      ['For the creator', 'You can show buyers that real value accumulates under the coin as it trades, independent of market mood. This tends to attract longer term participants and to soften the panic selling that destroys young coins, because holders know there is a redeemable value beneath the market.'],
      ['For holders and buyers', 'A holder’s worst case stops being zero. Even in a severe downturn, coins can be redeemed for the floor. The more the coin is traded by everyone, the higher that floor climbs, so the activity of the whole market strengthens the protection that each individual holder enjoys.']
    ]
  },
  {
    titulo: 'Locked liquidity',
    lead: 'The trading pool lives inside the public Launchpad contract. There are no liquidity provider tokens to hold or to move, and the reserves stay locked for the term you choose at launch.',
    bloques: [
      ['How it works', 'When you open the pool you deposit your coins together with BNB or USDT. That liquidity is held by the Launchpad contract itself and is not represented by any transferable token. It stays locked until the date you selected, which can be six, twelve or twenty four months, or permanent. Withdrawal is possible only after that date, only by you, and the date can never be shortened by anyone, including the platform.'],
      ['Why it matters', 'Removing pooled liquidity, often called a rug pull, is the most damaging event a token can suffer, because it leaves holders unable to sell at any price. When there are no liquidity tokens to move and the reserves are time locked inside a public contract, that event is structurally impossible for the chosen period.'],
      ['For the creator', 'You can prove the lock on chain, with a date that anyone can read. This is among the strongest trust signals available to a new project, and it costs you nothing beyond committing your own liquidity for a period that you decide.'],
      ['For holders and buyers', 'Everyone trades against a pool that cannot disappear. The ability to exit is protected for the whole lock term, which removes the fear that the market will vanish overnight and lets people participate with confidence.']
    ]
  },
  {
    titulo: 'Founder vesting',
    lead: 'The share you keep for yourself, from zero to twenty percent of the supply, is not delivered all at once. It is released gradually, on chain, over a period of three to twenty four months.',
    bloques: [
      ['How it works', 'Your allocation is held inside the coin and released on a straight line schedule. The amount you can claim at any moment equals your total share multiplied by the time elapsed and divided by the full duration, minus what you have already claimed. There is no cliff, no mechanism for early release, and no administrative override. The schedule is fixed at creation.'],
      ['Why it matters', 'A founder who can sell their entire allocation on the first day has every incentive to do so, and that single action has ended countless projects. A linear release ties the founder’s outcome to the passage of time and to the continued health of the coin.'],
      ['For the creator', 'Committing your own share to a public schedule is a clear statement of intent. It signals that you expect to build value over months rather than exit immediately, which is one of the clearest ways to earn trust early.'],
      ['For holders and buyers', 'Holders are protected from a sudden founder sale. The person who created the coin unlocks their position slowly and visibly, so the market can see exactly how much becomes available and when, with no surprises.']
    ]
  },
  {
    titulo: 'Fair launch guard',
    lead: 'For the first twenty four hours after the pool opens, the contract enforces rules that limit automated bots, and then those rules switch off by themselves.',
    bloques: [
      ['How it works', 'During the opening window, no single wallet can buy more than one percent of the supply from the pool, and buying and selling within the same block is rejected. These checks are enforced by the pool and expire automatically by timestamp once the window ends. The coin itself never restricts ordinary transfers, before or after.'],
      ['Why it matters', 'Automated snipers routinely capture a large share of a new coin in its first seconds and sell it into the first real buyers. By capping early purchases per wallet and blocking same block round trips, the opening is given to a wider set of participants rather than to a handful of bots.'],
      ['For the creator', 'A launch that reaches many hands instead of a few bots tends to be healthier and more stable. You begin with a broader base of holders and with less immediate sell pressure from automated actors.'],
      ['For holders and buyers', 'Ordinary buyers get a realistic chance to enter near the start, at a price that has not already been manipulated by bots cornering the supply. The protection applies to everyone equally during the window.']
    ]
  },
  {
    titulo: 'Ecosystem fee',
    lead: 'The platform charges one half of one percent of what a seller receives, paid in BNB or USDT, and only when coins are sold through the pool. Buying, holding and transferring coins are always free.',
    bloques: [
      ['How it works', 'On a sale, zero point five percent of the proceeds is taken in the pool’s quote asset, never in your coin. It splits into zero point two percent for each of the two platform operators and zero point one percent for DecFreedom staking. The destination addresses are read from the public Launchpad contract. A separate pool fee of zero point three percent stays inside the pool reserves, where it belongs to your locked liquidity. Purchases and wallet to wallet transfers pay nothing at all.'],
      ['Why it matters', 'Because the fee applies only to selling, it never taxes accumulation or ordinary use, and it gently discourages rapid churn, since the only moment that carries a cost is the moment of exit. Every creator pays nothing to launch and nothing to maintain, and the ecosystem earns only when liquidity is actually used to sell. The portion directed to staking returns value to the wider DecFreedom ecosystem in which your coin is traded and discovered.'],
      ['For the creator', 'You keep ninety nine point five percent of every sale, and you pay nothing to create or to operate your coin. The fee is what sustains the infrastructure that keeps your coin verifiable, tradable and discoverable, so the guarantees described in this document continue to hold over time.'],
      ['For holders and buyers', 'Holders are never charged for buying or for moving their coins. The only fee is a small one at the point of sale, which also reduces constant selling pressure and therefore tends to protect the price at which earlier buyers entered. It funds the ecosystem that keeps the market, the public page and the tooling running for everyone.']
    ]
  }
];

const OWNERSHIP = {
  kicker: 'Ownership and trust',
  titulo: 'Ownership and trust',
  lead: 'This section describes who controls the coin, and what no one can control, once it is deployed.',
  bloques: [
    ['You own your supply', 'The entire supply is minted to you, the creator. The part you keep and the part that vests to you over time are both yours, and the platform holds no share of your coin, now or in the future. You therefore hold the whole of the supply you decided to create, which gives you full authority over what you do with it.'],
    ['Verified and immutable', 'Every coin is deployed from the same public, verified source, so its complete code is visible on BscScan from the moment it exists. The coin is a standard token with no proxy, no upgrade path, no pause switch, no block list and no transfer tax. The only privileged actions are the mechanisms described in this document, and each is bounded by the parameters you set at creation and cannot be changed afterward.'],
    ['Non custodial', 'DecFreedom never holds your funds or your coins and cannot reverse any transaction. Every action is taken by you, from your wallet, with your own signature. If you lose access to your wallet, no one can recover your creator rights, because no one else ever held them.'],
    ['What a careful buyer can confirm', 'Because the contract is public and verified, anyone can independently check the supply, the floor reserve, the liquidity lock and its date, the vesting schedule and the fee, directly on chain. Nothing in this document needs to be taken on faith, because all of it is verifiable.']
  ]
};

const DISTRIBUTION = {
  kicker: 'Distribution',
  titulo: 'Distribution and discoverability',
  lead: 'A coin is only useful if people can find it and trade it. Every coin created on DecFreedom is reachable through the same public surfaces from the first block.',
  bloques: [
    ['Listed in the DecFreedom Swap', 'Your coin can be found in the DecFreedom Swap by its name, its symbol or its contract address, immediately after creation. There is no listing fee and no waiting period.'],
    ['Public coin page', 'Each coin has a public page that reads entirely from the chain. It shows a price chart built from the pool’s own trade events, a live record of buys and sells, and the current state of the reserve, the liquidity lock and the vesting schedule. Because the page is built from on chain data, it cannot be edited to misrepresent the coin.'],
    ['Embeddable widget', 'You can place a small swap widget on your own website or community page with a single embed. It defaults to your pair, and all of the volume it generates routes through the same public pool, so every sale continues to feed your reserve floor and everyone trades against the same locked liquidity.']
  ]
};

const BSCSCAN = {
  kicker: 'Using this document',
  titulo: 'Submitting your token to BscScan',
  lead: 'BscScan lets a project publish its token information and logo once the contract is verified. This document provides the technical description of your coin and of the DecFreedom standard that you can attach as supporting material.',
  bloques: [
    ['Already done for you', 'The contract source of your coin is published and verified on BscScan automatically when you create it. Verification is the main technical prerequisite for a token information request, and it is complete from the first moment.'],
    ['What you still provide', 'The submission is made only through the official BscScan token update form. It asks for a working website with clear information and no dead links, a project email on that same domain, a logo in the format BscScan specifies, which is SVG at thirty two by thirty two or PNG at sixty four by sixty four, a neutral description of the project, and the full links to your official social channels.'],
    ['Why this matters', 'The logo and the website describe your specific project, so they remain your responsibility. This document covers the part that belongs to the standard: how the coin is built and what its contract guarantees. Presenting both together gives a reviewer, an exchange or an aggregator a complete and verifiable picture of the token.']
  ]
};

/* ─────────── Dibujo ─────────── */
const A4 = { w: 595.28, h: 841.89 };
const M = 54, CW = A4.w - 2 * M;

function pie(doc, sym, n, total) {
  doc.setDrawColor(...LINE); doc.setLineWidth(0.5); doc.line(M, A4.h - 46, A4.w - M, A4.h - 46);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GREY);
  doc.text('DecFreedom Launchpad   Token Standard   ' + sym, M, A4.h - 32);
  doc.text('Page ' + n + ' of ' + total, A4.w - M, A4.h - 32, { align: 'right' });
}

function parrafos(doc, bloques, y) {
  for (const b of bloques) {
    const [h, t] = Array.isArray(b) ? b : [null, b];
    if (h) { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...GOLD); doc.text(h, M, y); y += 16; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...INK2);
    const ls = doc.splitTextToSize(t, CW);
    doc.text(ls, M, y, { lineHeightFactor: 1.42 });
    y += ls.length * 10.5 * 1.42 + 12;
  }
  return y;
}

function paginaContenido(doc, st, kicker, titulo, lead, bloques) {
  doc.addPage(); st.n++;
  let y = 66;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GOLD); doc.setCharSpace(1.6);
  doc.text(kicker.toUpperCase(), M, y); doc.setCharSpace(0);
  y += 24;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...INK);
  const tl = doc.splitTextToSize(titulo, CW); doc.text(tl, M, y); y += tl.length * 23;
  y += 2; doc.setDrawColor(...GOLD); doc.setLineWidth(2.5); doc.line(M, y, M + 42, y); y += 22;
  if (lead) { doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(...INK); const ll = doc.splitTextToSize(lead, CW); doc.text(ll, M, y, { lineHeightFactor: 1.4 }); y += ll.length * 12 * 1.4 + 16; }
  const yEnd = parrafos(doc, bloques, y);
  pie(doc, st.sym, st.n, st.total);
  return yEnd;
}

function portada(doc, st, coin) {
  st.n = 1;
  // banda superior
  doc.setFillColor(...NAVY); doc.rect(0, 0, A4.w, 232, 'F');
  doc.setFillColor(...GOLDSOFT); doc.rect(0, 232, A4.w, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GOLDSOFT); doc.setCharSpace(3);
  doc.text('DECFREEDOM LAUNCHPAD', M, 70); doc.setCharSpace(0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(27); doc.setTextColor(255, 255, 255);
  doc.text('Token Standard', M, 118);
  doc.text('and Technical Documentation', M, 150);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11.5); doc.setTextColor(199, 205, 214);
  const sub = doc.splitTextToSize('A complete description of ' + coin.nombre + ' and of the mechanisms its contract enforces on BNB Smart Chain.', CW);
  doc.text(sub, M, 184, { lineHeightFactor: 1.4 });

  // ficha de identidad de la moneda
  let y = 272;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GOLD); doc.setCharSpace(1.6);
  doc.text('TOKEN IDENTITY', M, y); doc.setCharSpace(0); y += 16;
  const filas = [
    ['Name', coin.nombre],
    ['Symbol', coin.simbolo],
    ['Contract address', coin.contrato],
    ['Network', 'BNB Smart Chain (chain ID 56)'],
    ['Decimals', '18'],
    ['Token standard', 'BEP20'],
    ['Total supply', coin.supply ? coin.supply : 'Fixed at creation'],
    ['Contract status', 'Source verified on BscScan']
  ];
  doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
  for (const [k, v] of filas) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GREY); doc.text(k, M, y + 13);
    doc.setFont('helvetica', k === 'Contract address' ? 'normal' : 'bold'); doc.setFontSize(k === 'Contract address' ? 9.5 : 11); doc.setTextColor(...INK);
    const vl = doc.splitTextToSize(String(v), CW - 150);
    doc.text(vl, M + 150, y + 13);
    const rh = Math.max(26, vl.length * 12 + 10);
    doc.line(M, y + rh, A4.w - M, y + rh);
    y += rh;
  }
  // nota introductoria
  y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...INK2);
  const intro = doc.splitTextToSize('Every coin created on the DecFreedom Launchpad is a standard BEP20 token that carries, in its own immutable contract, a set of mechanisms designed to make it verifiable and resilient: a reserve backed floor price, liquidity that is locked and cannot be pulled, a founder allocation that releases over time, fair launch limits, and a transparent fee model. The sections that follow explain each mechanism, why it exists, and how it affects both the creator and the people who hold or use the coin.', CW);
  doc.text(intro, M, y, { lineHeightFactor: 1.45 });
  pie(doc, st.sym, 1, st.total);
}

function paginaFinal(doc, st) {
  let y = paginaContenido(doc, st, BSCSCAN.kicker, BSCSCAN.titulo, BSCSCAN.lead, BSCSCAN.bloques);
  y += 6;
  doc.setDrawColor(...GOLD); doc.setLineWidth(2.5); doc.line(M, y, M + 42, y); y += 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GOLD); doc.setCharSpace(1.4);
  doc.text('IMPORTANT', M, y); doc.setCharSpace(0); y += 15;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK2);
  const dis = doc.splitTextToSize('Creating a coin does not give it value. Its price is only what other people are willing to pay, and most new coins lose their value. This document describes the mechanisms the contract enforces for this token. It is not financial advice and not a promise of any return. Issuing a token may be regulated where you live, and complying with the applicable rules is your responsibility.', CW);
  doc.text(dis, M, y, { lineHeightFactor: 1.4 });
}

/** Construye el documento (sin descargar). coin = { nombre, simbolo, contrato, supply? }. */
export function construirDoc(JsPDF, coin) {
  const doc = new JsPDF({ unit: 'pt', format: 'a4' });
  const st = { sym: coin.simbolo || 'TOKEN', n: 0, total: 1 + MECANISMOS.length + 3 };
  portada(doc, st, coin);
  for (let i = 0; i < MECANISMOS.length; i++) {
    const m = MECANISMOS[i];
    paginaContenido(doc, st, 'Mechanism ' + (i + 1) + ' of ' + MECANISMOS.length, m.titulo, m.lead, m.bloques);
  }
  paginaContenido(doc, st, OWNERSHIP.kicker, OWNERSHIP.titulo, OWNERSHIP.lead, OWNERSHIP.bloques);
  paginaContenido(doc, st, DISTRIBUTION.kicker, DISTRIBUTION.titulo, DISTRIBUTION.lead, DISTRIBUTION.bloques);
  paginaFinal(doc, st);
  return doc;
}

/** Genera y descarga el PDF de la moneda. */
export async function descargarTokenomics(coin) {
  const JsPDF = await cargarJsPDF();
  construirDoc(JsPDF, coin).save('DecFreedom_' + (coin.simbolo || 'TOKEN') + '_Tokenomics.pdf');
}
