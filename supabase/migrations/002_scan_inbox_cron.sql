-- Hourly cron to invoke scan-inbox edge function.
-- Run in Supabase SQL Editor AFTER deploying the scan-inbox function.
-- Requires pg_cron + pg_net extensions (enabled by default on Supabase).

-- Enable extensions if not already active
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule: every hour at :05 (avoids the exact hour mark)
SELECT cron.schedule(
  'scan-inbox-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/scan-inbox',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"triggered_by": "cron"}'::jsonb
  );
  $$
);
