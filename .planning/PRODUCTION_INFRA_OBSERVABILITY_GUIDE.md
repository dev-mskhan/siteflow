# Production Infrastructure & Observability Guide

> **Scope:** Replace Docker containers with cloud free-tier equivalents for production.
> No code changes needed — only environment variables differ.

---

## Architecture Summary

| Concern | Local Dev (Docker) | Production (Cloud Free Tier) |
|---|---|---|
| Voice / STT | Speaches (faster-whisper, CPU) on `:3900` | **Groq Cloud** — 8h audio/day free |
| AI Tracing | Langfuse self-hosted on `:3020` | **Langfuse Cloud** — 50k obs/month free |
| APM / Traces | SigNoz self-hosted on `:3301` | **Grafana Cloud** — 50 GB traces/month free |

---

## 1. Voice / STT — Groq Cloud Whisper

Groq exposes an OpenAI-compatible audio transcription API. The same
`VoiceStudioProvider` / `voicestudio.provider.ts` code works unchanged.

### Free tier
- **8 hours of audio per day**
- **200× real-time** processing speed
- No credit card required to start

### Setup

1. Sign up at <https://console.groq.com> → **API Keys** → create key.
2. Set in your production `.env` / secrets manager:

```env
VOICESTUDIO_URL=https://api.groq.com/openai
VOICESTUDIO_API_KEY=gsk_<your-groq-api-key>
VOICE_MODEL=whisper-large-v3-turbo
```

> **Why `whisper-large-v3-turbo`?**  
> Groq doesn't serve `whisper-1` (that's an OpenAI alias). Use:
> - `whisper-large-v3-turbo` — fastest, best cost/quality ratio  
> - `whisper-large-v3` — highest accuracy, multilingual  
> - `distil-whisper-large-v3-en` — English-only, ultra-fast

### Endpoint mapping

The server calls `{VOICESTUDIO_URL}/v1/audio/transcriptions` with a bearer token.
`https://api.groq.com/openai` + `/v1/audio/transcriptions` = `https://api.groq.com/openai/v1/audio/transcriptions` ✓

---

## 2. AI Tracing — Langfuse Cloud

Langfuse Cloud is the zero-ops path. The `langfuse-client.ts` already defaults
to `https://cloud.langfuse.com` when `LANGFUSE_HOST` is absent.

### Free tier
- **50,000 observations/month** — forever, no credit card
- Full UI, data export, prompt management included

### Setup

1. Sign up at <https://cloud.langfuse.com>
2. Create an organisation → project → copy keys.
3. Set in production env (**do NOT set `LANGFUSE_HOST`**):

```env
LANGFUSE_PUBLIC_KEY=pk-lf-<your-cloud-public-key>
LANGFUSE_SECRET_KEY=sk-lf-<your-cloud-secret-key>
# LANGFUSE_HOST is intentionally omitted → defaults to cloud.langfuse.com
```

> **Why no `LANGFUSE_HOST` in production?**  
> The default in `langfuse-client.ts` line 18 is `'https://cloud.langfuse.com'`.  
> Setting `LANGFUSE_HOST=http://localhost:3020` locally overrides it. In production,
> omit it entirely so the SDK uses the cloud endpoint.

### Self-host on a company VPS (alternative)

If you need a self-hosted instance for data-residency reasons, deploy
`langfuse/langfuse:3` + `langfuse/langfuse-worker:3` on any VPS with Postgres.
Then set:

```env
LANGFUSE_HOST=https://your-langfuse.company.com
LANGFUSE_PUBLIC_KEY=pk-lf-siteflow-prod
LANGFUSE_SECRET_KEY=sk-lf-<generated-secret>
```

---

## 3. APM & Distributed Tracing — Grafana Cloud (OTLP)

The server already emits OpenTelemetry traces via `OTEL_EXPORTER_OTLP_ENDPOINT`.
In production, point it at Grafana Cloud's free OTLP ingest.

### Free tier
- **50 GB logs + traces per month** (Grafana Cloud free plan)
- Native OTLP endpoint — no SDK changes

### Setup

1. Sign up at <https://grafana.com/auth/sign-up>  
2. Go to **My Account → Grafana Cloud → Details → Send data** → copy OTLP credentials.
3. Set:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-central-0.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64(instanceId:token)>
OTEL_SERVICE_NAME=siteflow-server
```

> `base64(instanceId:token)` — Grafana shows this pre-encoded in their quick-start.

### Alternative: New Relic (100 GB/month free)

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net:4318
OTEL_EXPORTER_OTLP_HEADERS=api-key=<your-new-relic-ingest-key>
```

---

## 4. Production `.env` Template

Copy this to your secrets manager / CI environment:

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgres://<user>:<pass>@<host>:5432/<db>

# Redis
REDIS_URL=redis://<host>:6379

# Auth
JWT_SECRET=<at-least-32-random-chars>
COOKIE_SECRET=<at-least-32-random-chars>

# AI / LLM
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
AI_MODEL_CHEAP=gpt-4o-mini
AI_MODEL_STRONG=gpt-4o
AI_DAILY_BUDGET_USD=10.0

# Voice / STT (Groq Cloud)
VOICESTUDIO_URL=https://api.groq.com/openai
VOICESTUDIO_API_KEY=gsk_...
VOICE_MODEL=whisper-large-v3-turbo

# Langfuse Cloud (omit LANGFUSE_HOST → defaults to cloud.langfuse.com)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...

# Grafana Cloud OTLP
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-central-0.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64(instanceId:token)>
OTEL_SERVICE_NAME=siteflow-server
```

---

## 5. What You Do NOT Deploy

These Docker services exist **only** in local dev and are replaced by the above:

| Local container | Production replacement |
|---|---|
| `siteflow-whisper` (Speaches) | Groq Cloud API |
| `siteflow-langfuse` + `langfuse-worker` | Langfuse Cloud |
| `siteflow-otel-collector` + `siteflow-signoz` | Grafana Cloud / New Relic OTLP |
| `siteflow-signoz-clickhouse` + `siteflow-signoz-zookeeper` | (same — removed) |

Postgres, Redis, and MinIO still need to be provisioned (e.g., Neon, Upstash, Cloudflare R2).
