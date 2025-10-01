-- CreateTable
CREATE TABLE "trim_jobs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "inputFile" TEXT NOT NULL,
    "outputFile" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "outputSize" INTEGER,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "lossless" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "trim_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gif_jobs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "inputFile" TEXT NOT NULL,
    "outputFile" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "outputSize" INTEGER,
    "startTime" TEXT NOT NULL DEFAULT '0',
    "endTime" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "fps" INTEGER NOT NULL DEFAULT 10,
    "width" INTEGER NOT NULL DEFAULT 480,
    "optimize" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "gif_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trim_jobs_userId_idx" ON "trim_jobs"("userId");

-- CreateIndex
CREATE INDEX "trim_jobs_status_idx" ON "trim_jobs"("status");

-- CreateIndex
CREATE INDEX "trim_jobs_createdAt_idx" ON "trim_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "gif_jobs_userId_idx" ON "gif_jobs"("userId");

-- CreateIndex
CREATE INDEX "gif_jobs_status_idx" ON "gif_jobs"("status");

-- CreateIndex
CREATE INDEX "gif_jobs_createdAt_idx" ON "gif_jobs"("createdAt");
