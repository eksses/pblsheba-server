const db = require('../../utils/db');
const LogService = require('../../services/logService');

/**
 * Survey Controller
 * Handles socio-economic data collection and analytics.
 */
const createSurvey = async (req, res) => {
  try {
    const {
      name, fathersName, wardNo, farmAnimals, farmableLand,
      houseType, familyMembers, gender, childrenBoy,
      childrenGirl, monthlyIncome, phone
    } = req.body;

    if (!name || !phone || !wardNo) {
      return res.status(400).json({ message: 'Name, Phone, and Ward No are required.' });
    }

    const { data: survey, error } = await db
      .from('Survey')
      .insert([{
        id: require('crypto').randomUUID(),
        name,
        fathersName: fathersName || 'N/A',
        wardNo,
        farmAnimals,
        farmableLand,
        houseType,
        familyMembers: parseInt(familyMembers) || 0,
        gender,
        childrenBoy: parseInt(childrenBoy) || 0,
        childrenGirl: parseInt(childrenGirl) || 0,
        monthlyIncome: parseFloat(monthlyIncome) || 0,
        phone,
        submittedById: req.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ message: 'A survey with this phone number already exists.' });
      }
      throw error;
    }

    if (req.user.role !== 'member') {
      await LogService.info(
        `Survey submitted by ${req.user.name} for ${name}`,
        'SURVEY_SUBMIT',
        req.user.id,
        { surveyId: survey.id }
      );
    }

    res.status(201).json({ ...survey, _id: survey.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSurveys = async (req, res) => {
  try {
    if (req.user.role !== 'owner' && req.user.role !== 'employee') {
      return res.status(403).json({ message: 'Unauthorized access.' });
    }

    let query = db
      .from('Survey')
      .select('*, submittedBy:User(name, phone)')
      .order('createdAt', { ascending: false });

    if (req.user.role === 'employee') {
      query = query.eq('submittedById', req.user.id);
    } else if (req.query.employeeId) {
      query = query.eq('submittedById', req.query.employeeId);
    }

    const { data: surveys, error } = await query;
    if (error) throw error;
    
    res.json(surveys.map(s => ({ ...s, _id: s.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const neon = require('../../utils/neon');

const getSurveyStats = async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const result = await neon.pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.role, 
        COUNT(s.id)::int AS count
      FROM "User" u
      LEFT JOIN "Survey" s ON s."submittedById" = u.id
      WHERE u.role IN ('employee', 'owner')
      GROUP BY u.id, u.name, u.role
      ORDER BY count DESC;
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createSurvey, getSurveys, getSurveyStats };
