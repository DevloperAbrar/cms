-- CreateTable
CREATE TABLE "coordinator_branches" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinator_branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coordinator_branches_collegeId_userId_idx" ON "coordinator_branches"("collegeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "coordinator_branches_userId_branchId_year_key" ON "coordinator_branches"("userId", "branchId", "year");

-- AddForeignKey
ALTER TABLE "coordinator_branches" ADD CONSTRAINT "coordinator_branches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_branches" ADD CONSTRAINT "coordinator_branches_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
