-- CreateTable
CREATE TABLE "frame_extraction_jobs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "inputFile" TEXT NOT NULL,
    "outputFiles" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "outputFormat" TEXT NOT NULL,
    "fps" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "startTime" TEXT NOT NULL DEFAULT '0',
    "endTime" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "estimatedFrames" INTEGER NOT NULL,
    "frameCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "frame_extraction_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "frame_extraction_jobs_userId_idx" ON "frame_extraction_jobs"("userId");

-- CreateIndex
CREATE INDEX "frame_extraction_jobs_status_idx" ON "frame_extraction_jobs"("status");

-- CreateIndex
CREATE INDEX "frame_extraction_jobs_createdAt_idx" ON "frame_extraction_jobs"("createdAt");
