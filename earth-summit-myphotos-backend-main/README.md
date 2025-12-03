# MyPhotos

A modern photo management system with AI-powered face recognition and similarity search, built with Next.js, PostgreSQL with pgvector, and InsightFace.

## Features

- **Photo Upload**: Single and bulk photo upload with photographer attribution
- **AWS S3 Storage**: Private S3 bucket storage with server-side proxy for secure image access
- **Face Recognition**: Automatic face detection and embedding extraction using InsightFace
- **Similarity Search**: Find visually similar photos using vector similarity (pgvector)
- **Photographer Organization**: Photos organized by photographer in both UI and S3 storage
- **Modern UI**: Built with shadcn/ui components, featuring upload progress and photographer folders
- **Pagination**: Efficient photo browsing with pagination support

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js Server Actions
- **Database**: PostgreSQL 16 with pgvector extension
- **Storage**: AWS S3 (private bucket)
- **ML Service**: Python FastAPI service with InsightFace for face embeddings
- **ORM**: Prisma
- **Containerization**: Docker Compose

## Architecture

The application consists of three main services:

1. **Next.js App** (`app`): Main web application serving the UI and API routes
2. **PostgreSQL** (`postgres`): Database with pgvector for storing photos and 512-dimensional face embeddings
3. **Embedding Service** (`embedding-service`): Python FastAPI service for face detection and embedding extraction

## Prerequisites

- Docker and Docker Compose
- pnpm (package manager)
- AWS S3 Bucket

## Setup

1. Clone the repository:
```bash
git clone git@github.com:voriq-ai/myphotos.git
cd myphotos
```

2. Create `.env.local` file with your Azure credentials:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myphotos"
AWS_REGION="ap-south-1"
AWS_ACCESS_KEY_ID="your_access_key"
AWS_SECRET_ACCESS_KEY="your_secret_key"
AWS_S3_BUCKET="myphotos"
EMBEDDING_SERVICE_URL="http://localhost:8000"
```

3. Start all services with Docker Compose:
```bash
docker compose up --build
```

This will start:
- PostgreSQL on port 5432
- Embedding service on port 8000
- Next.js app on port 3000

4. Access the application at [http://localhost:3000](http://localhost:3000)

## Development

### Running without Docker

1. Start PostgreSQL:
```bash
docker compose up postgres -d
```

2. Start the embedding service:
```bash
docker compose up embedding-service -d
```

3. Install dependencies and run the app:
```bash
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate dev
pnpm dev
```

### Database Management

Run Prisma Studio to view/edit database:
```bash
pnpm exec prisma studio
```

Reset database:
```bash
pnpm exec prisma migrate reset
```

## Project Structure

```
myphotos/
├── src/
│   ├── actions/          # Server actions for photo operations
│   ├── app/             # Next.js app router pages and API routes
│   ├── components/      # React components (UI and features)
│   └── lib/             # Utility libraries (Azure, embeddings, Prisma)
├── embedding-service/   # Python FastAPI service for face embeddings
│   ├── app.py          # Main FastAPI application
│   ├── requirements.txt # Python dependencies
│   └── Dockerfile      # Docker configuration
├── prisma/             # Database schema and migrations
└── docker-compose.yml  # Multi-service Docker configuration
```

## How It Works

### Photo Upload Flow

1. User uploads photo(s) with optional photographer name
2. Photo is uploaded to AWS S3 in photographer-specific folder (e.g., `john_doe/photo-uuid.jpg`)
3. Photo metadata is saved to PostgreSQL
4. Photo is sent to embedding service for face detection
5. InsightFace extracts 512-dimensional face embedding
6. If no face detected, fallback to dummy embedding
7. Embedding is stored in PostgreSQL using pgvector

### Similarity Search Flow

1. User uploads a search photo
2. Embedding service extracts face embedding
3. PostgreSQL queries similar photos using cosine distance (`<->` operator)
4. Results ranked by similarity score and returned

### Image Access

Photos are stored in a private S3 bucket and accessed via a Next.js API proxy route (`/api/image/[photoId]`), ensuring secure access control.

## Deployment

For detailed instructions on deploying to AWS, please refer to [AWS_DEPLOYMENT_GUIDE.md](AWS_DEPLOYMENT_GUIDE.md).

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/myphotos` |
| `AWS_REGION` | AWS Region | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | AWS Access Key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Key | `wJalr...` |
| `AWS_S3_BUCKET` | AWS S3 Bucket Name | `myphotos` |
| `EMBEDDING_SERVICE_URL` | URL of embedding service | `http://localhost:8000` |

## License

MIT
