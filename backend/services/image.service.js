const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const QUIZ_UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads', 'quiz');

// Ensure directory exists on startup
if (!fs.existsSync(QUIZ_UPLOAD_DIR)) {
  fs.mkdirSync(QUIZ_UPLOAD_DIR, { recursive: true });
}

/**
 * Compresses and saves an uploaded quiz image.
 * @param {Buffer} buffer - Raw file buffer from multer memoryStorage
 * @param {string} questionId - Used in filename
 * @returns {string} Relative path stored in DB: /uploads/quiz/filename.webp
 */
const saveQuizImage = async (buffer, questionId) => {
  const filename = `${questionId}_${Date.now()}.webp`;
  const outputPath = path.join(QUIZ_UPLOAD_DIR, filename);

  await sharp(buffer)
    .webp({ quality: 80 })
    .toFile(outputPath);

  logger.debug(`Quiz image saved: ${filename}`);
  return `/uploads/quiz/${filename}`;
};

/**
 * Deletes a quiz image from disk.
 * @param {string} imagePath - Stored path like /uploads/quiz/filename.webp
 */
const deleteQuizImage = (imagePath) => {
  if (!imagePath) return;
  try {
    const fullPath = path.resolve(process.env.UPLOAD_DIR || './uploads', imagePath.replace('/uploads/', ''));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.debug(`Quiz image deleted: ${imagePath}`);
    }
  } catch (err) {
    logger.error(`Failed to delete quiz image ${imagePath}: ${err.message}`);
  }
};

module.exports = { saveQuizImage, deleteQuizImage };