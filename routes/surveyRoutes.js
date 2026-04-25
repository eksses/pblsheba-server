const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/survey/surveyController');
const { protect } = require('../middleware/authMiddleware');

const validate = require('../middleware/validateMiddleware');
const { surveySchema } = require('../utils/schemas');

/**
 * Survey Routes Orchestrator
 * Handles protected socio-economic data submissions and reporting.
 */
router.use(protect);

router.post('/', validate(surveySchema), surveyController.createSurvey);
router.get('/', surveyController.getSurveys);
router.get('/stats', surveyController.getSurveyStats);

module.exports = router;
