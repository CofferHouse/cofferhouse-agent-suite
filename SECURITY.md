# Security Policy

## Current stage

CofferHouse Scout is an experimental read-only prototype. There are no supported deposits, custody, autonomous transactions, or production lending contracts at this time.

## Reporting a vulnerability

Please do not disclose a suspected vulnerability publicly before the team has had a reasonable opportunity to investigate it.

Until a dedicated security inbox is created, contact:

`thecofferhouse@gmail.com`

Include:

- affected component or contract;
- reproduction steps;
- expected and observed behavior;
- potential impact;
- relevant transaction hashes or screenshots;
- a safe way to contact you.

## Security principles

- no private keys in source control;
- least-privilege permissions;
- explicit allowlists and limits;
- deterministic risk policies;
- fail safely when data is missing;
- simulation before execution;
- user authorization before transactions;
- independent review before custody or lending.

No bug bounty is currently offered. A formal disclosure and reward policy may be introduced before production financial contracts are deployed.
# Application hardening

- Untrusted provider, model, and operator text is HTML-escaped before DOM rendering.
- External links are restricted to HTTPS.
- Production responses include CSP, clickjacking, MIME-sniffing, referrer, and browser-permission headers.
- Mutating operator endpoints require protected bearer credentials and enforce body limits.
- Cron invocations require `CRON_SECRET`; storage, webhook, model, and operator credentials stay server-side.
- Receipt verification is tamper evidence, not an identity signature or guarantee that source data was correct.
- Arc RPC diagnostics exposed by the public status endpoint are sanitized and never include the configured provider URL.
