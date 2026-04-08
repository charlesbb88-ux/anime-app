import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PRO_PRICE_ID;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

if (!stripePriceId) {
  throw new Error("STRIPE_PRO_PRICE_ID is not set");
}

const stripe = new Stripe(stripeSecretKey);

type Data =
  | { url: string }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!user.email) {
      return res.status(400).json({ error: "User email is missing" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: "https://www.inkbased.app/pro?success=1",
      cancel_url: "https://www.inkbased.app/pro?canceled=1",
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
    });

    if (!session.url) {
      return res.status(500).json({ error: "Stripe did not return a checkout URL" });
    }

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("create-checkout-session error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}