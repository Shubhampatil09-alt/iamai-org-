/*
  Warnings:

  - Added the required column `bbox` to the `face_embeddings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `confidence` to the `face_embeddings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `faceId` to the `face_embeddings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "face_embeddings" ADD COLUMN     "bbox" JSONB NOT NULL,
ADD COLUMN     "confidence" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "faceId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "face_embeddings_faceId_idx" ON "face_embeddings"("faceId");
