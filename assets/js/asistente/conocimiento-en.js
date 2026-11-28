/* ================================================================
   JESUS - DecFreedom assistant - ENGLISH knowledge base
   ================================================================
   window.NP_BOT_KB_EN. El motor lo usa cuando el idioma es ingles.

   HEREDA todo el 'bot' de la base española (window.NP_BOT_KB) y solo
   sobrescribe lo VISIBLE traducido (greeting, quick, sugerencias,
   fallback). Asi el objeto bot tiene TODAS las propiedades que el motor
   pueda pedir (after, clarify, triage, contact, etc.) y nunca falla por
   una que falte. El kb (respuestas) sí es propio, en inglés.
================================================================ */
(function () {
  var esBase = (window.NP_BOT_KB && window.NP_BOT_KB.bot) ? window.NP_BOT_KB.bot : {};

  // Copia superficial del bot español + sobrescritura de lo traducido.
  var botEN = Object.assign({}, esBase, {
    name: 'Jesús',
    role: 'DecFreedom assistant',
    greeting: [
      "Hi, I'm **Jesús**. I'm here to help.\n\nWhat do you need?",
      "Hello! My name is **Jesús**, from DecFreedom.\n\nTell me how I can help.",
      "Hey there. I'm **Jesús**.\n\nWhat can I help you with today?",
      "Hi! I'm **Jesús**, from the DecFreedom team.\n\nWhat would you like to know?"
    ],
    quick: [
      { label: 'What is this?',   q: 'what bots are there' },
      { label: 'How do I start?', q: 'how do i start' },
      { label: 'What bots?',      q: 'what bots are there' },
      { label: 'Is it safe?',     q: 'is my money safe' },
      { label: 'What fees?',      q: 'what does it cost' },
      { label: 'Talk to someone', q: 'contact' }
    ],
    fallback: [
      "I'm not sure I got that. I can explain the bots (Smart Grid, Accumulator, Cash Out, DCA), the tools, fees, or how to start. Which one?",
      "I didn't quite catch that. Try asking about a specific bot, the tools, or how to begin.",
      "Hmm, I don't have a clear answer for that. I can help with the bots, tools, security or fees. What would you like?"
    ]
  });

  window.NP_BOT_KB_EN = { bot: botEN, kb: [
    {
      topic: 'what bots are there',
      keys: ['what bots are there', 'what bots', 'the 4 bots', 'the four bots', 'bots', 'list of bots', 'which bots', 'kinds of bots', 'types of bots', 'bot types'],
      answer: [
        "There are **four bots**, each for a different situation:\n\n**Smart Grid** — buys low and sells high inside a range, over and over.\n**Accumulator** — buys the dip and sells all at once at your target.\n**Cash Out** — sells crypto you already hold when it hits your price.\n**DCA** — buys a fixed amount every so often, no timing needed.\n\nWhich one do you want to look at?"
      ],
      opciones: [
        { label: 'Smart Grid',  q: 'what is smart grid' },
        { label: 'Accumulator', q: 'how does the accumulator work' },
        { label: 'Cash Out',    q: 'what is cash out' },
        { label: 'DCA',         q: 'what is dca' }
      ]
    },
    {
      topic: 'what is smart grid',
      keys: ['what is smart grid', 'smart grid', 'smart grid bot', 'the grid bot', 'grid bot', 'grid', 'how does smart grid work', 'explain smart grid'],
      answer: [
        "**Smart Grid** splits a price range into levels. It buys when the price drops to one level and sells when it rises to the next. It repeats this while the price moves inside the range, and only ever closes a grid in profit.\n\nIt works best when the price goes up and down within a range, again and again. If the price leaves the range, the bot stops and waits."
      ],
      opciones: [
        { label: 'When does it earn?', q: 'when does smart grid earn' },
        { label: 'Other bots',         q: 'what bots are there' }
      ]
    },
    {
      topic: 'how does the accumulator work',
      keys: ['how does the accumulator work', 'accumulator', 'accumulator bot', 'the accumulator', 'what is accumulator', 'explain accumulator'],
      answer: [
        "**Accumulator** buys more the more the price falls, to lower your average price, and sells everything at once when it reaches your target.\n\nIt earns when the price recovers above the average it built up. The risk: if the price keeps falling and never comes back, it doesn't sell and you're left holding the coin."
      ],
      opciones: [
        { label: 'Other bots', q: 'what bots are there' }
      ]
    },
    {
      topic: 'what is cash out',
      keys: ['what is cash out', 'cash out', 'cashout', 'cash out bot', 'the cash out', 'how does cash out work', 'explain cash out'],
      answer: [
        "**Cash Out** sells the crypto you already hold when the price reaches the target you set. One operation, at the price or percentage you choose.\n\nIt fires whenever your target is hit, day or night, without you watching. The catch: the price might never reach it, and if it rises much higher, you'll have sold earlier."
      ],
      opciones: [
        { label: 'Other bots', q: 'what bots are there' }
      ]
    },
    {
      topic: 'what is dca',
      keys: ['what is dca', 'dca', 'dca bot', 'the dca', 'dollar cost averaging', 'how does dca work', 'explain dca'],
      answer: [
        "**DCA** buys a fixed amount every so often, without watching the price. It smooths your entry price over time instead of betting everything on one day.\n\nIt's good for the long run. Note: it only buys, it doesn't sell — so if the coin falls for years, your average drops but you're still down."
      ],
      opciones: [
        { label: 'Other bots', q: 'what bots are there' }
      ]
    },
    {
      topic: 'liquidity pools',
      keys: ['liquidity pools', 'liquidity pool', 'what is liquidity pools', 'what are liquidity pools', 'liquidity', 'liquidation map', 'heat map'],
      answer: [
        "**Liquidity Pools** shows you where the money is trapped in the market.\n\nOn a normal chart you see the price. Here you also see **the levels where positions are waiting to be liquidated** — and the price tends to go looking for them.\n\nIt's a heat map over the chart: each colour tells you how much liquidity sits at that price. Blue is little, green medium, **red is a wall**. Those walls act like magnets."
      ],
      opciones: [
        { label: 'Heat Pools',   q: 'what is heat pools' },
        { label: 'Smart Levels', q: 'what is smart levels' }
      ]
    },
    {
      topic: 'what is heat pools',
      keys: ['what is heat pools', 'heat pools', 'heat pool', 'the order book'],
      answer: [
        "**Heat Pools** watches the order book. The order book lies: most large orders are fake, placed to trick you. Heat Pools watches every one and tells you which have real money behind them.\n\nIt's how you see what the big players are actually doing, instead of what they want you to think."
      ],
      opciones: [
        { label: 'Liquidity Pools', q: 'liquidity pools' },
        { label: 'Smart Levels',    q: 'what is smart levels' }
      ]
    },
    {
      topic: 'what is smart levels',
      keys: ['what is smart levels', 'smart levels', 'smart level', 'levels tool', 'structural logic'],
      answer: [
        "**Smart Levels** reads the market structure and draws the exact entry and exit levels on the chart, explaining why at each step.\n\nInstead of one more indicator to interpret, it gives you a plan: where to buy, where the stop goes, and the targets."
      ],
      opciones: [
        { label: 'Liquidity Pools', q: 'liquidity pools' },
        { label: 'Heat Pools',      q: 'what is heat pools' }
      ]
    },
    {
      topic: 'how do i start',
      keys: ['how do i start', 'how to start', 'im new', 'i am new', 'getting started', 'where do i begin', 'how do i begin', 'first steps'],
      answer: [
        "Getting started is simple:\n\n1. **Connect your wallet** (top right). No sign-up, no KYC.\n2. Pick a bot — if unsure, the **Smart Grid** on the Equilibrado preset is the usual first choice.\n3. Set the amount and confirm. Your money stays in your wallet the whole time.\n\nWant me to walk you through choosing a bot?"
      ],
      opciones: [
        { label: 'Which bot for me?', q: 'what bots are there' },
        { label: 'Is it safe?',       q: 'is my money safe' },
        { label: 'How much do I need?', q: 'how much money do i need' }
      ]
    },
    {
      topic: 'is my money safe',
      keys: ['is my money safe', 'is it safe', 'security', 'safe', 'can you steal my money', 'do you hold my money', 'non custodial', 'custody'],
      answer: [
        "Your money **never leaves your wallet**. This platform is non-custodial: there's no deposit and no account balance. The contract only gets permission to move a **exact amount** — never unlimited — and you can revoke that permission whenever you want, from your profile.\n\nWe can't move your funds beyond the permission you grant. And you're the only one who holds your keys."
      ],
      opciones: [
        { label: 'How do I revoke?', q: 'how do i revoke permission' },
        { label: 'How do I start?',  q: 'how do i start' }
      ]
    },
    {
      topic: 'how much money do i need',
      keys: ['how much money do i need', 'how much do i need', 'minimum', 'how much to start', 'minimum amount', 'starting amount'],
      answer: [
        "You can start with around **50 USDT**. The presets are tuned so each grid earns real profit after the network gas and the exchange fee, even at that amount.\n\nYou also keep a small tank of BNB for gas — it's yours and you withdraw it whenever you like."
      ],
      opciones: [
        { label: 'What does it cost?', q: 'what does it cost' },
        { label: 'How do I start?',    q: 'how do i start' }
      ]
    },
    {
      topic: 'what does it cost',
      keys: ['what does it cost', 'cost', 'price', 'fees', 'how much do you charge', 'commission', 'what do you charge'],
      answer: [
        "About **1 dollar a month** to activate, and then you can create all the bots you want. **No percentage on your trades from us.**\n\nWhat you do pay is the network gas — cents per operation — which goes to BNB Chain, not to us, plus the DEX fee that PancakeSwap charges on the swap."
      ],
      opciones: [
        { label: 'Is it safe?',     q: 'is my money safe' },
        { label: 'How do I start?', q: 'how do i start' }
      ]
    },
    {
      topic: 'how do i revoke permission',
      keys: ['how do i revoke permission', 'revoke', 'remove permission', 'cancel permission', 'revoke allowance'],
      answer: [
        "From your **profile**, in the permissions section, there's a button to revoke. The moment you do, the contract can no longer touch anything. It's not a promise buried in a paragraph — it's a real button that works instantly."
      ],
      opciones: [
        { label: 'Is it safe?', q: 'is my money safe' }
      ]
    },

    {
      topic: 'when does smart grid earn',
      keys: ['when does smart grid earn', 'when does the grid earn', 'when does grid make money',
             'when does smart grid win', 'when do i earn with grid', 'does grid always earn'],
      answer: [
        "**Smart Grid** earns while the price moves up and down **inside the range** you set: each time it drops to a level it buys, and each time it rises to the next it sells, closing that step in profit.\n\nIt earns nothing while the price leaves the range and doesn't come back. So it works best on a coin that swings sideways, again and again, not one in a straight line up or down."
      ],
      opciones: [
        { label: 'Other bots', q: 'what bots are there' }
      ]
    },

    /* ══════════════ WHAT DECFREEDOM IS ══════════════ */
    {
      topic: 'what is decfreedom',
      keys: ['what is decfreedom', 'what is this', 'what is this platform', 'what is this site',
             'decfreedom', 'what do you do', 'what is this app', 'what can i do here',
             'tell me about decfreedom', 'explain the platform', 'what is dec freedom',
             'whats this', 'what is it', 'what services', 'first time here', 'what is this page'],
      answer: [
        "**DecFreedom** is a non-custodial crypto platform on BNB Smart Chain. Everything runs from your own wallet: there's no deposit and no account balance.\n\nUnder one roof you get trading bots, instant swaps, a token launchpad, a pro terminal, spot trading, staking, a wallet-security Shield and a person-to-person marketplace. Which part do you want to see?"
      ],
      opciones: [
        { label: 'The bots',   q: 'what bots are there' },
        { label: 'Is it safe?', q: 'is my money safe' },
        { label: 'How do I start?', q: 'how do i start' }
      ]
    },
    {
      topic: 'is this a scam',
      keys: ['is this a scam', 'scam', 'is it a scam', 'fraud', 'is this real', 'is it real',
             'is it legit', 'can i trust this', 'will you steal my money', 'rug pull', 'is this safe to use',
             'are you going to rob me', 'i dont trust this', 'is this legitimate'],
      answer: [
        "It's the right question, and I'm glad you asked.\n\n**Short answer: I won't ask you to trust me, and I won't.** What I can tell you is that here you **never deposit your money anywhere**. It stays in your wallet. If this were a scam, there'd be nothing to steal.",
        "Good that you ask — there's a lot of fraud in crypto. What sets us apart: **we never touch your money.** No deposit, no balance of ours, nothing to give back. Your wallet is yours the whole time.\n\nAnd you can check it yourself: every contract is public on BscScan, and nobody legitimate will **ever** ask for your recovery phrase."
      ],
      opciones: [
        { label: 'Is my money safe?', q: 'is my money safe' },
        { label: 'Who is behind this?', q: 'who is behind this' }
      ]
    },
    {
      topic: 'who is behind this',
      keys: ['who is behind this', 'who is behind', 'who made this', 'who runs this', 'who is the ceo',
             'ceo', 'founder', 'who is the founder', 'who is the owner', 'are you a company',
             'is there a team', 'who are you', 'who is jesus', 'who is in charge', 'the boss'],
      answer: [
        "Behind DecFreedom there's a small team, and I'm the direct contact. We're not a big company and we don't pretend to be.\n\nWhat you can check yourself: the contracts are public, on the blockchain. And the part that really matters — even if we vanished tomorrow, **your money stays in your wallet.** We don't hold it.",
        "A small team with direct contact, no call center. The founder is **Jesús**, and you can message him yourself, with no tickets in between.\n\nThe key thing: we don't custody funds, so you don't depend on us being around."
      ],
      contactCard: true
    },
    {
      topic: 'how do i connect my wallet',
      accion: 'conectar',
      keys: ['how do i connect my wallet', 'connect wallet', 'connect my wallet', 'it wont connect',
             'cant connect', 'wallet not connecting', 'metamask', 'trust wallet', 'safepal', 'walletconnect',
             'how do i connect', 'connecting the wallet', 'connect'],
      answer: [
        "On desktop: press **Connect wallet** and approve it in the extension.\n\nOn mobile: when you press it, a window offers **\"Open in MetaMask\"**, Trust or SafePal. Tap it and DecFreedom opens inside your wallet, where it connects on its own.",
        "If you're on a phone, the most reliable way is to **open DecFreedom from your wallet's own browser**. The connect window has a direct button for it. Are you getting a specific error message?"
      ],
      opciones: [
        { label: 'Is it safe?', q: 'is my money safe' }
      ]
    },

    /* ══════════════ THE SERVICES ══════════════ */
    {
      topic: 'what is the marketplace',
      accion: 'market',
      keys: ['what is the marketplace', 'marketplace', 'market', 'p2p', 'peer to peer', 'buy usdt',
             'sell usdt', 'buy crypto', 'sell crypto', 'cash', 'bank transfer', 'how does the marketplace work',
             'what is p2p', 'buy with cash'],
      answer: [
        "The **Marketplace** is for buying and selling crypto **between people**, paying however you agree (bank transfer, cash, whatever).\n\nThe crypto is locked in the contract until the payment is confirmed, so neither side takes a risk. If there's a problem, a dispute opens and an arbiter decides.",
        "It's a person-to-person market. The seller posts a bond, the crypto is held, and it's only released when they confirm the payment arrived. Direct buying and selling, with protection."
      ],
      opciones: [
        { label: 'Is it safe?',  q: 'is my money safe' },
        { label: 'How do I start?', q: 'how do i start' }
      ]
    },
    {
      topic: 'what is swap',
      accion: 'swap',
      keys: ['what is swap', 'swap', 'exchange', 'change coin', 'change token', 'convert', 'swap fees',
             'how does swap work', 'exchange one coin for another', 'trade tokens'],
      answer: [
        "**Swap** lets you exchange one coin for another instantly, straight from your own wallet.\n\nIt runs over a decentralized exchange, with a small platform fee. You pick what you give and what you want, and it's done in one operation."
      ],
      opciones: [
        { label: 'What is Spot?', q: 'what is spot' },
        { label: 'Is it safe?',   q: 'is my money safe' }
      ]
    },
    {
      topic: 'what is launchpad',
      accion: 'launchpad',
      keys: ['what is launchpad', 'launchpad', 'create a coin', 'create my coin', 'create a token',
             'launch a token', 'launch a coin', 'make my own coin', 'mint a token', 'create a cryptocurrency',
             'how does launchpad work', 'launchpad fee', 'issue a token'],
      answer: [
        "The **Launchpad** lets you create your own coin on BNB Smart Chain in minutes, no coding. You set the name, the logo and how much liquidity you lock.\n\nOne honest note: creating a coin doesn't give it value on its own — that depends on your project. The contract deploys itself and stays in your name."
      ],
      opciones: [
        { label: 'What is the Terminal?', q: 'what is terminal' },
        { label: 'Is it safe?', q: 'is my money safe' }
      ]
    },
    {
      topic: 'what is terminal',
      accion: 'terminal',
      keys: ['what is terminal', 'terminal', 'how does the terminal work', 'security scanner',
             'token scanner', 'check a coin', 'see the chart', 'analyze a token', 'chart', 'scan a token'],
      answer: [
        "The **Terminal** is a trading desk: a live chart, a scanner that checks whether a coin has known traps, and a swap window, all in one place.\n\nA green report doesn't promise profit — it only means no known trap was found. It's your analysis station: search a coin, read its chart, check its safety and swap from the same screen, non-custodial."
      ],
      opciones: [
        { label: 'What is the Shield?', q: 'what is shield' },
        { label: 'What is Spot?', q: 'what is spot' }
      ]
    },
    {
      topic: 'what is spot',
      accion: 'spot',
      keys: ['what is spot', 'spot', 'how does spot work', 'limit order', 'take profit', 'stop loss',
             'tp and sl', 'long', 'short', 'spot trading', 'spot fee', 'buy and sell now'],
      answer: [
        "**Spot** lets you buy and sell with limit orders, take profit (TP) and stop loss (SL). An automated helper executes them, always within the limits you signed.\n\nYour funds don't leave your wallet until you sign. Trading carries risk: you can lose. The fee is **1% on the profit only** — if a position doesn't close in profit, no fee."
      ],
      opciones: [
        { label: 'What are the bots?', q: 'what bots are there' },
        { label: 'Is it safe?', q: 'is my money safe' }
      ]
    },
    {
      topic: 'what is staking',
      accion: 'aportar',
      keys: ['what is staking', 'staking', 'stake', 'how does staking work', 'rewards', 'yield',
             'earn by staking', 'where do staking rewards come from', 'put funds to work', 'apy', 'apr'],
      answer: [
        "**Staking** is putting funds in and receiving a share of what the platform generates, split among everyone who takes part.\n\nThe rewards are variable and never promised: they depend on activity and on how many people stake. It's not a fixed interest, and in a given period it can be zero. The funds sit in a public contract."
      ],
      opciones: [
        { label: 'Is it safe?', q: 'is my money safe' },
        { label: 'What does it cost?', q: 'what does it cost' }
      ]
    },
    {
      topic: 'what is shield',
      accion: 'shield',
      keys: ['what is shield', 'shield', 'wallet shield', 'protect my wallet', 'remove permissions',
             'revoke permissions', 'wallet security', 'address poisoning', 'get my funds out', 'scan my wallet',
             'what is wallet shield'],
      answer: [
        "**Wallet Shield** scans your wallet, lists the permissions you've granted and lets you revoke the dangerous ones. It also detects address poisoning and helps you move your funds out fast.\n\nWhatever has no permission can't be moved. It's your security layer: scan permissions, flag the risky ones, revoke by signing, and if something smells wrong, get your funds to safety."
      ],
      opciones: [
        { label: 'Is it safe?', q: 'is my money safe' },
        { label: 'How do I revoke?', q: 'how do i revoke permission' }
      ]
    },
    {
      topic: 'what is the academy',
      accion: 'academy',
      keys: ['what is the academy', 'academy', 'course', 'courses', 'learn', 'classes', 'i want to learn',
             'teach me', 'study', 'where do i learn', 'learn to trade', 'trading course', 'learn trading',
             'is there training', 'video classes'],
      answer: [
        "Yes — **DecFreedom Academy** is the learning side: four core video classes you watch in order, from what crypto is to reading the market and the strategy behind the tools.\n\nThe idea is that you don't depend on the bots forever. It's fine that they work for you, but **understanding what they do is what gives you peace of mind.** It's education, never financial advice."
      ],
      opciones: [
        { label: 'What are the bots?', q: 'what bots are there' },
        { label: 'How do I start?', q: 'how do i start' }
      ]
    },
    {
      topic: 'install the app',
      accion: 'instalar',
      keys: ['install the app', 'install', 'app', 'application', 'download', 'have it on my phone',
             'install on phone', 'how do i install it', 'get the app', 'pwa'],
      answer: [
        "DecFreedom installs as an app. On desktop there's an **Install** button in the top menu; on mobile, from your browser's menu. It opens with its own icon, full screen, and works even on a slow connection.",
        "Yes, it installs — look for **Install** in the menu. One heads-up: if you install it on mobile, the wallet can't connect inside the app. To trade from a phone it's better to open it through the MetaMask or Trust browser."
      ],
      opciones: [
        { label: 'How do I connect my wallet?', q: 'how do i connect my wallet' }
      ]
    }
  ] };
})();
