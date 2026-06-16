import { Database } from '../../types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

let id = 1;

export class ExampleProfile implements Profile {
  avatar_url: string | null;
  current_period_end: string | null;
  full_name: string | null;
  id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_tier: string;
  training_goal: string | null;
  trial_ends_at: string | null;
  updated_at: string | null;
  username: string | null;
  website: string | null;

  constructor({
    avatar_url = null,
    current_period_end = null,
    full_name = null,
    stripe_customer_id = null,
    stripe_subscription_id = null,
    subscription_status = null,
    subscription_tier = 'free',
    training_goal = null,
    trial_ends_at = null,
    updated_at = '2024-02-20T14:12:05.335714+00:00',
    username = 'lukeskywalker',
    website = null,
  }: Partial<Profile>) {
    this.avatar_url = avatar_url;
    this.current_period_end = current_period_end;
    this.full_name = full_name;
    this.id = id.toString();
    this.stripe_customer_id = stripe_customer_id;
    this.stripe_subscription_id = stripe_subscription_id;
    this.subscription_status = subscription_status;
    this.subscription_tier = subscription_tier;
    this.training_goal = training_goal;
    this.trial_ends_at = trial_ends_at;
    this.updated_at = updated_at;
    this.username = username;
    this.website = website;
    id++;
  }
}
