const mongoose = require('mongoose');
const { ROLES, USER_STATUS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    // Department reference (hod, coordinator, faculty, student)
    department_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    // Branch reference (student)
    branch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    // Student-specific fields
    year: {
      type: Number,
      min: 1,
      max: 6,
      default: null,
    },
    enrollment_number: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      // no default — field simply won't exist for non-students
    },
    section: {
      type: String,
      trim: true,
      default: null,
    },
    // Coordinator: can manage multiple branches
    coordinator_branches: [
      {
        branch_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Branch',
        },
        year: {
          type: Number,
          min: 1,
          max: 6,
        },
      },
    ],
    // Google OAuth
    google_id: {
      type: String,
      default: null,
    },
    // Phone (optional)
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    // Semester (student)
    semester: {
      type: Number,
      default: null,
    },
    last_login: {
      type: Date,
      default: null,
    },
    last_login_ip: {
      type: String,
      default: null,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Compound indexes
userSchema.index({ email: 1, role: 1, status: 1 });
userSchema.index({ department_id: 1, role: 1 });
userSchema.index({ branch_id: 1, year: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);