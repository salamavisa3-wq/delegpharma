# DNS — delegpharma.com (OVHcloud)

Migration DNS pour la spec §7 : la **vitrine** est servie par **systeme.io** via CloudFront,
le **backend** sur `app.delegpharma.com` (VPS OVHcloud). Le domaine est géré chez **OVHcloud**
(zone DNS). **Conserver MX intacts** — le mail (`mx1-3.mail.ovh.net`) ne change pas.

## Architecture DNS finale

| Type | Nom | Cible | Note |
|---|---|---|---|
| A | `delegpharma.com` (apex) | IP mutualisée OVHcloud | WordPress backup jusqu'à bascule finale |
| CNAME | `www` | `dejc22hvp6w80.cloudfront.net.` | vitrine systeme.io |
| CNAME | `_12505783a60f38d6d95de9e9ec48c863` | `_f9e220a0fda19605cd8dcacae8832d82.jkddzztszm.acm-validations.aws.` | validation SSL ACM |
| CNAME | `app` | VPS OVHcloud | backend Node — A vers IP du VPS de préférence |
| MX | `@` | `mx0.mail.ovh.net` / `mx1.mail.ovh.net` / `mx2.mail.ovh.net` / `mx3.mail.ovh.net` | **préserver, ne pas toucher** |

> Les deux CNAME systeme.io (`dejc22hvp6w80...` et `_12505783...`) proviennent de la
> configuration systeme.io du cahier des charges (§7.1). À vérifier dans le dashboard systeme.io
> au moment de la bascule — ils peuvent différer selon le projet.

## Ordre de bascule (conservateur, §7.2)

1. **Avant SSL** : garder l'A apex OVHcloud (WordPress actuel joignable en backup). Ajouter les
   CNAME systeme.io (www + validation ACM) sans retirer les records existants.
2. **Après émission du SSL systeme.io** : basculer le trafic vitrine sur systeme.io.
3. **Backend** : `app.delegpharma.com` → IP du VPS (record **A**, plus fiable qu'un CNAME vers un
   hôte sans suffixe). SSL via certbot sur le VPS.
4. **Vérifier** MX + envoi/réception mail, puis décider de la bascule finale apex → CloudFront.

## Records exacts (à saisir dans la zone OVHcloud)

```
# Vitrine systeme.io (CloudFront)
www.delegpharma.com.  CNAME  dejc22hvp6w80.cloudfront.net.
_12505783a60f38d6d95de9e9ec48c863.delegpharma.com.  CNAME  _f9e220a0fda19605cd8dcacae8832d82.jkddzztszm.acm-validations.aws.

# Backend SaaS
app.delegpharma.com.  A  <IP_VPS>

# Mail — intacts
@  MX  mx0.mail.ovh.net
@  MX  mx1.mail.ovh.net
@  MX  mx2.mail.ovh.net
@  MX  mx3.mail.ovh.net
```

## Vérifications

```bash
# Propagation / records
dig www.delegpharma.com CNAME +short
dig _12505783a60f38d6d95de9e9ec48c863.delegpharma.com CNAME +short
dig app.delegpharma.com A +short
dig delegpharma.com MX +short

# HTTPS
curl -I https://www.delegpharma.com        # → HTTP/2, TLS OK (systeme.io/CloudFront)
curl -I https://app.delegpharma.com/api/health   # → {"ok":true}
```

Propagation DNS : 24–48 h (TTL court avant la bascule recommandé : 300 s).
