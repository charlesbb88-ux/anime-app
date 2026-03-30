import { supabase } from "@/lib/supabaseClient";

export type McChallengeStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "canceled"
  | "expired"
  | "ready_to_watch";

export type McChallengeRow = {
  id: string;
  challenger_user_id: string;
  defender_user_id: string;
  status: McChallengeStatus;
  battle_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  responded_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
};

export type McChallengeProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export type McChallengeWithProfiles = McChallengeRow & {
  challenger: McChallengeProfile | null;
  defender: McChallengeProfile | null;
};

export type McChallengeInboxData = {
  received: McChallengeWithProfiles[];
  sent: McChallengeWithProfiles[];
  readyToWatch: McChallengeWithProfiles[];
  badgeCount: number;
};

type CreateChallengeResponse = {
  challenge: McChallengeRow;
};

type RespondChallengeResponse = {
  challenge: McChallengeRow;
  battleId?: string | null;
};

type RawJoinedProfile =
  | McChallengeProfile
  | McChallengeProfile[]
  | null
  | undefined;

type RawMcChallengeRow = McChallengeRow & {
  challenger?: RawJoinedProfile;
  defender?: RawJoinedProfile;
};

function isExpiredPending(row: Pick<McChallengeRow, "status" | "expires_at">) {
  return row.status === "pending" && new Date(row.expires_at).getTime() < Date.now();
}

function normalizeJoinedProfile(value: RawJoinedProfile): McChallengeProfile | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function normalizeChallenge(row: RawMcChallengeRow): McChallengeWithProfiles {
  const normalized: McChallengeWithProfiles = {
    id: row.id,
    challenger_user_id: row.challenger_user_id,
    defender_user_id: row.defender_user_id,
    status: row.status,
    battle_id: row.battle_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at,
    responded_at: row.responded_at,
    canceled_at: row.canceled_at,
    expired_at: row.expired_at,
    challenger: normalizeJoinedProfile(row.challenger),
    defender: normalizeJoinedProfile(row.defender),
  };

  if (!isExpiredPending(normalized)) {
    return normalized;
  }

  return {
    ...normalized,
    status: "expired",
  };
}

export async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user?.id) {
    throw new Error("No authenticated user found.");
  }

  return user.id;
}

export async function createChallenge(defenderUserId: string): Promise<McChallengeRow> {
  const challengerUserId = await getCurrentUserId();

  const response = await fetch("/api/mc/challenges/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      challengerUserId,
      defenderUserId,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to create challenge.");
  }

  return (payload as CreateChallengeResponse).challenge;
}

export async function acceptChallenge(
  challengeId: string
): Promise<RespondChallengeResponse> {
  const actorUserId = await getCurrentUserId();

  const response = await fetch("/api/mc/challenges/respond", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      challengeId,
      actorUserId,
      action: "accept",
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to accept challenge.");
  }

  return payload as RespondChallengeResponse;
}

export async function rejectChallenge(
  challengeId: string
): Promise<RespondChallengeResponse> {
  const actorUserId = await getCurrentUserId();

  const response = await fetch("/api/mc/challenges/respond", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      challengeId,
      actorUserId,
      action: "reject",
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to reject challenge.");
  }

  return payload as RespondChallengeResponse;
}

export async function cancelChallenge(
  challengeId: string
): Promise<RespondChallengeResponse> {
  const actorUserId = await getCurrentUserId();

  const response = await fetch("/api/mc/challenges/cancel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      challengeId,
      actorUserId,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to cancel challenge.");
  }

  return payload as RespondChallengeResponse;
}

export async function getChallengeInbox(): Promise<McChallengeInboxData> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("mc_challenges")
    .select(`
      id,
      challenger_user_id,
      defender_user_id,
      status,
      battle_id,
      created_at,
      updated_at,
      expires_at,
      responded_at,
      canceled_at,
      expired_at,
      challenger:profiles!mc_challenges_challenger_user_id_fkey (
        id,
        username,
        avatar_url
      ),
      defender:profiles!mc_challenges_defender_user_id_fkey (
        id,
        username,
        avatar_url
      )
    `)
    .or(`challenger_user_id.eq.${userId},defender_user_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as RawMcChallengeRow[]).map(normalizeChallenge);

  const received = rows.filter(
    (row) => row.defender_user_id === userId && row.status === "pending"
  );

  const sent = rows.filter(
    (row) => row.challenger_user_id === userId && row.status === "pending"
  );

  const readyToWatch = rows.filter(
    (row) =>
      (row.challenger_user_id === userId || row.defender_user_id === userId) &&
      row.status === "ready_to_watch"
  );

  const badgeCount = received.length + readyToWatch.length;

  return {
    received,
    sent,
    readyToWatch,
    badgeCount,
  };
}