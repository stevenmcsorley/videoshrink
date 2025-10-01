-- CreateTable
CREATE TABLE "audio_extraction_jobs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "inputFile" TEXT NOT NULL,
    "outputFile" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "outputSize" INTEGER,
    "outputFormat" TEXT NOT NULL,
    "audioCodec" TEXT NOT NULL,
    "bitrate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "audio_extraction_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audio_extraction_jobs_userId_idx" ON "audio_extraction_jobs"("userId");

-- CreateIndex
CREATE INDEX "audio_extraction_jobs_status_idx" ON "audio_extraction_jobs"("status");

-- CreateIndex
CREATE INDEX "audio_extraction_jobs_createdAt_idx" ON "audio_extraction_jobs"("createdAt");
