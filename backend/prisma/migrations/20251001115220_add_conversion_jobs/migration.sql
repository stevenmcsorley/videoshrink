-- CreateTable
CREATE TABLE "conversion_jobs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "inputFile" TEXT NOT NULL,
    "outputFile" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "outputSize" INTEGER,
    "fromFormat" TEXT NOT NULL,
    "toFormat" TEXT NOT NULL,
    "preset" TEXT,
    "videoCodec" TEXT,
    "audioCodec" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "conversion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversion_jobs_userId_idx" ON "conversion_jobs"("userId");

-- CreateIndex
CREATE INDEX "conversion_jobs_status_idx" ON "conversion_jobs"("status");

-- CreateIndex
CREATE INDEX "conversion_jobs_createdAt_idx" ON "conversion_jobs"("createdAt");
