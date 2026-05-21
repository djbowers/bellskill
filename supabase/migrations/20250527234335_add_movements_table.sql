create type "public"."Body Region" as enum ('Full Body', 'Lower Body', 'Midsection', 'Unsorted*', 'Upper Body');

create type "public"."Combination Exercises" as enum ('Single Exercise', 'Combo Exercise');

create type "public"."Continuous or Alternating" as enum ('Alternating', 'Continuous');

create type "public"."Difficulty Level" as enum ('Beginner', 'Intermediate', 'Novice', 'Advanced', 'Expert', 'Grand Master', 'Master', 'Legendary');

create type "public"."Equipment" as enum ('Ab Wheel', 'Barbell', 'Battle Ropes', 'Bodyweight', 'Bulgarian Bag', 'Cable', 'Clubbell', 'Dumbbell', 'EZ Bar', 'Gymnastic Rings', 'Heavy Sandbag', 'Indian Club', 'Kettlebell', 'Landmine', 'Macebell', 'Medicine Ball', 'Miniband', 'Parallette Bars', 'Pull Up Bar', 'Resistance Band', 'Sandbag', 'Slam Ball', 'Sled', 'Sliders', 'Stability Ball', 'Superband', 'Suspension Trainer', 'Tire', 'Trap Bar', 'Wall Ball', 'Weight Plate', 'None', 'Bench (Flat)', 'Bench (Incline)', 'Bench (Decline)', 'Plyo Box', 'Slant Board', 'Sledge Hammer', 'Gravity Boots');

create type "public"."Exercise Classification" as enum ('Animal Flow', 'Balance', 'Ballistics', 'Bodybuilding', 'Calisthenics', 'Grinds', 'Mobility', 'Olympic Weightlifting', 'Plyometric', 'Postural', 'Powerlifting', 'Unsorted*');

create type "public"."Foot Elevation" as enum ('Feet Elevated', 'Foot Elevated', 'Foot Elevated (Front)', 'Foot Elevated (Lateral)', 'Foot Elevated (Rear)', 'Foot Elevated (Side)', 'Heels Elevated', 'No Elevation', 'Toes Elevated');

create type "public"."Force Type" as enum ('Other', 'Pull', 'Push', 'Push & Pull', 'Unsorted*');

create type "public"."Grip" as enum ('Bottoms Up', 'Bottoms Up Horn Grip', 'Crush Grip', 'False Grip', 'Fingertip', 'Flat Palm', 'Forearm', 'Goblet', 'Hand Assisted', 'Head Supported', 'Horn Grip', 'Mixed Grip', 'Neutral', 'No Grip', 'Other', 'Pronated', 'Supinated', 'Waiter Hold');

create type "public"."Laterality" as enum ('Contralateral', 'Bilateral', 'Unilateral', 'Ipsilateral');

create type "public"."Load Position" as enum ('Above Chest', 'Back Rack', 'Bear Hug', 'Behind Back', 'Front Rack', 'Hip Crease', 'Lateral', 'Low Hold', 'No Load', 'Order', 'Other', 'Overhead', 'Shoulder', 'Suitcase', 'Zercher');

create type "public"."Mechanics" as enum ('Compound', 'Isolation', 'Pull');

create type "public"."Movement Pattern" as enum ('Ankle Dorsiflexion', 'Ankle Plantar Flexion', 'Anti-Extension', 'Anti-Flexion', 'Anti-Lateral Flexion', 'Anti-Rotational', 'Elbow Extension', 'Elbow Flexion', 'Hip Abduction', 'Hip Adduction', 'Hip Dominant', 'Hip Extension', 'Hip External Rotation', 'Hip Flexion', 'Hip Hinge', 'Horizontal Pull', 'Horizontal Push', 'Isometric Hold', 'Knee Dominant', 'Lateral Flexion', 'Loaded Carry', 'Rotational', 'Scapular Elevation', 'Shoulder Abduction', 'Shoulder External Rotation', 'Shoulder Flexion', 'Shoulder Internal Rotation', 'Shoulder Scapular Plane Elevation', 'Spinal Extension', 'Spinal Flexion', 'Unsorted*', 'Vertical Pull', 'Vertical Push', 'Wrist Extension', 'Wrist Flexion', 'Spinal Rotational', 'Hip Internal Rotation', 'Other');

create type "public"."Muscle Group" as enum ('Abdominals', 'Glutes', 'Chest', 'Shoulders', 'Back', 'Adductors', 'Biceps', 'Quadriceps', 'Hamstrings', 'Abductors', 'Trapezius', 'Triceps', 'Forearms', 'Calves', 'Shins', 'Hip Flexors');

