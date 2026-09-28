# Mensaje para enviar a Blockaid

> Copiar todo lo que está debajo de la línea y pegarlo como respuesta al ticket.
> Adjuntar las CUATRO capturas de pantalla, en orden (uno, dos, tres, cuatro).

---

**Subject: Evidence package — criptocubaoficial.com (Ticket 91XN4Z-64DX3 / #1440814)**

Hello,

Thank you for the detailed list of requirements. Below is the complete evidence package.

**1. Responsible entity and contact**

Operator: Jesús, alias @JesusDevTrader. Lead developer and domain registrant.
Contact email: yamicelanvivesqui@gmail.com
GitHub: https://github.com/CyberSecureAID

We are a two-person team and we are not anonymous. My public profiles:

- Telegram: https://t.me/JesusDevTrader
- X: https://x.com/JesusDevTrader
- Instagram: https://www.instagram.com/JesusDevTrader
- LinkedIn: https://www.linkedin.com/in/jesusdevtrader
- YouTube: https://www.youtube.com/@JesusDevTrader

The project does not yet have its own social channels because it has not launched. It is in active development and has no external users.

**2. Domain ownership**

The domain is registered with Hostinger and I control its DNS. Please send the verification token and I will publish a TXT record within minutes.

**3. Source and build information**

Full source is public: https://github.com/CyberSecureAID/bot-algoritmico

There is no build step and no bundler. The site is served as plain ES modules directly from the repository, so the deployed code is byte-identical to the public source. Any served file can be compared against the repository to confirm this.

**4. Complete inventory of wallet interactions**

This is the full set of RPC methods the site ever requests. There are no others:

- `eth_requestAccounts` — only on explicit user click of "Connect wallet"
- `eth_accounts` — silent read of already-authorised accounts
- `eth_chainId` — read the current network
- `wallet_switchEthereumChain` — switch to BNB Smart Chain (56)
- `wallet_addEthereumChain` — add BNB Smart Chain if absent
- `wallet_revokePermissions` — on user-initiated disconnect

**The site never calls `eth_sign`, `personal_sign` or `eth_signTypedData`.** These are the methods associated with blind-signing attacks and they do not exist anywhere in the codebase. This is verifiable by searching the public repository.

The site never requests seed phrases, recovery phrases or private keys. No such input field exists in the application.

No third-party advertising, tracking or analytics scripts are loaded.

**5. Reproducible test flow — documented step by step**

I have attached four screenshots documenting the complete connection flow from first load to connected state. Each step is labelled below.

**Screenshot 1 — page loads, no transaction requested.** The site renders fully. MetaMask shows only its standard connection panel. **No signature, transaction or approval request appears at any point during load.** The warning banner is also visible here.

**Screenshot 2 — the warning your system produces.** MetaMask states the site "shows phishing signs or wallet-draining activity" and "may request transactions designed to steal your funds". As the remaining screenshots demonstrate, no transaction is requested at all.

**Screenshot 3 — standard account connection.** After proceeding, the wallet displays its normal account-connection dialogue (`eth_requestAccounts`). Nothing else is requested.

**Screenshot 4 — connected state, funds untouched.** The wallet is connected on BNB Chain with its balance intact (USD 8.82). No transaction was proposed, no approval requested, no permission granted beyond account visibility. The site reads balances and nothing more.

This is precisely the behaviour your team asked to see demonstrated: the site connects wallets and reads balances without requesting transactions. The four screenshots show the entire flow end to end, with no step omitted.

**6. Smart contracts**

Ten contracts deployed on BNB Smart Chain, all with source published and verified on BscScan. None contains any function capable of withdrawing funds from a user wallet, which is independently verifiable by reading each verified source:

```
0x7FdE85E0bD53208F380980cfE317A9D4982434Ab
0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3
0x068729CBB708713266FFdE2374e51db2B063FD7C
0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4
0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B
0x39c48394068299Aa3e3ab114F16bfc3DE11F4112
0x17B47a8Fb97F8980b96c94E4b9137182e0Bf8025
0xC01B61B702011747B4c0Ee6B5F2d0F2b4B66880c
0x24E34b95dBd7786b0d11E00e7FA256A8763B6D05
0x71763E9Ad60d3D2Baa833496F8b4f8eeD497B65F
```

**7. Security incident history**

There has been no compromise. The site has never been hacked, defaced or serving injected code. No remediation was required because no incident occurred.

**8. Context on the flagged address**

`0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d` is my development wallet. It deployed the contracts above and received a small number of test payments from my own wallets during development. On a new domain that inbound pattern may resemble a risk signal to an automated system, but every transaction is traceable and originates from development testing, not from users.

**9. Practical impact**

The current warning blocks access from the MetaMask browser entirely, with no option to proceed or dismiss. This prevents me from testing my own application during development, which is its only current use. There are no external users to protect from it.

**Summary**

This is a decentralised application in active development, with fully public source code, verified contracts, no signature-request methods, no credential collection, and no transaction requests on load. I am available for a live technical walkthrough or any further artefact you require.

Best regards,
Jesús (@JesusDevTrader)
Operator, criptocubaoficial.com
