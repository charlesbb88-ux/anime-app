param(
  [string]$BaseUrl = "http://localhost:3000",
  [int]$Batch = 2,
  [string]$AdminSecret = ""
)

function Invoke-Api {
  param([string]$Url)
  $headers = @{}
  if ($AdminSecret -ne "") { $headers["x-admin-secret"] = $AdminSecret }
  return Invoke-RestMethod -Method GET -Uri $Url -Headers $headers
}

Write-Host "Fetching totals..."
$stats = Invoke-Api "$BaseUrl/api/admin/tmdb-artwork-stats"
$totalAnime = [int]$stats.totalAnime
Write-Host "Total anime with tmdb_id: $totalAnime"
Write-Host ""

Write-Host "=== Backfilling TMDB episode mapping (STRICT) ==="
$cursor = ""
$processed = 0
$mapped = 0
$skipped = 0
$errors = 0

while ($true) {
  $url = "$BaseUrl/api/admin/backfill-tmdb-episode-mapping?limit=$Batch"
  if ($cursor -ne "") { $url += "&cursor=$cursor" }

  $resp = Invoke-Api $url

  if ($resp.done -eq $true) { break }

  $processed += [int]$resp.processedAnime
  $mapped += [int]$resp.mappedEpisodes
  $cursor = $resp.nextCursor

  foreach ($a in $resp.perAnime) {
    if ($a.ok -eq $false) { $errors++ }
    if ($a.skipped -eq $true) { $skipped++ }
  }

  $remaining = $totalAnime - $processed
  if ($remaining -lt 0) { $remaining = 0 }

  $pct = 0
  if ($totalAnime -gt 0) { $pct = [int](($processed / $totalAnime) * 100) }

  Write-Progress -Activity "Backfill episode mapping" -Status "$processed / $totalAnime (left: $remaining) | mapped episodes: $mapped | skipped anime: $skipped | errors: $errors" -PercentComplete $pct

  Write-Host ("Mapping batch: processedAnime {0}, mappedEpisodes {1}, cursor {2}" -f $resp.processedAnime, $resp.mappedEpisodes, $resp.nextCursor)

  foreach ($a in $resp.perAnime) {
    if ($a.skipped -eq $true) {
      Write-Host ("  SKIP animeId {0}: {1}" -f $a.animeId, $a.reason)
    }
    if ($a.ok -eq $false) {
      Write-Host ("  ERROR animeId {0}: {1}" -f $a.animeId, $a.error)
    }
  }
}

Write-Progress -Activity "Backfill episode mapping" -Completed
Write-Host "DONE. AnimeProcessed=$processed | EpisodesMapped=$mapped | SkippedAnime=$skipped | Errors=$errors"
