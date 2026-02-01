param(
  [string]$BaseUrl = "http://localhost:3000",
  [int]$SeriesBatch = 5,
  [int]$EpisodeBatch = 2,
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
Write-Host "Total episodes (mappable): $($stats.totalEpisodes)"
Write-Host ""

# -------------------------
# SERIES IMPORT
# -------------------------
Write-Host "=== Importing SERIES artwork (posters/backdrops/logos + seasons) ==="
$seriesCursor = ""
$seriesProcessed = 0
$seriesInserted = 0

while ($true) {
  $url = "$BaseUrl/api/admin/import-tmdb-series-artwork?limit=$SeriesBatch"
  if ($seriesCursor -ne "") { $url += "&cursor=$seriesCursor" }

  $resp = Invoke-Api $url

  if ($resp.done -eq $true) { break }

  $seriesProcessed += [int]$resp.processed
  $seriesInserted += [int]$resp.inserted
  $seriesCursor = $resp.nextCursor

  $remaining = $totalAnime - $seriesProcessed
  if ($remaining -lt 0) { $remaining = 0 }

  $pct = 0
  if ($totalAnime -gt 0) { $pct = [int](($seriesProcessed / $totalAnime) * 100) }

  Write-Progress -Activity "Series artwork" -Status "$seriesProcessed / $totalAnime (left: $remaining) | inserted: $seriesInserted" -PercentComplete $pct
  Write-Host ("Series batch: processed {0}, inserted {1}, cursor {2}" -f $resp.processed, $resp.inserted, $resp.nextCursor)
}

Write-Progress -Activity "Series artwork" -Completed
Write-Host "Series done. Processed=$seriesProcessed Inserted=$seriesInserted"
Write-Host ""

# -------------------------
# EPISODE STILLS IMPORT
# -------------------------
Write-Host "=== Importing EPISODE stills ==="
$epCursor = ""
$epAnimeProcessed = 0
$epInserted = 0

while ($true) {
  $url = "$BaseUrl/api/admin/import-tmdb-episode-stills?limit=$EpisodeBatch"
  if ($epCursor -ne "") { $url += "&cursor=$epCursor" }

  $resp = Invoke-Api $url

  if ($resp.done -eq $true) { break }

  $epAnimeProcessed += [int]$resp.processedAnime
  $epInserted += [int]$resp.inserted
  $epCursor = $resp.nextCursor

  $remaining = $totalAnime - $epAnimeProcessed
  if ($remaining -lt 0) { $remaining = 0 }

  $pct = 0
  if ($totalAnime -gt 0) { $pct = [int](($epAnimeProcessed / $totalAnime) * 100) }

  Write-Progress -Activity "Episode stills (by anime)" -Status "$epAnimeProcessed / $totalAnime (left: $remaining) | inserted: $epInserted" -PercentComplete $pct
  Write-Host ("Episode batch: processedAnime {0}, inserted {1}, cursor {2}" -f $resp.processedAnime, $resp.inserted, $resp.nextCursor)

  foreach ($a in $resp.perAnime) {
    if ($a.skippedUnmappableEpisodes -gt 0) {
      Write-Host ("  WARN animeId {0}: skipped {1} episodes missing season_number/season_episode_number" -f $a.animeId, $a.skippedUnmappableEpisodes)
    }
  }
}

Write-Progress -Activity "Episode stills (by anime)" -Completed
Write-Host "Episode stills done. AnimeProcessed=$epAnimeProcessed Inserted=$epInserted"
