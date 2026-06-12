-- Hourly cron to invoke scan-inbox edge function.
-- Run in Supabase SQL Editor AFTER deploying the scan-inbox function.
-- Requires pg_cron + pg_net extensions (enabled by default on Supabase).
--
-- PREREQUISITE: store the service role key in Vault first:
--   SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'scan_inbox_service_role_key',
--     'Service role key used by scan-inbox hourly cron');

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule: every hour at :05 (avoids the exact hour mark)
-- Reads service role key from Vault at runtime — never stored in plaintext
SELECT cron.schedule(
  'scan-inbox-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rmdztasccsnrqqgqvgyy.supabase.co/functions/v1/scan-inbox',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'scan_inbox_service_role_key'
      )
    ),
    body := '{"triggered_by": "cron"}'::jsonb
  );
  $$
);
