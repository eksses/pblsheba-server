const supabase = require('../../utils/supabase');
const LogService = require('../../services/logService');
const CacheService = require('../../services/cacheService');

/**
 * Survey Controller
 * Handles data collection by staff members.
 */
const createSurvey = async (req, res) => {
  try {
    const {
      name,
      fathersName,
      wardNo,
      phone,
      farmAnimals,
      farmableLand,
      houseType,
      familyMembers,
      gender,
      childrenBoy,
      childrenGirl,
      monthlyIncome,
      memberId // Optional link to a registered member
    } = req.body;

    // 1. Basic Validation
    if (!name || !phone || !wardNo) {
      return res.status(400).json({ message: 'Name, Phone, and Ward No are required' });
    }

    // 2. Check for duplicate phone in surveys (unique constraint in schema)
    const { data: exists } = await supabase.from('Survey').select('id').eq('phone', phone).single();
    if (exists) {
      return res.status(400).json({ message: 'Survey already exists for this phone number' });
    }

    // 3. Insert Survey
    const { data: survey, error } = await supabase
      .from('Survey')
      .insert([{
        name,
        fathersName,
        wardNo,
        phone,
        farmAnimals,
        farmableLand,
        houseType,
        familyMembers: parseInt(familyMembers) || 0,
        gender,
        childrenBoy: parseInt(childrenBoy) || 0,
        childrenGirl: parseInt(childrenGirl) || 0,
        monthlyIncome: parseFloat(monthlyIncome) || 0,
        submittedById: req.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    // 4. Invalidate staff metrics cache
    await CacheService.clear(`metrics_${req.user.id}_employee`);

    await LogService.info(
      `New survey submitted by ${req.user.name} for ${name}`,
      'STAFF_SURVEY_SUBMISSION',
      null,
      { staffId: req.user.id, surveyId: survey.id }
    );

    res.status(201).json({ ...survey, _id: survey.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMyStats = async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('Survey')
      .select('*', { count: 'exact', head: true })
      .eq('submittedById', req.user.id);

    if (error) throw error;
    res.json({ totalSurveys: count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createSurvey, getMyStats };
