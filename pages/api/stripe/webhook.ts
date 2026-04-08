import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY as string;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

if (!stripeWebhookSecret) {
  throw new Error("STRIPE_WEBHOOK_SECRET is not set");
}

const stripe = new Stripe(stripeSecretKey);

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

function hasProAccess(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

function getSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const firstItem = subscription.items.data[0];
  return firstItem?.price?.id ?? null;
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  const firstItem = subscription.items.data[0];
  return typeof firstItem?.current_period_end === "number"
    ? firstItem.current_period_end
    : null;
}

function unixToIso(value: number | null | undefined): string | null {
  return typeof value === "number"
    ? new Date(value * 1000).toISOString()
    : null;
}

async function updateProfileByUserId(
  userId: string,
  values: {
    is_pro?: boolean;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    stripe_price_id?: string | null;
    stripe_subscription_status?: string | null;
    stripe_cancel_at_period_end?: boolean | null;
    stripe_current_period_end?: string | null;
    stripe_cancel_at?: string | null;
  }
) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update(values)
    .eq("id", userId);

  if (error) {
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  const signature = req.headers["stripe-signature"];

  if (!signature || Array.isArray(signature)) {
    return res.status(400).send("Missing Stripe signature");
  }

  let event: Stripe.Event;

  try {
    const rawBody = await readRawBody(req);

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      stripeWebhookSecret
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return res.status(400).send("Webhook signature verification failed");
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const supabaseUserId = session.metadata?.supabase_user_id;
        const stripeCustomerId =
          typeof session.customer === "string" ? session.customer : null;
        const stripeSubscriptionId =
          typeof session.subscription === "string" ? session.subscription : null;

        if (!supabaseUserId) {
          console.error("Missing supabase_user_id in checkout.session.completed");
          break;
        }

        let stripePriceId: string | null = null;
        let stripeSubscriptionStatus: string | null = null;
        let stripeCancelAtPeriodEnd: boolean | null = null;
        let stripeCurrentPeriodEnd: string | null = null;
        let stripeCancelAt: string | null = null;

        if (stripeSubscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(
            stripeSubscriptionId
          );

          stripePriceId = getSubscriptionPriceId(subscription);
          stripeSubscriptionStatus = subscription.status;
          stripeCancelAtPeriodEnd = subscription.cancel_at_period_end;
          stripeCurrentPeriodEnd = unixToIso(getSubscriptionPeriodEnd(subscription));
          stripeCancelAt = unixToIso(subscription.cancel_at);
        }

        await updateProfileByUserId(supabaseUserId, {
          is_pro: true,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_price_id: stripePriceId,
          stripe_subscription_status: stripeSubscriptionStatus,
          stripe_cancel_at_period_end: stripeCancelAtPeriodEnd,
          stripe_current_period_end: stripeCurrentPeriodEnd,
          stripe_cancel_at: stripeCancelAt,
        });

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const supabaseUserId = subscription.metadata?.supabase_user_id;

        if (!supabaseUserId) {
          console.error("Missing supabase_user_id in customer.subscription.updated");
          break;
        }

        await updateProfileByUserId(supabaseUserId, {
          is_pro: hasProAccess(subscription.status),
          stripe_customer_id:
            typeof subscription.customer === "string"
              ? subscription.customer
              : null,
          stripe_subscription_id: subscription.id,
          stripe_price_id: getSubscriptionPriceId(subscription),
          stripe_subscription_status: subscription.status,
          stripe_cancel_at_period_end: subscription.cancel_at_period_end,
          stripe_current_period_end: unixToIso(getSubscriptionPeriodEnd(subscription)),
          stripe_cancel_at: unixToIso(subscription.cancel_at),
        });

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const supabaseUserId = subscription.metadata?.supabase_user_id;

        if (!supabaseUserId) {
          console.error("Missing supabase_user_id in customer.subscription.deleted");
          break;
        }

        await updateProfileByUserId(supabaseUserId, {
          is_pro: false,
          stripe_customer_id:
            typeof subscription.customer === "string"
              ? subscription.customer
              : null,
          stripe_subscription_id: subscription.id,
          stripe_price_id: getSubscriptionPriceId(subscription),
          stripe_subscription_status: subscription.status,
          stripe_cancel_at_period_end: false,
          stripe_current_period_end: null,
          stripe_cancel_at: null,
        });

        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
    return res.status(500).send("Webhook handler failed");
  }
}