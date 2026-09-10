/* ================================================================
   JESUS - Cripto Cuba Oficial assistant - ENGLISH knowledge base
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
    role: 'Cripto Cuba Oficial assistant',
    greeting: [
      "Hi, I'm **Jesús**. I'm here to help.\n\nWhat do you need?",
      "Hello! My name is **Jesús**, from Cripto Cuba Oficial.\n\nTell me how I can help.",
      "Hey there. I'm **Jesús**.\n\nWhat can I help you with today?",
      "Hi! I'm **Jesús**, from the Cripto Cuba Oficial team.\n\nWhat would you like to know?"
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
    }
  ] };
})();
