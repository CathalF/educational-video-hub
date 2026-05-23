# Educational Video Hub

A serverless REST API for managing educational video metadata, built on Azure Functions v4. Educators upload video files directly to Azure Blob Storage using short-lived SAS tokens; metadata is stored in Azure Cosmos DB; and a GitHub Actions pipeline deploys the functions to Azure on every push to `main`.

This project was submitted for the Cloud Native Development module at Ulster University (76%, First Class).

---

## Table of Contents

- [Why I built this](#why-i-built-this)
- [What's in this repo vs. the wider architecture](#whats-in-this-repo-vs-the-wider-architecture)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [CI/CD](#cicd)
- [Testing](#testing)
- [What I'd Do Differently](#what-id-do-differently)
- [Status](#status)

---

## Why I built this

The module asked for an enterprise-grade cloud architecture, not a locally-hosted CRUD app. I designed a platform around Azure's event-driven services: files arrive at Blob Storage, trigger downstream processing via Event Grid, get indexed by Azure Video Indexer, and are surfaced through Azure Front Door with Entra ID enforcing access.

This repo contains the Azure Functions backend, the deployable piece of that design. The wider services (Logic Apps for workflows, Event Grid for triggers, Front Door as the edge layer, Video Indexer for AI transcription, Entra ID for auth) were configured in the Azure portal and are described below as part of the architecture but are not in this repository's code.

---

## What's in this repo vs. the wider architecture

| Service | In this repo? | Notes |
|---|---|---|
| Azure Functions (7 endpoints) | Yes | All code under `src/functions/` |
| Azure Cosmos DB | Yes (SDK calls) | Via `@azure/cosmos` client |
| Azure Blob Storage | Yes (SAS token generation) | Via `@azure/storage-blob` |
| GitHub Actions CI/CD | Yes | `.github/workflows/deploy.yml` |
| Azure Logic Apps | No | Designed for post-upload workflow automation |
| Azure Event Grid | No | Designed to trigger processing on Blob uploads |
| Azure Video Indexer | No | Designed for AI transcription; `aiMetadata` field in the schema reserved for its output |
| Azure Front Door | No | Designed as the edge layer and CDN |
| Microsoft Entra ID | No | Designed for auth; all functions currently use `authLevel: 'anonymous'` |

---

## Key Features

- **SAS token upload flow:** clients request a short-lived (1-hour) write-only SAS token from `POST /api/upload/sas-token`, then PUT the file directly to Blob Storage without routing through the function. The signed URL is scoped to a specific blob name and container.
- **Three Blob Storage containers** supported by the SAS endpoint: `videos`, `thumbnails`, `transcripts`
- **Cosmos DB partition key on `category`**: the delete function passes `video.category` as the partition key, so queries and deletes operate within the correct logical partition
- **Full-text search** via Cosmos DB's `CONTAINS` function on title and description, with optional category filtering
- **`aiMetadata` schema field** reserved for Video Indexer output: `transcript`, `keywords`, `speakers`, `topics` — intended to be populated by the event-driven pipeline
- **GitHub Actions deployment** on every push to `main`, deploying to `func-educationalvideohub`
- **Application Insights** logging configured in `host.json` with sampling enabled

---

## Architecture

```
Client
  │
  │  (1) Request SAS token
  ▼
POST /api/upload/sas-token ──── Azure Function (GenerateSasToken)
                                 │ returns signed upload URL
  │                              │
  │  (2) Upload directly         │
  ▼                              │
Azure Blob Storage ─────────────┘
(containers: videos, thumbnails, transcripts)
  │
  │  (3) Blob-created event [designed, not in repo]
  ▼
Azure Event Grid ──► Azure Logic Apps ──► Azure Video Indexer
                                          │ populates aiMetadata
  │                                       │
  │  (4) CRUD / metadata queries          │
  ▼                                       │
Azure Functions (7 endpoints) ───────────┘
  │
  ▼
Azure Cosmos DB
(database: configured via COSMOS_DATABASE_NAME,
 container: configured via COSMOS_CONTAINER_NAME,
 partition key: category)

Traffic routing: Azure Front Door [designed, not in repo]
Authentication: Microsoft Entra ID [designed, not in repo]
```

### Function execution model

Each function is an independent module registered with `app.http(...)` from `@azure/functions` v4. The Azure Functions runtime discovers them via the `"main": "src/functions/*.js"` glob in `package.json`. There is no shared routing layer — each file registers its own route and method.

---

## Tech Stack

| Technology | Version | Role |
|---|---|---|
| Node.js | 20.x | Runtime (as configured in GitHub Actions) |
| Azure Functions SDK | 4.0 | Serverless runtime and HTTP trigger |
| `@azure/cosmos` | 4.0 | Cosmos DB client |
| `@azure/storage-blob` | 12.17 | Blob Storage SAS token generation |
| Azure Functions Core Tools | — | Local development (`func start`) |
| GitHub Actions | — | CI/CD pipeline |

---

## API Reference

All endpoints are prefixed with `/api` (set in `host.json`).

| Method | Route | Function | Description |
|---|---|---|---|
| `GET` | `/api/videos` | `GetVideos` | List all videos, ordered by upload date descending |
| `GET` | `/api/videos/{id}` | `GetVideoById` | Get single video by Cosmos DB document ID |
| `POST` | `/api/videos` | `CreateVideo` | Create video metadata record |
| `PUT` | `/api/videos/{id}` | `UpdateVideo` | Update video metadata |
| `DELETE` | `/api/videos/{id}` | `DeleteVideo` | Delete video record |
| `GET` | `/api/videos/search` | `SearchVideos` | Search by `?q=` (title/description) and `?category=` |
| `POST` | `/api/upload/sas-token` | `GenerateSasToken` | Return a signed Blob Storage upload URL |

**Note:** All endpoints currently use `authLevel: 'anonymous'`. In the designed architecture, Microsoft Entra ID would gate access via Azure Front Door or Function-level auth.

### POST /api/videos — request body

```json
{
  "title": "Introduction to Machine Learning",
  "category": "computer-science",
  "description": "Optional description",
  "uploadedBy": "instructor@university.ac.uk",
  "blobUrl": "https://account.blob.core.windows.net/videos/1234-video.mp4",
  "thumbnailUrl": "https://account.blob.core.windows.net/thumbnails/1234-thumb.jpg",
  "duration": 3600,
  "tags": ["ml", "ai", "beginner"]
}
```

### POST /api/upload/sas-token — request body

```json
{
  "fileName": "lecture-01.mp4",
  "contentType": "video/mp4",
  "containerName": "videos"
}
```

Returns `uploadUrl` (pre-signed write URL, 1-hour expiry) and `blobUrl` (permanent read URL).

---

## Data Model

Cosmos DB document schema (container partition key: `category`):

```json
{
  "id": "video-1703123456789-abc123",
  "title": "Introduction to Machine Learning",
  "description": "",
  "category": "computer-science",
  "uploadedBy": "instructor@university.ac.uk",
  "uploadDate": "2025-01-15T10:30:00.000Z",
  "blobUrl": "https://account.blob.core.windows.net/videos/...",
  "thumbnailUrl": "https://account.blob.core.windows.net/thumbnails/...",
  "duration": 3600,
  "tags": ["ml", "ai"],
  "views": 0,
  "status": "pending",
  "aiMetadata": {
    "transcript": "",
    "keywords": [],
    "speakers": [],
    "topics": []
  },
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

The `aiMetadata` object is populated as an empty scaffold on creation, intended to be filled by the Azure Video Indexer pipeline when that integration is active.

---

## Getting Started

### Prerequisites

- Node.js 20
- [Azure Functions Core Tools v4](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)
- An Azure Storage account and a Cosmos DB account (or use the Azurite and Cosmos DB emulators locally)

### Install

```bash
git clone https://github.com/CathalF/educational-video-hub.git
cd educational-video-hub
npm install
```

### Configure local settings

Azure Functions uses `local.settings.json` for local environment variables. This file is gitignored; create it from the example:

```bash
cp local.settings.json.example local.settings.json
```

Edit `local.settings.json` with your connection strings:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_CONNECTION_STRING": "AccountEndpoint=https://your-account.documents.azure.com:443/;AccountKey=...",
    "COSMOS_DATABASE_NAME": "VideoHubDB",
    "COSMOS_CONTAINER_NAME": "videos",
    "STORAGE_CONNECTION_STRING": "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=..."
  }
}
```

### Run locally

```bash
npm start
# equivalent to: func start
```

Functions are available at `http://localhost:7071/api/...`.

```bash
# Quick smoke test
curl http://localhost:7071/api/videos
```

---

## Environment Variables

These are set in `local.settings.json` for local development and in Azure Portal > Function App > Configuration > Application settings for production.

| Variable | Description | Example |
|---|---|---|
| `COSMOS_CONNECTION_STRING` | Cosmos DB connection string | `AccountEndpoint=https://...;AccountKey=...` |
| `COSMOS_DATABASE_NAME` | Name of the Cosmos DB database | `VideoHubDB` |
| `COSMOS_CONTAINER_NAME` | Name of the Cosmos DB container | `videos` |
| `STORAGE_CONNECTION_STRING` | Azure Storage account connection string | `DefaultEndpointsProtocol=https;...` |

The partition key is implied to be `category` by the delete implementation (`container.item(id, video.category).delete()`). Your Cosmos DB container must be created with `category` as the partition key.

---

## CI/CD

`.github/workflows/deploy.yml` runs on every push to `main` and on manual dispatch:

1. Check out code
2. Install Node.js 20
3. `npm install`
4. `npm test` (currently a no-op placeholder)
5. Deploy to Azure Functions app `func-educationalvideohub` using `Azure/functions-action@v1` and a `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` secret

To deploy to your own Azure Functions app, update `AZURE_FUNCTIONAPP_NAME` in `deploy.yml` and add the publish profile to your repository's Actions secrets.

---

## Testing

There are no automated tests. The `"test"` script in `package.json` is a placeholder (`echo "Tests passed" && exit 0`) that passes the CI step without running anything.

---

## What I'd Do Differently

**1. Add authentication.**
All seven endpoints use `authLevel: 'anonymous'`. This makes the API publicly writable without any credential. In the intended architecture, Entra ID sits upstream, but defence-in-depth means the functions themselves should also validate a token. The Azure Functions SDK supports `authLevel: 'function'` (function-key based) or `'user'` (Entra-backed) directly.

**2. Use Cosmos DB parameterised queries consistently.**
`GetVideos` uses a raw query string (`SELECT * FROM c ORDER BY c.uploadDate DESC`) without parameters, which is safe here because there is no user input, but it is inconsistent with `SearchVideos` which correctly uses parameterised queries. Parameterised queries should be the default everywhere.

**3. The SAS token generator parses the connection string with regex.**
`GenerateSasToken.js` extracts the account name and key from the connection string by matching `AccountName=` and `AccountKey=`. This is fragile if Azure changes the connection string format. Using `StorageConnectionString.parse()` or instantiating `BlobServiceClient.fromConnectionString()` is the idiomatic approach.

**4. No pagination on GetVideos.**
`GetVideos` fetches all records with `SELECT * FROM c`. A Cosmos DB container with thousands of videos would return them all in a single response. The `SearchVideos` endpoint has the same issue. Adding `OFFSET`/`LIMIT` parameters would be straightforward in Cosmos DB SQL.

**5. Replace the test placeholder with real tests.**
The CI pipeline runs `npm test`, which always passes. Azure Functions written with the v4 SDK can be unit-tested by importing the handler function directly and calling it with a mock `InvocationContext`. Even a handful of tests on the validation paths in `CreateVideo` and `GenerateSasToken` would catch regressions.

---

## Status

Built October–November 2024 for the Cloud Native Development module at Ulster University. Graded 76% (First Class). Maintained as a portfolio piece; the Azure deployment at `func-educationalvideohub` may not be active.

---

<!-- TODO: add screenshots -->
