-- Extend movement catalog enums for Functional Fitness Exercise Database v2.9 values.

ALTER TYPE "public"."Movement Pattern" ADD VALUE IF NOT EXISTS 'Locomotion';
ALTER TYPE "public"."Movement Pattern" ADD VALUE IF NOT EXISTS 'Horizontal Adduction';
ALTER TYPE "public"."Movement Pattern" ADD VALUE IF NOT EXISTS 'Lateral Locomotion';

ALTER TYPE "public"."Posture" ADD VALUE IF NOT EXISTS 'Isometric Split Squat';
ALTER TYPE "public"."Posture" ADD VALUE IF NOT EXISTS 'Running';

ALTER TYPE "public"."Equipment" ADD VALUE IF NOT EXISTS 'Climbing Rope';

ALTER TYPE "public"."Muscles" ADD VALUE IF NOT EXISTS 'Transverse Abdominis';
