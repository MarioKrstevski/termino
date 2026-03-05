-- ============================================================
-- Migration 04: sms_logs.appointment_id for cron dedupe + review requests
-- Run after 03_views_and_rpc.sql
-- ============================================================

ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sms_logs_appointment_message
  ON sms_logs(appointment_id, message_type)
  WHERE appointment_id IS NOT NULL;
