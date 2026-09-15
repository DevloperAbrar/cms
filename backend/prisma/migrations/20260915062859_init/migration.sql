-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'grace', 'expired', 'suspended');

-- CreateEnum
CREATE TYPE "CollegeLifecycle" AS ENUM ('active', 'soft_deleted', 'purged');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('upcoming', 'active', 'closed');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('superadmin', 'examcontroller', 'hod', 'coordinator', 'faculty', 'student', 'parent');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'deleted');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('active', 'promoted', 'repeated', 'graduated', 'dropped');

-- CreateTable
CREATE TABLE "colleges" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'standard',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'trial',
    "subscriptionStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriptionEnd" TIMESTAMP(3) NOT NULL,
    "lastRenewedAt" TIMESTAMP(3),
    "graceDays" INTEGER NOT NULL DEFAULT 7,
    "lifecycleStatus" "CollegeLifecycle" NOT NULL DEFAULT 'active',
    "deletedAt" TIMESTAMP(3),
    "deleteRequestedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colleges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_sessions" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'upcoming',
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "departmentId" TEXT,
    "branchId" TEXT,
    "year" INTEGER,
    "enrollmentNumber" TEXT,
    "section" TEXT,
    "googleId" TEXT,
    "phone" TEXT,
    "semester" INTEGER,
    "lastLogin" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_year_history" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER,
    "section" TEXT,
    "status" "PromotionStatus" NOT NULL DEFAULT 'active',
    "promotedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_year_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streams" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'theory',
    "credits" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assignedFacultyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_patterns" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "forceUnlockBy" TEXT,
    "sgpaFormula" TEXT NOT NULL DEFAULT 'weighted_average',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_pattern_components" (
    "id" TEXT NOT NULL,
    "examPatternId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "weightagePercent" DOUBLE PRECISION NOT NULL,
    "enteredBy" TEXT NOT NULL,
    "includeInSgpa" BOOLEAN NOT NULL DEFAULT true,
    "passMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "exam_pattern_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marks_components" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "examComponentId" TEXT NOT NULL,
    "structureLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marks_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marks_subfields" (
    "id" TEXT NOT NULL,
    "marksComponentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "marks_subfields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marks" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "examComponentId" TEXT NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "submittedById" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marks_subfield_entries" (
    "id" TEXT NOT NULL,
    "marksId" TEXT NOT NULL,
    "subFieldId" TEXT NOT NULL,
    "marksObtained" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "marks_subfield_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marks_history" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "marksId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "previousValues" JSONB NOT NULL,
    "newValues" JSONB NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marks_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "slot" TEXT,
    "status" TEXT NOT NULL,
    "markedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_attendance" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "markedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetables" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "section" TEXT,
    "semester" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" TEXT NOT NULL,
    "timetableId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "room" TEXT,
    "isLab" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "negativeMarking" BOOLEAN NOT NULL DEFAULT false,
    "negativeValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
    "attemptsAllowed" INTEGER NOT NULL DEFAULT 1,
    "resultVisibility" TEXT NOT NULL DEFAULT 'immediate',
    "resultPublishMode" TEXT NOT NULL DEFAULT 'none',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imagePath" TEXT,
    "type" TEXT NOT NULL DEFAULT 'single',
    "marks" DOUBLE PRECISION NOT NULL,
    "negativeMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT,
    "imagePath" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "quiz_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "isAutoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionIds" TEXT[],

    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "postedById" TEXT,
    "targetType" TEXT NOT NULL,
    "targetIds" TEXT[],
    "scheduleAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "readBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_tokens" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parent_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_result_configs" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "maxValue" DOUBLE PRECISION NOT NULL,
    "passingValue" DOUBLE PRECISION NOT NULL,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "final_result_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_results" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "final_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colleges_code_key" ON "colleges"("code");

-- CreateIndex
CREATE INDEX "colleges_subscriptionStatus_idx" ON "colleges"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "colleges_lifecycleStatus_idx" ON "colleges"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "subscription_events_collegeId_createdAt_idx" ON "subscription_events"("collegeId", "createdAt");

-- CreateIndex
CREATE INDEX "academic_sessions_collegeId_isCurrent_idx" ON "academic_sessions"("collegeId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "academic_sessions_collegeId_label_key" ON "academic_sessions"("collegeId", "label");

-- CreateIndex
CREATE INDEX "users_collegeId_role_status_idx" ON "users"("collegeId", "role", "status");

-- CreateIndex
CREATE INDEX "users_collegeId_departmentId_role_idx" ON "users"("collegeId", "departmentId", "role");

-- CreateIndex
CREATE INDEX "users_collegeId_branchId_year_role_idx" ON "users"("collegeId", "branchId", "year", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_collegeId_email_key" ON "users"("collegeId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_collegeId_enrollmentNumber_key" ON "users"("collegeId", "enrollmentNumber");

-- CreateIndex
CREATE INDEX "student_year_history_collegeId_academicSessionId_branchId_y_idx" ON "student_year_history"("collegeId", "academicSessionId", "branchId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "student_year_history_studentId_academicSessionId_key" ON "student_year_history"("studentId", "academicSessionId");

-- CreateIndex
CREATE INDEX "streams_collegeId_status_idx" ON "streams"("collegeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "streams_collegeId_code_key" ON "streams"("collegeId", "code");

-- CreateIndex
CREATE INDEX "departments_collegeId_streamId_idx" ON "departments"("collegeId", "streamId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_collegeId_code_key" ON "departments"("collegeId", "code");

-- CreateIndex
CREATE INDEX "branches_collegeId_departmentId_idx" ON "branches"("collegeId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_collegeId_code_key" ON "branches"("collegeId", "code");

-- CreateIndex
CREATE INDEX "subjects_collegeId_branchId_year_semester_idx" ON "subjects"("collegeId", "branchId", "year", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_collegeId_code_key" ON "subjects"("collegeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "exam_patterns_collegeId_streamId_year_semester_key" ON "exam_patterns"("collegeId", "streamId", "year", "semester");

-- CreateIndex
CREATE INDEX "exam_pattern_components_examPatternId_idx" ON "exam_pattern_components"("examPatternId");

-- CreateIndex
CREATE INDEX "marks_components_collegeId_academicSessionId_branchId_idx" ON "marks_components"("collegeId", "academicSessionId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "marks_components_facultyId_subjectId_branchId_academicSessi_key" ON "marks_components"("facultyId", "subjectId", "branchId", "academicSessionId", "examComponentId");

-- CreateIndex
CREATE INDEX "marks_subfields_marksComponentId_idx" ON "marks_subfields"("marksComponentId");

-- CreateIndex
CREATE INDEX "marks_collegeId_branchId_academicSessionId_year_semester_idx" ON "marks"("collegeId", "branchId", "academicSessionId", "year", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "marks_studentId_subjectId_examComponentId_academicSessionId_key" ON "marks"("studentId", "subjectId", "examComponentId", "academicSessionId");

-- CreateIndex
CREATE INDEX "marks_subfield_entries_marksId_idx" ON "marks_subfield_entries"("marksId");

-- CreateIndex
CREATE INDEX "marks_history_marksId_changedAt_idx" ON "marks_history"("marksId", "changedAt");

-- CreateIndex
CREATE INDEX "attendance_collegeId_branchId_subjectId_date_idx" ON "attendance"("collegeId", "branchId", "subjectId", "date");

-- CreateIndex
CREATE INDEX "attendance_collegeId_academicSessionId_branchId_year_idx" ON "attendance"("collegeId", "academicSessionId", "branchId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_studentId_subjectId_date_key" ON "attendance"("studentId", "subjectId", "date");

-- CreateIndex
CREATE INDEX "faculty_attendance_collegeId_departmentId_date_idx" ON "faculty_attendance"("collegeId", "departmentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_attendance_facultyId_date_key" ON "faculty_attendance"("facultyId", "date");

-- CreateIndex
CREATE INDEX "timetables_collegeId_branchId_academicSessionId_year_semest_idx" ON "timetables"("collegeId", "branchId", "academicSessionId", "year", "semester");

-- CreateIndex
CREATE INDEX "timetable_slots_timetableId_idx" ON "timetable_slots"("timetableId");

-- CreateIndex
CREATE INDEX "quizzes_collegeId_branchId_academicSessionId_year_startTime_idx" ON "quizzes"("collegeId", "branchId", "academicSessionId", "year", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "quizzes_collegeId_createdById_status_idx" ON "quizzes"("collegeId", "createdById", "status");

-- CreateIndex
CREATE INDEX "quiz_questions_quizId_idx" ON "quiz_questions"("quizId");

-- CreateIndex
CREATE INDEX "quiz_options_questionId_idx" ON "quiz_options"("questionId");

-- CreateIndex
CREATE INDEX "quiz_attempts_quizId_studentId_idx" ON "quiz_attempts"("quizId", "studentId");

-- CreateIndex
CREATE INDEX "quiz_answers_attemptId_idx" ON "quiz_answers"("attemptId");

-- CreateIndex
CREATE INDEX "notices_collegeId_expiresAt_idx" ON "notices"("collegeId", "expiresAt");

-- CreateIndex
CREATE INDEX "notices_collegeId_postedById_createdAt_idx" ON "notices"("collegeId", "postedById", "createdAt");

-- CreateIndex
CREATE INDEX "messages_collegeId_senderId_recipientId_createdAt_idx" ON "messages"("collegeId", "senderId", "recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_collegeId_recipientId_readAt_idx" ON "messages"("collegeId", "recipientId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "parent_tokens_token_key" ON "parent_tokens"("token");

-- CreateIndex
CREATE INDEX "parent_tokens_collegeId_studentId_idx" ON "parent_tokens"("collegeId", "studentId");

-- CreateIndex
CREATE INDEX "final_result_configs_collegeId_academicSessionId_year_semes_idx" ON "final_result_configs"("collegeId", "academicSessionId", "year", "semester", "metricType");

-- CreateIndex
CREATE INDEX "final_results_collegeId_branchId_year_semester_idx" ON "final_results"("collegeId", "branchId", "year", "semester");

-- CreateIndex
CREATE INDEX "final_results_collegeId_departmentId_year_semester_idx" ON "final_results"("collegeId", "departmentId", "year", "semester");

-- CreateIndex
CREATE INDEX "final_results_configId_isPublished_idx" ON "final_results"("configId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "final_results_configId_studentId_key" ON "final_results"("configId", "studentId");

-- CreateIndex
CREATE INDEX "audit_logs_collegeId_actorId_createdAt_idx" ON "audit_logs"("collegeId", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_collegeId_resourceType_createdAt_idx" ON "audit_logs"("collegeId", "resourceType", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_collegeId_action_createdAt_idx" ON "audit_logs"("collegeId", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_sessions" ADD CONSTRAINT "academic_sessions_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_year_history" ADD CONSTRAINT "student_year_history_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_year_history" ADD CONSTRAINT "student_year_history_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_patterns" ADD CONSTRAINT "exam_patterns_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_pattern_components" ADD CONSTRAINT "exam_pattern_components_examPatternId_fkey" FOREIGN KEY ("examPatternId") REFERENCES "exam_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks_subfields" ADD CONSTRAINT "marks_subfields_marksComponentId_fkey" FOREIGN KEY ("marksComponentId") REFERENCES "marks_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks_subfield_entries" ADD CONSTRAINT "marks_subfield_entries_marksId_fkey" FOREIGN KEY ("marksId") REFERENCES "marks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks_history" ADD CONSTRAINT "marks_history_marksId_fkey" FOREIGN KEY ("marksId") REFERENCES "marks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "timetables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_options" ADD CONSTRAINT "quiz_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "quiz_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_configId_fkey" FOREIGN KEY ("configId") REFERENCES "final_result_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
