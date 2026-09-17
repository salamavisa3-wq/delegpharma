# Records à reproduire dans la zone Cloudflare delegpharma.com (générés 2026-09-17T10:48Z, source zone OVH autoritative)

| Type | Nom | Contenu | Priorité | Note |
|---|---|---|---|---|
| MX | @ | mx1.mail.ovh.net | 1 | MAIL — ne jamais casser |
| MX | @ | mx2.mail.ovh.net | 5 | MAIL |
| MX | @ | mx3.mail.ovh.net | 100 | MAIL |
| TXT | @ | v=spf1 include:mx.ovh.com -all | | SPF |
| TXT | @ | google-site-verification=1mblS75EDqOJvtI5mmg4BsepwuXoOPmu_TzpQ9G-H1c | | GSC |
| TXT | @ | 1|www.delegpharma.com | | jeton hosting OVH (peut être omis si la vitrine est arrêtée) |
| A | @ | — | | SUPPRIMÉ 17/09 : apex servi par le custom domain worker delegpharma-redirect (301 → app) |
| A | www | — | | SUPPRIMÉ 17/09 : www servi par le custom domain worker delegpharma-redirect (301 → app) |
| CNAME | app | (auto-géré par le custom domain Worker) | | ne PAS créer manuellement |

Le A app -> 164.132.109.175 (VPS mort) n'est PAS reproduit : remplacé par le custom domain Worker.
