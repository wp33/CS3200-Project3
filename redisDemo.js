/**
 * SafeRoute — Redis Demo Script
 *
 * Demonstrates full CRUD operations on two Redis Sorted Sets:
 *   1. recentIncidents:<zoneId>  — incident feed per campus zone
 *   2. zoneSafetyRanking         — global zone safety leaderboard
 *
 * Prerequisites: Redis running on localhost:6379
 * Run:  npm start   (or)   node redisDemo.js
 */

import { createClient } from "redis";

const client = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
client.on("error", (err) => console.error("Redis error:", err));

// ── Helper: print a section header ──
function header(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

async function main() {
  await client.connect();
  console.log("Connected to Redis");

  // ── INITIALIZE: clear all keys ──
  await client.flushAll();
  console.log("FLUSHALL — database cleared\n");

  // ================================================================
  //  1. RECENT INCIDENTS FEED  (Sorted Set)
  //     Key:    recentIncidents:<zoneId>
  //     Member: JSON string with incident data
  //     Score:  Unix timestamp (ms)
  // ================================================================

  header("1. RECENT INCIDENTS — CREATE");

  const zone = "z1"; // Main Campus
  const key = `recentIncidents:${zone}`;

  // CREATE — report three incidents with ZADD
  const incidents = [
    { id: "inc_001", type: "Theft", severity: 3, source: "user-report", description: "Bike stolen near library", reported_by: "u1", status: "Unverified" },
    { id: "inc_002", type: "Lighting", severity: 2, source: "user-report", description: "Broken streetlight on Elm St", reported_by: "u2", status: "Unverified" },
    { id: "inc_003", type: "Assault", severity: 5, source: "campus-police", description: "Reported near dorm entrance", reported_by: "u1", status: "Verified" },
  ];

  const now = Date.now();
  for (let i = 0; i < incidents.length; i++) {
    const member = JSON.stringify(incidents[i]);
    const score = now - (incidents.length - i) * 3600000; // stagger by 1 hour
    await client.zAdd(key, { score, value: member });
    console.log(`  ZADD ${key} ${score} '${incidents[i].id}' — ${incidents[i].type}`);
  }

  // ── READ — get all incidents, most recent first ──
  header("1. RECENT INCIDENTS — READ");

  const allItems = await client.zRangeWithScores(key, 0, -1, { REV: true });
  console.log(`  ZRANGE ${key} 0 -1 REV WITHSCORES → ${allItems.length} items:`);
  allItems.forEach((item, idx) => {
    const data = JSON.parse(item.value);
    console.log(`    [${idx}] ${data.id} | ${data.type} | sev=${data.severity} | ${new Date(item.score).toISOString()}`);
  });

  // Count
  const count = await client.zCard(key);
  console.log(`\n  ZCARD ${key} → ${count}`);

  // Score of a specific member
  const memberToCheck = JSON.stringify(incidents[0]);
  const memberScore = await client.zScore(key, memberToCheck);
  console.log(`  ZSCORE ${key} '${incidents[0].id}' → ${memberScore} (${new Date(memberScore).toISOString()})`);

  // ── UPDATE — change incident status (remove old member, re-add with same score) ──
  header("1. RECENT INCIDENTS — UPDATE");

  const oldMember = JSON.stringify(incidents[0]); // inc_001, status: Unverified
  const oldScore = await client.zScore(key, oldMember);

  // Remove old version
  await client.zRem(key, oldMember);
  console.log(`  ZREM ${key} '${incidents[0].id}' — removed old version`);

  // Re-add with updated status, same timestamp
  const updatedIncident = { ...incidents[0], status: "Verified" };
  const newMember = JSON.stringify(updatedIncident);
  await client.zAdd(key, { score: oldScore, value: newMember });
  console.log(`  ZADD ${key} ${oldScore} '${updatedIncident.id}' — status now: ${updatedIncident.status}`);

  // Verify the update
  const afterUpdate = await client.zRangeWithScores(key, 0, -1, { REV: true });
  console.log(`\n  Current incidents after update:`);
  afterUpdate.forEach((item, idx) => {
    const data = JSON.parse(item.value);
    console.log(`    [${idx}] ${data.id} | status=${data.status}`);
  });

  // ── DELETE — remove a specific incident ──
  header("1. RECENT INCIDENTS — DELETE");

  const memberToDelete = JSON.stringify(incidents[1]);
  await client.zRem(key, memberToDelete);
  console.log(`  ZREM ${key} '${incidents[1].id}' — removed`);

  const afterDelete = await client.zRangeWithScores(key, 0, -1, { REV: true });
  console.log(`  Remaining incidents: ${afterDelete.length}`);
  afterDelete.forEach((item) => {
    const data = JSON.parse(item.value);
    console.log(`    - ${data.id} | ${data.type}`);
  });

  // DELETE — clear all incidents for this zone
  await client.del(key);
  console.log(`\n  DEL ${key} — all incidents cleared`);
  const afterClear = await client.zCard(key);
  console.log(`  ZCARD ${key} → ${afterClear}`);

  // ================================================================
  //  2. ZONE SAFETY LEADERBOARD  (Sorted Set)
  //     Key:    zoneSafetyRanking
  //     Member: zoneId
  //     Score:  safety score 0–100 (higher = safer)
  // ================================================================

  const lbKey = "zoneSafetyRanking";

  header("2. SAFETY LEADERBOARD — CREATE");

  const zoneScores = [
    { value: "z1", score: 85 },  // Main Campus
    { value: "z2", score: 72 },  // North Residential
    { value: "z3", score: 91 },  // South Academic
    { value: "z4", score: 68 },  // East Athletic
    { value: "z5", score: 55 },  // West Parking
  ];

  const zoneNames = {
    z1: "Main Campus", z2: "North Residential", z3: "South Academic",
    z4: "East Athletic", z5: "West Parking",
  };

  for (const zs of zoneScores) {
    await client.zAdd(lbKey, zs);
    console.log(`  ZADD ${lbKey} ${zs.score} ${zs.value} (${zoneNames[zs.value]})`);
  }

  // ── READ — full leaderboard, safest first ──
  header("2. SAFETY LEADERBOARD — READ");

  const leaderboard = await client.zRangeWithScores(lbKey, 0, -1, { REV: true });
  console.log(`  ZRANGE ${lbKey} 0 -1 REV WITHSCORES:`);
  leaderboard.forEach((item, idx) => {
    console.log(`    #${idx + 1}  ${item.value} (${zoneNames[item.value]}) — score: ${item.score}/100`);
  });

  // Read specific zone score
  const z1Score = await client.zScore(lbKey, "z1");
  console.log(`\n  ZSCORE ${lbKey} z1 → ${z1Score}`);

  // Read rank of a zone (0-based, highest score = rank 0)
  const z1Rank = await client.zRevRank(lbKey, "z1");
  console.log(`  ZREVRANK ${lbKey} z1 → ${z1Rank} (0-based, so #${z1Rank + 1} safest)`);

  // Count
  const lbCount = await client.zCard(lbKey);
  console.log(`  ZCARD ${lbKey} → ${lbCount} zones ranked`);

  // ── UPDATE — change a zone's safety score ──
  header("2. SAFETY LEADERBOARD — UPDATE");

  console.log(`  Before: z5 (West Parking) score = ${await client.zScore(lbKey, "z5")}`);
  await client.zAdd(lbKey, { score: 78, value: "z5" });
  console.log(`  ZADD ${lbKey} 78 z5 — updated score`);
  console.log(`  After:  z5 (West Parking) score = ${await client.zScore(lbKey, "z5")}`);

  // Show updated leaderboard
  const updatedLb = await client.zRangeWithScores(lbKey, 0, -1, { REV: true });
  console.log(`\n  Updated leaderboard:`);
  updatedLb.forEach((item, idx) => {
    console.log(`    #${idx + 1}  ${item.value} (${zoneNames[item.value]}) — ${item.score}/100`);
  });

  // ── DELETE — remove a zone from the leaderboard ──
  header("2. SAFETY LEADERBOARD — DELETE");

  await client.zRem(lbKey, "z4");
  console.log(`  ZREM ${lbKey} z4 — East Athletic removed`);

  const afterRemove = await client.zRangeWithScores(lbKey, 0, -1, { REV: true });
  console.log(`  Remaining zones: ${afterRemove.length}`);
  afterRemove.forEach((item, idx) => {
    console.log(`    #${idx + 1}  ${item.value} (${zoneNames[item.value]}) — ${item.score}/100`);
  });

  // DELETE — clear entire leaderboard
  await client.del(lbKey);
  console.log(`\n  DEL ${lbKey} — leaderboard cleared`);
  console.log(`  ZCARD ${lbKey} → ${await client.zCard(lbKey)}`);

  // ── Done ──
  header("DONE");
  console.log("  All CRUD operations demonstrated successfully.\n");

  await client.quit();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
