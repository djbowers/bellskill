-- Seed data for completed workouts
-- This script creates a test user if one doesn't exist, then creates sample workout data

DO $$
DECLARE
  test_user_id UUID;
  test_user_email TEXT := 'test@example.com';
  test_user_password TEXT := 'testpassword123';
  workout1_id BIGINT;
  workout2_id BIGINT;
  workout3_id BIGINT;
BEGIN
  -- Check if a user already exists, otherwise create a test user
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    -- Generate a UUID for the test user
    test_user_id := gen_random_uuid();
    
    -- Create the test user in auth.users
    -- Using minimal required fields for Supabase auth
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      phone,
      is_sso_user,
      is_anonymous,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      test_user_id,
      '00000000-0000-0000-0000-000000000000',
      test_user_email,
      crypt(test_user_password, gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      jsonb_build_object('email', test_user_email, 'full_name', 'Test User'),
      false,
      'authenticated',
      'authenticated',
      NULL,
      false,
      false,
      '',
      '',
      '',
      ''
    );
    
    -- Create the corresponding identity entry (required for Supabase Auth)
    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      created_at,
      updated_at
    ) VALUES (
      test_user_email,
      test_user_id,
      jsonb_build_object('sub', test_user_id::text, 'email', test_user_email),
      'email',
      NOW(),
      NOW()
    );
    
    -- Create the corresponding profile entry
    -- The handle_new_user trigger should create this, but we'll do it explicitly to be safe
    INSERT INTO public.profiles (id, full_name, username)
    VALUES (test_user_id, 'Test User', 'testuser')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
    
    RAISE NOTICE 'Created test user with email: % and password: %', test_user_email, test_user_password;
  ELSE
    RAISE NOTICE 'Using existing user with ID: %', test_user_id;
  END IF;

  -- Workout 1: Time-based kettlebell workout (30 minutes)
  INSERT INTO public.workout_logs (
    user_id,
    started_at,
    completed_at,
    movements,
    rep_scheme,
    completed_reps,
    completed_rounds,
    completed_rungs,
    workout_goal,
    workout_goal_units,
    bells,
    unit,
    rpe,
    interval_timer,
    rest_timer,
    workout_details,
    workout_notes,
    completed_volume,
    is_one_handed
  ) VALUES (
    test_user_id,
    NOW() - INTERVAL '2 days' - INTERVAL '1 hour',
    NOW() - INTERVAL '2 days',
    ARRAY['Kettlebell Swing', 'Goblet Squat', 'Turkish Get-up'],
    ARRAY[20, 10, 5],
    35,
    8,
    0,
    30,
    'minutes',
    ARRAY[24, 24, 16]::smallint[],
    'kg',
    'ideal',
    0,
    60,
    'Full body kettlebell circuit',
    'Felt strong today. Focused on form.',
    280,
    false
  );

  -- Workout 2: Round-based workout (10 rounds)
  INSERT INTO public.workout_logs (
    user_id,
    started_at,
    completed_at,
    movements,
    rep_scheme,
    completed_reps,
    completed_rounds,
    completed_rungs,
    workout_goal,
    workout_goal_units,
    bells,
    unit,
    rpe,
    interval_timer,
    rest_timer,
    workout_details,
    workout_notes,
    completed_volume,
    is_one_handed
  ) VALUES (
    test_user_id,
    NOW() - INTERVAL '1 day' - INTERVAL '45 minutes',
    NOW() - INTERVAL '1 day',
    ARRAY['Push-up', 'Pull-up', 'Burpee'],
    ARRAY[15, 10, 10],
    35,
    10,
    0,
    10,
    'rounds',
    ARRAY[]::smallint[],
    'kg',
    'hard',
    0,
    90,
    'Bodyweight EMOM style',
    'Challenging but completed all rounds',
    350,
    false
  );

  -- Workout 3: Weight-based workout (100kg total)
  INSERT INTO public.workout_logs (
    user_id,
    started_at,
    completed_at,
    movements,
    rep_scheme,
    completed_reps,
    completed_rounds,
    completed_rungs,
    workout_goal,
    workout_goal_units,
    bells,
    unit,
    rpe,
    interval_timer,
    rest_timer,
    workout_details,
    workout_notes,
    completed_volume,
    is_one_handed
  ) VALUES (
    test_user_id,
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '4 hours',
    ARRAY['Deadlift', 'Bench Press', 'Squat'],
    ARRAY[5, 5, 5],
    15,
    3,
    0,
    100,
    'kilograms',
    ARRAY[]::smallint[],
    'kg',
    'maxEffort',
    0,
    180,
    'Powerlifting session',
    'PR on deadlift!',
    1500,
    false
  );

  -- Workout 4: Easy recovery workout
  INSERT INTO public.workout_logs (
    user_id,
    started_at,
    completed_at,
    movements,
    rep_scheme,
    completed_reps,
    completed_rounds,
    completed_rungs,
    workout_goal,
    workout_goal_units,
    bells,
    unit,
    rpe,
    interval_timer,
    rest_timer,
    workout_details,
    workout_notes,
    completed_volume,
    is_one_handed
  ) VALUES (
    test_user_id,
    NOW() - INTERVAL '3 days' - INTERVAL '30 minutes',
    NOW() - INTERVAL '3 days',
    ARRAY['Walking', 'Light Stretching'],
    ARRAY[1, 1],
    2,
    1,
    0,
    20,
    'minutes',
    ARRAY[]::smallint[],
    'kg',
    'easy',
    0,
    0,
    'Recovery day',
    'Active recovery, felt good',
    0,
    false
  );

  -- Workout 5: One-handed kettlebell workout
  INSERT INTO public.workout_logs (
    user_id,
    started_at,
    completed_at,
    movements,
    rep_scheme,
    completed_reps,
    completed_rounds,
    completed_rungs,
    workout_goal,
    workout_goal_units,
    bells,
    unit,
    rpe,
    interval_timer,
    rest_timer,
    workout_details,
    workout_notes,
    completed_volume,
    is_one_handed
  ) VALUES (
    test_user_id,
    NOW() - INTERVAL '4 days' - INTERVAL '1 hour 15 minutes',
    NOW() - INTERVAL '4 days',
    ARRAY['Single Arm Swing', 'Single Arm Clean', 'Single Arm Press'],
    ARRAY[10, 5, 5],
    20,
    5,
    0,
    5,
    'rounds',
    ARRAY[20, 20, 20]::smallint[],
    'kg',
    'ideal',
    60,
    120,
    'Unilateral strength work',
    'Working on left side strength',
    100,
    true
  );

  -- Get the workout_log IDs for movement_logs by matching unique movement combinations
  SELECT id INTO workout1_id FROM public.workout_logs 
  WHERE user_id = test_user_id 
    AND movements = ARRAY['Kettlebell Swing', 'Goblet Squat', 'Turkish Get-up']
    ORDER BY started_at DESC LIMIT 1;
  
  SELECT id INTO workout2_id FROM public.workout_logs 
  WHERE user_id = test_user_id 
    AND movements = ARRAY['Push-up', 'Pull-up', 'Burpee']
    ORDER BY started_at DESC LIMIT 1;
  
  SELECT id INTO workout3_id FROM public.workout_logs 
  WHERE user_id = test_user_id 
    AND movements = ARRAY['Deadlift', 'Bench Press', 'Squat']
    ORDER BY started_at DESC LIMIT 1;

  -- Add movement logs for workout 1 (kettlebell workout)
  IF workout1_id IS NOT NULL THEN
    INSERT INTO public.movement_logs (
      workout_log_id,
      user_id,
      movement_name,
      rep_scheme,
      weight_one_value,
      weight_one_unit,
      weight_two_value,
      weight_two_unit
    ) VALUES
    (workout1_id, test_user_id, 'Kettlebell Swing', ARRAY[20]::smallint[], 24, 'kilograms', NULL, NULL),
    (workout1_id, test_user_id, 'Goblet Squat', ARRAY[10]::smallint[], 24, 'kilograms', NULL, NULL),
    (workout1_id, test_user_id, 'Turkish Get-up', ARRAY[5]::smallint[], 16, 'kilograms', NULL, NULL);
  END IF;

  -- Add movement logs for workout 2 (bodyweight workout)
  IF workout2_id IS NOT NULL THEN
    INSERT INTO public.movement_logs (
      workout_log_id,
      user_id,
      movement_name,
      rep_scheme,
      weight_one_value,
      weight_one_unit,
      weight_two_value,
      weight_two_unit
    ) VALUES
    (workout2_id, test_user_id, 'Push-up', ARRAY[15]::smallint[], NULL, NULL, NULL, NULL),
    (workout2_id, test_user_id, 'Pull-up', ARRAY[10]::smallint[], NULL, NULL, NULL, NULL),
    (workout2_id, test_user_id, 'Burpee', ARRAY[10]::smallint[], NULL, NULL, NULL, NULL);
  END IF;

  -- Add movement logs for workout 3 (powerlifting)
  IF workout3_id IS NOT NULL THEN
    INSERT INTO public.movement_logs (
      workout_log_id,
      user_id,
      movement_name,
      rep_scheme,
      weight_one_value,
      weight_one_unit,
      weight_two_value,
      weight_two_unit
    ) VALUES
    (workout3_id, test_user_id, 'Deadlift', ARRAY[5, 5, 5]::smallint[], 100, 'kilograms', NULL, NULL),
    (workout3_id, test_user_id, 'Bench Press', ARRAY[5, 5, 5]::smallint[], 80, 'kilograms', NULL, NULL),
    (workout3_id, test_user_id, 'Squat', ARRAY[5, 5, 5]::smallint[], 90, 'kilograms', NULL, NULL);
  END IF;

END $$;

