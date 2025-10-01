-- CreateTable
CREATE TABLE "thumbnail_jobs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "inputFile" TEXT NOT NULL,
    "outputFiles" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "timestamps" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "width" INTEGER NOT NULL DEFAULT 320,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "thumbnail_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "thumbnail_jobs_userId_idx" ON "thumbnail_jobs"("userId");

-- CreateIndex
CREATE INDEX "thumbnail_jobs_status_idx" ON "thumbnail_jobs"("status");

-- CreateIndex
CREATE INDEX "thumbnail_jobs_createdAt_idx" ON "thumbnail_jobs"("createdAt");