create type "public"."Muscles" as enum ('Rectus Abdominis', 'Gluteus Maximus', 'Obliques', 'Pectoralis Major', 'Posterior Deltoids', 'Latissimus Dorsi', 'Adductor Magnus', 'Biceps Brachii', 'Quadriceps Femoris', 'Anterior Deltoids', 'Biceps Femoris', 'Gluteus Medius', 'Upper Trapezius', 'Triceps Brachii', 'Brachioradialis', 'Erector Spinae', 'Infraspinatus', 'Lateral Deltoids', 'Gastrocnemius', 'Tibialis Anterior', 'Iliopsoas', 'Subscapularis', 'Soleus', 'Vastus Mediais', 'Rectus Femoris', 'Serratus Anterior', 'Teres Minor', 'Gluteus Minimus', 'Tensor Fasciae Latae', 'Levator Scapulae', 'Rhomboids', 'Brachialis', 'Anconeus', 'Flexor Carpi Radialis', 'Medial Deltoids', 'Supraspinatus', 'Extensor Digitorum Longus', 'Extensor Hallucis Longus', 'Trapezius', 'Teres Major', 'Tibialis Posterior');

create type "public"."Plane of Motion" as enum ('Frontal Plane', 'Sagittal Plane', 'Transverse Plane');

create type "public"."Posture" as enum ('90/90 Seated', 'Bridge', 'Half Kneeling', 'Hanging', 'Horse Stance', 'Inverted', 'Knee Hover Quadruped', 'Knee Over Toe Split Squat', 'Knee Supported', 'Kneeling', 'L Sit', 'March', 'Other', 'Prone', 'Quadruped', 'Seated', 'Seated Floor', 'Shin Box Seated', 'Side Lying', 'Side Plank', 'Single Leg Bridge', 'Single Leg Standing', 'Single Leg Standing Bent Knee', 'Single Leg Supported', 'Split Squat', 'Split Squat Isometric', 'Staggered Stance', 'Standing', 'Supine', 'Tall Kneeling', 'Toe Balance', 'Tuck L Sit', 'V Sit Seated', 'Walking', 'Wall Sit');

create type "public"."Single or Double Arm" as enum ('Single Arm', 'No Arms', 'Double Arm');

create table "public"."movements" (
    "Movement" text not null,
    "Short YouTube Demonstration" text,
    "In-Depth YouTube Explanation" text,
    "Difficulty Level" "Difficulty Level",
    "Target Muscle Group" "Muscle Group",
    "Prime Mover Muscle" "Muscles",
    "Secondary Muscle" "Muscles",
    "Tertiary Muscle" "Muscles",
    "Primary Equipment" "Equipment",
    "# Primary Items" smallint,
    "Secondary Equipment" "Equipment",
    "# Secondary Items" smallint,
    "Posture" "Posture",
    "Single or Double Arm" "Single or Double Arm",
    "Continuous or Alternating Arms" "Continuous or Alternating",
    "Grip" "Grip",
    "Load Position (Ending)" "Load Position",
    "Continuous or Alternating Legs" "Continuous or Alternating",
    "Foot Elevation" "Foot Elevation",
    "Combination Exercises" "Combination Exercises",
    "Movement Pattern #1" "Movement Pattern",
    "Movement Pattern #2" "Movement Pattern",
    "Movement Pattern #3" "Movement Pattern",
    "Plane Of Motion #1" "Plane of Motion",
    "Plane Of Motion #2" "Plane of Motion",
    "Plane Of Motion #3" "Plane of Motion",
    "Body Region" "Body Region",
    "Force Type" "Force Type",
    "Mechanics" "Mechanics",
    "Laterality" "Laterality",
    "Primary Exercise Classification" "Exercise Classification",
    "id" uuid not null default gen_random_uuid()
);

alter table "public"."movements" enable row level security;

CREATE UNIQUE INDEX movements_id_key ON public.movements USING btree (id);

CREATE UNIQUE INDEX movements_pkey ON public.movements USING btree (id);

alter table "public"."movements" add constraint "movements_pkey" PRIMARY KEY using index "movements_pkey";

alter table "public"."movements" add constraint "movements_id_key" UNIQUE using index "movements_id_key";

create policy "Enable read access for authenticated users"
on "public"."movements"
as permissive
for select
to authenticated
using (true);
