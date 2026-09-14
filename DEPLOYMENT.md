# Deployment Guide - AdVibe Eventos

## Railway Deployment (Recommended)

### Prerequisites
- Railway account (railway.app)
- GitHub repository connected
- 2 services needed: backend + capture

### Setup

#### 1. Create Backend Service

1. In Railway dashboard, create new service from GitHub
2. Select `advibe-eventos` repository
3. **Set Dockerfile path**: `apps/backend/Dockerfile`
4. Configure environment variables:
   ```
   DATABASE_PATH=/app/data/advibe.db
   DATA_DIR=/app/data/media
   PUBLIC_BASE_URL=https://your-backend-domain.up.railway.app
   ADMIN_TOKEN=<generate-strong-random-token>
   ALLOWED_ORIGINS=https://your-capture-domain.up.railway.app
   NODE_ENV=production
   PORT=3300
   ```

5. Add persistent volume:
   - Mount path: `/app/data`
   - This preserves SQLite database and photos across deployments

6. Configure health check:
   - Path: `/api/health`
   - Interval: 10s
   - Timeout: 5s

7. Deploy

#### 2. Create Capture Service

1. Create new service from same repository
2. **Set Dockerfile path**: `apps/capture/Dockerfile`
3. Configure environment variable:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain.up.railway.app
   NODE_ENV=production
   PORT=3301
   ```

4. Deploy

#### 3. Link Services

In Railway networking, ensure both services can communicate via their domains.

### Monitoring

**Backend health:**
```bash
curl https://your-backend-domain.up.railway.app/api/health
```

**Check logs:**
- Railway dashboard → Service → Logs tab

### Troubleshooting

#### Build fails with ".next not found"
Railway caches build layers. Force rebuild:
1. Go to Service → Settings
2. Click "Redeploy from latest commit"
3. Or make a dummy commit: `git commit --allow-empty -m "force rebuild"`

#### Photos not persisting
- Verify volume mounted at `/app/data`
- Check `DATABASE_PATH` and `DATA_DIR` env vars
- Restart service after volume attach

#### CORS errors from capture PWA
- Ensure `ALLOWED_ORIGINS` in backend matches capture domain exactly
- Verify `NEXT_PUBLIC_BACKEND_URL` in capture matches backend domain exactly

## Local Development

```bash
cd ~/advibe-eventos
./start-dev.sh
```

Then open `http://IP:3301` on Samsung and follow TESTING.md

## Environment Variables Reference

### Backend (.env)
| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| DATABASE_PATH | Yes | ./data/advibe.db | SQLite location |
| DATA_DIR | Yes | ./data/media | Photo storage |
| PUBLIC_BASE_URL | Yes | - | Your backend public URL |
| ADMIN_TOKEN | Yes | - | Token for creating events |
| ALLOWED_ORIGINS | Yes | - | Capture PWA origin |
| NODE_ENV | No | development | Set to production on Railway |

### Capture (.env.local)
| Variable | Required | Notes |
|----------|----------|-------|
| NEXT_PUBLIC_BACKEND_URL | Yes | Backend public URL |
| NODE_ENV | No | Set to production on Railway |

## Rollback

If deployment fails:
1. Railway → Service → Deployments
2. Click previous successful deployment
3. Click "Redeploy"

## Support

- Check Railway docs: https://docs.railway.app
- Check Next.js deployment: https://nextjs.org/docs/deployment
