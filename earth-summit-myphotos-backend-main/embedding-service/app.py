from mangum import Mangum
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import insightface
from insightface.app import FaceAnalysis
import numpy as np
import cv2
import io
from typing import List
from PIL import Image
import boto3
import requests
from urllib.parse import urlparse

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize InsightFace with optimized settings
# Use /app/.insightface where models were downloaded during Docker build
face_app = FaceAnalysis(
    providers=['CPUExecutionProvider'],
    allowed_modules=['detection', 'recognition'],
    root='/app/.insightface'
)
face_app.prepare(ctx_id=0, det_size=(640, 640), det_thresh=0.5)

# Initialize S3 client
s3_client = boto3.client('s3')

class ImageURLRequest(BaseModel):
    image_url: str

def download_image_from_url(url: str) -> np.ndarray:
    """Download image from presigned S3 URL or HTTP URL"""
    parsed = urlparse(url)

    # Check if it's a presigned URL (has query parameters) or regular HTTP URL
    # Presigned URLs already contain auth, so use requests
    if parsed.query or 'http' in parsed.scheme:
        # Download from HTTP/HTTPS URL (including presigned S3 URLs)
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        image_bytes = response.content
    elif 's3.amazonaws.com' in parsed.netloc or 's3.' in parsed.netloc:
        # Regular S3 URL without presigning - use boto3
        # Format: https://bucket.s3.region.amazonaws.com/key or https://s3.region.amazonaws.com/bucket/key
        if parsed.netloc.startswith('s3.'):
            # Format: https://s3.region.amazonaws.com/bucket/key
            path_parts = parsed.path.lstrip('/').split('/', 1)
            bucket = path_parts[0]
            key = path_parts[1] if len(path_parts) > 1 else ''
        else:
            # Format: https://bucket.s3.region.amazonaws.com/key
            bucket = parsed.netloc.split('.')[0]
            key = parsed.path.lstrip('/')

        # Download from S3
        response = s3_client.get_object(Bucket=bucket, Key=key)
        image_bytes = response['Body'].read()
    else:
        raise ValueError(f"Unsupported URL format: {url}")

    # Convert to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Invalid image")

    return img

def preprocess_image(img):
    """Preprocess image for better face detection"""
    # Convert to RGB if needed
    if len(img.shape) == 3 and img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Enhance contrast using CLAHE
    if len(img.shape) == 3:
        lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        lab[:, :, 0] = clahe.apply(lab[:, :, 0])
        img = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

    # Resize if too large (keep aspect ratio)
    height, width = img.shape[:2]
    max_size = 1024
    if max(height, width) > max_size:
        scale = max_size / max(height, width)
        new_width = int(width * scale)
        new_height = int(height * scale)
        img = cv2.resize(img, (new_width, new_height),
                         interpolation=cv2.INTER_LANCZOS4)

    # Convert back to BGR for InsightFace
    if len(img.shape) == 3:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    return img


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/extract-embedding")
async def extract_embedding(file: UploadFile = File(...)):
    try:
        # Read image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        # Preprocess image for better detection
        img = preprocess_image(img)

        # Detect faces and extract embeddings
        faces = face_app.get(img)

        if len(faces) == 0:
            raise HTTPException(status_code=404, detail="No faces detected")

        # Return all detected faces and their embeddings
        face_data = []
        for i, face in enumerate(faces):
            face_data.append(
                {
                    "face_id": i,
                    "embedding": face.embedding.tolist(),
                    "bbox": face.bbox.tolist(),
                    "confidence": float(face.det_score)
                    if hasattr(face, "det_score")
                    else 1.0,
                }
            )

        return {
            "faces": face_data,
            "num_faces": len(faces),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing image: {str(e)}")


@app.post("/extract-embedding-from-url")
async def extract_embedding_from_url(request: ImageURLRequest):
    try:
        # Download image from URL
        img = download_image_from_url(request.image_url)

        # Preprocess image for better detection
        img = preprocess_image(img)

        # Detect faces and extract embeddings
        faces = face_app.get(img)

        if len(faces) == 0:
            raise HTTPException(status_code=404, detail="No faces detected")

        # Return all detected faces and their embeddings
        face_data = []
        for i, face in enumerate(faces):
            face_data.append(
                {
                    "face_id": i,
                    "embedding": face.embedding.tolist(),
                    "bbox": face.bbox.tolist(),
                    "confidence": float(face.det_score)
                    if hasattr(face, "det_score")
                    else 1.0,
                }
            )

        return {
            "faces": face_data,
            "num_faces": len(faces),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing image: {str(e)}")


@app.post("/extract-embeddings-batch")
async def extract_embeddings_batch(files: List[UploadFile] = File(...)):
    results = []

    for file in files:
        try:
            contents = await file.read()
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                results.append(
                    {
                        "filename": file.filename,
                        "success": False,
                        "error": "Invalid image",
                    }
                )
                continue

            # Preprocess image for better detection
            img = preprocess_image(img)

            faces = face_app.get(img)

            if len(faces) == 0:
                results.append(
                    {
                        "filename": file.filename,
                        "success": False,
                        "error": "No faces detected",
                    }
                )
                continue

            embedding = faces[0].embedding.tolist()

            results.append(
                {
                    "filename": file.filename,
                    "success": True,
                    "embedding": embedding,
                    "num_faces": len(faces),
                }
            )

        except Exception as e:
            results.append(
                {"filename": file.filename, "success": False, "error": str(e)}
            )

    return {"results": results}

handler = Mangum(app, lifespan="off")

if __name__ == "__main__":
    import uvicorn
    import os

    # Auto-detect CPU cores and use all cores minus 2 (reserve for system)
    # Falls back to env var if set, otherwise uses CPU detection
    workers = 2

    print(f"Starting embedding service with {workers} workers")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, workers=workers)
