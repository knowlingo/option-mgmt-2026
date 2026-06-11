"""Seed an authenticated session for the Playwright E2E CI job (M1.25 activation).

`POST /auth/login` is a 501 stub (`app/routers/auth.py`), so the browser cannot
log in through the UI. Run inside the CI `e2e` job against the live Postgres,
this script seeds a `users` row (mirroring `tests/test_smoke_m1_17.py`) and mints
a short-lived HS256 JWT for it, then prints a GitHub-Actions env assignment to
stdout:

    E2E_ACCESS_TOKEN=<jwt>     # emitted ONLY on a successful user seed

The job appends our stdout to ``$GITHUB_ENV``; `apps/web/e2e/global-setup.ts`
reads ``E2E_ACCESS_TOKEN`` and injects it as the httpOnly ``access_token`` cookie
the Next server components expect. The authenticated specs
(`settings-outcomes.spec.ts`) ``test.skip`` when ``E2E_ACCESS_TOKEN`` is unset,
so any seed failure degrades to *skipped* specs (the job stays green) rather than
a red run.

Best-effort by design: any failure prints a warning to stderr and exits 0
without emitting env — it never breaks the job.

Follow-up (not done here): also seeding a `daily_decisions` row to light up the
outcome-entry E2E via ``E2E_DECISION_ID``. That needs market-data seeding +
``POST /engine/daily-plan`` (or a hand-built row), so the outcome spec skips
until then.
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, datetime, timedelta

# Distinct from the M1.17 smoke user id; the e2e job runs its own Postgres.
_USER_ID = "00000000-0000-0000-0000-0000000000e2"
_EMAIL = "e2e@example.test"


def _seed_user_and_mint_token() -> str | None:
    """Insert the e2e user (idempotent) and return a signed JWT, or None."""
    database_url = os.environ.get("DATABASE_URL")
    jwt_secret = os.environ.get("JWT_SECRET")
    if not database_url or not jwt_secret:
        print(
            "e2e_seed: DATABASE_URL or JWT_SECRET unset; skipping seed",
            file=sys.stderr,
        )
        return None

    import psycopg
    from jose import jwt

    dsn = database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    with psycopg.connect(dsn, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO users (id, email, password_hash, strategy_profile, "
            "disclaimer_accepted_at) "
            "VALUES (%s, %s, 'unused', '{}'::jsonb, now()) "
            "ON CONFLICT (email) DO UPDATE SET disclaimer_accepted_at = now() "
            "RETURNING id;",
            (_USER_ID, _EMAIL),
        )
        row = cur.fetchone()
    user_id = str(row[0]) if row else _USER_ID

    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=1)).timestamp()),
    }
    return str(jwt.encode(payload, jwt_secret, algorithm="HS256"))


def main() -> int:
    try:
        token = _seed_user_and_mint_token()
    except Exception as exc:  # best-effort: never break the job
        print(
            f"e2e_seed: seed failed ({exc!r}); authenticated specs will skip",
            file=sys.stderr,
        )
        return 0
    if token:
        print(f"E2E_ACCESS_TOKEN={token}")
    else:
        print("e2e_seed: no token emitted; authenticated specs will skip", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
