# MyTick Financing Plan 💰

## Current (Free Tier) — $0/month
| Service          | Provider         | Plan       | Cost   | Limits                          |
|------------------|------------------|------------|--------|---------------------------------|
| Backend API      | Render           | Free       | $0     | 750 hrs/mo, sleeps after 15min, 100GB bandwidth, 500 build mins |
| MCP Server       | Local only       | -          | $0     | Runs on your machine            |
| Notification Worker | Local only    | -          | $0     | Runs on your machine            |
| Frontend Web     | Firebase Hosting | Spark      | $0     | 10GB bandwidth/mo, 1GB storage  |
| Database         | MongoDB Atlas    | M0 Free    | $0     | 512MB, shared, no backups       |
| Mobile App       | Expo Go          | Free       | $0     | Dev only, no app store          |
| Domain           | None             | -          | $0     | Using .onrender.com / .web.app  |
| CI/CD            | GitHub Actions   | Free       | $0     | 2000 min/mo                     |
| Keep-alive       | UptimeRobot      | Free       | $0     | Ping every 5min, prevents sleep |
| **Total**        |                  |            | **$0** |                                 |

### Render Free Tier Details (as of Apr 2026)
- **750 instance hours/month** — enough for 1 service running 24/7 (month = ~730 hrs)
- **100GB outbound bandwidth/month** — API responses, massive for a small app
- **500 pipeline minutes/month** — build time per deploy (~1-2 min each = 250-500 deploys)
- **Sleeps after 15min idle** — ~1min cold start, use keep-alive ping to prevent
- **No persistent disk** — use external DB (Atlas)
- **No scaling** — single instance only
- **No SSH/shell access**
- **May suspend** if high outbound traffic to external services (Atlas calls)
- **Ephemeral filesystem** — local files lost on restart
- **No SMTP** — can't send emails from Render directly

## Phase 1: Small User Base (1-100 users) — ~$15/month
| Service          | Provider         | Plan       | Cost   | Why                             |
|------------------|------------------|------------|--------|---------------------------------|
| Backend API      | Render           | Starter    | $7     | Always on, no cold starts       |
| Database         | MongoDB Atlas    | M0 Free    | $0     | Keep free tier until you need more |
| Frontend Web     | Firebase Hosting | Spark      | $0     | Still free                      |
| Domain           | Cloudflare       | .com       | ~$1    | ~$10/yr at cost, no markup. Also gives free CDN/DNS |
| **Total**        |                  |            | **~$8** |                               |

## Phase 2: Growing (100-1000 users) — ~$40/month
| Service          | Provider         | Plan       | Cost   | Why                             |
|------------------|------------------|------------|--------|---------------------------------|
| Backend API      | Render           | Standard   | $25    | More CPU/RAM, auto-scale        |
| Database         | MongoDB Atlas    | M5         | $25    | 5GB, better performance         |
| Push Notifications | Firebase FCM   | Free       | $0     | Unlimited                       |
| Email (verify)   | SendGrid         | Free       | $0     | 100 emails/day                  |
| Domain + SSL     | Cloudflare       | -          | $0     | Already paying for domain, free SSL/CDN |
| **Total**        |                  |            | **~$51** |                               |

## Phase 3: Serious (1000+ users) — ~$100+/month
| Service          | Provider         | Plan       | Cost    | Why                            |
|------------------|------------------|------------|---------|--------------------------------|
| Backend          | AWS ECS / K8s    | -          | ~$50+   | Auto-scaling, multi-region     |
| Database         | Atlas M10+       | Dedicated  | ~$60+   | SSD, auto-scaling, PITR        |
| CDN              | Cloudflare       | Pro        | $20     | WAF, DDoS protection           |
| Monitoring       | Datadog / Sentry | Free tier  | $0-26   | Error tracking, APM            |
| **Total**        |                  |            | **$130+** |                              |

## Budget Alternative: Single VPS — $5-12/month
Run everything on one server:
| Provider    | Plan          | Cost  | Specs              |
|-------------|---------------|-------|--------------------|
| Hetzner     | CX22          | €4    | 2 vCPU, 4GB RAM    |
| DigitalOcean| Basic         | $6    | 1 vCPU, 1GB RAM    |
| Vultr       | Cloud Compute | $6    | 1 vCPU, 1GB RAM    |

Run: nginx (reverse proxy) + Node (backend) + MongoDB + static files (frontend)
Pros: Cheapest, full control
Cons: You manage everything (updates, backups, security)

## Revenue Ideas (to offset costs)
- Freemium: free for 50 tasks, paid for unlimited
- Pro plan: $3/mo for calendar sync, priority notifications, file attachments
- Team plan: $5/user/mo for group features, admin dashboard
- API access: $10/mo for third-party integrations

## Notes
- Always start free, upgrade only when needed
- MongoDB Atlas free tier is surprisingly capable for small apps
- Firebase Hosting free tier is very generous — likely never need to pay
- FCM push notifications are free forever — no reason to pay for push
- Custom domain (~$12/year) is the first thing worth paying for (enables HttpOnly cookies + professionalism)
