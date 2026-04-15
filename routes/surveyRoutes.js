const express = require('express');
const router = express.Router();
const { 
  createSurvey, 
  getSurveys, 
  getSurveyStats 
} = require('../controllers/surveyController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createSurvey);
router.get('/', getSurveys);
router.get('/stats', getSurveyStats);

module.exports = router;
