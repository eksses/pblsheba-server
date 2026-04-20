const supabase = require('../utils/supabase');
const SystemLog = require('../models/SystemLog');




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

    
    if (req.user.role !== 'member') {
      await SystemLog.create({
        level: 'info',
        message: `Survey submitted by ${req.user.name} for ${name}`,
        action: 'SURVEY_SUBMIT',
        userId: req.user.id,
        metadata: { surveyId: survey.id }
      });
    }

    res.status(201).json({ ...survey, _id: survey.id });
  } catch (error) {
    console.error('Survey create error:', error);
    res.status(500).json({ message: error.message });
  }
};




const getSurveys = async (req, res) => {
  try {
    if (req.user.role !== 'owner' && req.user.role !== 'employee') {
      return res.status(403).json({ message: 'Unauthorized access.' });
    }

    let query = supabase
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




const getSurveyStats = async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    
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
