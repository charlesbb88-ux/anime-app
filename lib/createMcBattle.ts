type CreateMcBattleResult = {
  id: string;
  challenger_user_id: string;
  defender_user_id: string;
  status: string;
  winner_user_id: string | null;
  battle_result: unknown;
  replay_data: unknown;
  created_at: string;
  resolved_at: string | null;
};

export async function createMcBattle(
  challengerUserId: string,
  defenderUserId: string
): Promise<CreateMcBattleResult> {
  if (!challengerUserId) {
    throw new Error("Missing challenger user id.");
  }

  if (!defenderUserId) {
    throw new Error("Missing defender user id.");
  }

  if (challengerUserId === defenderUserId) {
    throw new Error("Challenger and defender cannot be the same user.");
  }

  const response = await fetch("/api/mc/create-battle", {
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
    throw new Error(payload?.error ?? "Failed to create battle.");
  }

  return payload as CreateMcBattleResult;
}