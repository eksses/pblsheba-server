const supabase = require('../utils/supabase');
const SystemLog = require('../models/SystemLog');

// @desc    Submit a new survey
// @route   POST /api/surveys
// @access  Private (Owner/Employee/Member)
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

    const now = new Date().toISOString();

    const { data: survey, error } = await supabase
      .from('Survey')
      .insert([
        {
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
          createdAt: now,
          updatedAt: now
        }
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ message: 'A survey with this phone number already exists.' });
      }
      throw error;
    }

    // Log the submission if it's an employee or owner
    if (req.user.role !== 'member') {
      await SystemLog.create({
        level: 'info',
        message: `Survey submitted by ${req.user.name} for ${name}`,
        action: 'SURVEY_SUBMIT',
        userId: req.user.id,
        metadata: { surveyId: survey.id }
      });
    }

    res.status(201).json(survey);
  } catch (error) {
    console.error('Survey create error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all surveys with filtering
// @route   GET /api/surveys
// @access  Private (Owner)
const getSurveys = async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can access all surveys.' });
    }

    let query = supabase
      .from('Survey')
      .select('*, submittedBy:User(name, phone)')
      .order('createdAt', { ascending: false });

    // Filter by employee if provided
    if (req.query.employeeId) {
      query = query.eq('submittedById', req.query.employeeId);
    }

    const { data: surveys, error } = await query;

    if (error) throw error;
    res.json(surveys);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get survey stats (surveys count per employee)
// @route   GET /api/surveys/stats
// @access  Private (Owner)
const getSurveyStats = async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Get all employees and their survey counts
    const { data: employees, error: empError } = await supabase
      .from('User')
      .select('id, name, role')
      .in('role', ['employee', 'owner']);

    if (empError) throw empError;

    const stats = await Promise.all(employees.map(async (emp) => {
      const { count, error: countError } = await supabase
        .from('Survey')
        .select('*', { count: 'exact', head: true })
        .eq('submittedById', emp.id);
      
      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        count: count || 0
      };
    }));

    res.json(stats.sort((a, b) => b.count - a.count));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createSurvey,
  getSurveys,
  getSurveyStats
};
