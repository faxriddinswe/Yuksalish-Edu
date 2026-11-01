#!/usr/bin/env sh
set -eu
umask 077
# Production Compose fayli va muhit fayli aynan shu yerda ko‘rsatilgan.
backup_dir=${BACKUP_DIR:-./.local/backups}
mkdir -p "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl' > "$backup_dir/postgres-$stamp.dump"
docker compose --env-file .env.production -f compose.production.yaml exec -T backend tar czf - -C /app media > "$backup_dir/media-$stamp.tar.gz"
# Retention avtomatik o‘chirilmaydi: docs/backup-and-restore.md ga ko‘ra offsite nusxa tekshirilgach yuriting.
printf 'Zaxira yaratildi: %s\n' "$stamp"
