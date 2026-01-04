# Educational Video Hub

## COM682 Cloud Native Development - CW2
**Student:** Cathal Flanagan (B00885008)  
**Ulster University** - 2024/25

---

## Overview

A cloud-native video platform built on Microsoft Azure that enables educators to upload, manage, and stream educational videos.

## Architecture

- **Azure Functions** - Serverless REST API
- **Azure Blob Storage** - Video file storage
- **Azure Cosmos DB** - NoSQL metadata database
- **Azure Logic Apps** - Workflow automation
- **Azure Video Indexer** - AI-powered video analysis
- **Application Insights** - Monitoring and telemetry

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/videos` | Get all videos |
| GET | `/api/videos/{id}` | Get video by ID |
| POST | `/api/videos` | Create video metadata |
| PUT | `/api/videos/{id}` | Update video |
| DELETE | `/api/videos/{id}` | Delete video |
| GET | `/api/videos/search` | Search videos |
| POST | `/api/upload/sas-token` | Get upload token |

## CI/CD

This project uses GitHub Actions for continuous integration and deployment. On every push to `main`, the code is automatically deployed to Azure Functions.

## Deployment

The application is deployed via GitHub Actions CI/CD pipeline to Azure Functions.
