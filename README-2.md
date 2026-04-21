# 🛡️ SafeRoute — Redis In-Memory Data Store

A Node + Redis project extending the SafeRoute campus safety navigation system with in-memory data structures. A demo script (`redisDemo.js`) walks through full CRUD operations on two Redis Sorted Sets: a **Recent Incidents Feed** and a **Zone Safety Leaderboard**.

## 🎥 Video Walkthrough

> https://youtu.be/zRZg8todaIU

## 🧩 Problem Description

SafeRoute is a campus safety navigation system where students, staff, and visitors can browse campus zones, report safety incidents, view safety scores, and request optimized walking routes. The original system (Projects 1 & 2) uses a relational/document database for persistent storage.

This project adds a **Redis in-memory layer** for two features that require low-latency, real-time access:

1. **Recent Incidents Feed** — a live feed of safety incidents per zone, ordered by recency.
2. **Zone Safety Leaderboard** — a global ranking of campus zones by their safety score.

Both are high-frequency read, moderate-write data patterns ideal for Redis.

## 🏗️ Redis Data Structures

### 1. Recent Incidents Feed → Redis Sorted Set

| Aspect | Detail |
|---|---|
| **Key** | `recentIncidents:<zoneId>` (e.g. `recentIncidents:z1`) |
| **Members** | JSON string containing incident data (id, type, severity, source, description, reported_by, status) |
| **Scores** | Unix timestamp in milliseconds |

Using the timestamp as the score means the most recent incidents always sort first with `ZRANGE ... REV`. Each zone has its own sorted set, and old entries are trimmed to keep only the 50 most recent.

### 2. Zone Safety Leaderboard → Redis Sorted Set

| Aspect | Detail |
|---|---|
| **Key** | `zoneSafetyRanking` (single global key) |
| **Members** | Zone IDs (e.g. `z1`, `z2`) |
| **Scores** | Safety score from 0–100 (higher = safer) |

`ZADD` updates an existing member's score atomically, so re-scoring a zone is a single operation.

## ⌨️ Redis Commands

### Recent Incidents Feed — Full CRUD

```bash
# ── Initialize ──
FLUSHALL

# ── CREATE: Report an incident in zone z1 ──
ZADD recentIncidents:z1 1713600000000 '{"id":"inc_1","type":"Theft","severity":3,"source":"user-report","description":"Bike stolen","reported_by":"u1","status":"Unverified"}'

# ── READ: Get 10 most recent incidents for zone z1 ──
ZRANGE recentIncidents:z1 0 9 REV

# ── READ: Get all incidents with timestamps ──
ZRANGE recentIncidents:z1 0 -1 REV WITHSCORES

# ── READ: Count incidents in zone z1 ──
ZCARD recentIncidents:z1

# ── READ: Get timestamp of a specific incident ──
ZSCORE recentIncidents:z1 '{"id":"inc_1",...}'

# ── UPDATE: Change incident status (remove + re-add with same score) ──
ZREM recentIncidents:z1 '{"id":"inc_1","status":"Unverified",...}'
ZADD recentIncidents:z1 1713600000000 '{"id":"inc_1","status":"Verified",...}'

# ── DELETE: Remove a specific incident ──
ZREM recentIncidents:z1 '{"id":"inc_1",...}'

# ── DELETE: Trim to keep only 50 most recent ──
ZREMRANGEBYRANK recentIncidents:z1 0 -51

# ── DELETE: Clear all incidents for a zone ──
DEL recentIncidents:z1
```

### Zone Safety Leaderboard — Full CRUD

```bash
# ── CREATE: Set safety score for zone z1 ──
ZADD zoneSafetyRanking 85 z1

# ── READ: Get all zones ranked safest first ──
ZRANGE zoneSafetyRanking 0 -1 REV

# ── READ: Get rankings with scores ──
ZRANGE zoneSafetyRanking 0 -1 REV WITHSCORES

# ── READ: Get score of zone z1 ──
ZSCORE zoneSafetyRanking z1

# ── READ: Get rank of zone z1 (0-based, safest = 0) ──
ZREVRANK zoneSafetyRanking z1

# ── READ: How many zones are ranked? ──
ZCARD zoneSafetyRanking

# ── UPDATE: Change z1's score to 90 ──
ZADD zoneSafetyRanking 90 z1

# ── DELETE: Remove z1 from leaderboard ──
ZREM zoneSafetyRanking z1

# ── DELETE: Clear entire leaderboard ──
DEL zoneSafetyRanking
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Redis](https://redis.io/docs/getting-started/) running locally on port 6379

### Installation & Running

```bash
git clone https://github.com/<your-username>/saferoute-redis.git
cd saferoute-redis
npm install

# Make sure Redis is running first
redis-server

# In another terminal, run the demo
npm start
```

The script will connect to Redis, run all CRUD operations for both data structures, and print the results to the console.

## 📁 Project Structure

```
saferoute-redis/
├── redisDemo.js            # Node script demonstrating all Redis CRUD operations
├── package.json
├── docs/
│   └── requirements.pdf    # Requirements + UML + Redis design + commands
└── README.md
```

## 🛠️ Technologies

- **Node.js** — JavaScript runtime
- **Redis** — In-memory key-value store (Sorted Sets)
- **node-redis v4** — Redis client for Node.js

## 📝 AI Disclosure

Claude (Anthropic) was used as an assistance tool during this project for help with understanding Redis data structures, debugging, and generating the requirements PDF. The Redis demo script was written and understood by the project author. All code was reviewed, tested, and can be fully explained by me. This README was also assisted with AI.
