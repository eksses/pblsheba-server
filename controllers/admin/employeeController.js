const supabase = require('../../utils/supabase');
const LogService = require('../../services/logService');
const CacheService = require('../../services/cacheService');
const AuthService = require('../../services/authService');

/**
 * Employee Controller
 * Handles CRUD operations for employees within the admin domain.
 */
const createEmployee = async (req, res) => {
  try {
    const { name, phone, password, nid, email, fatherName, address, dob } = req.body;

    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can create employees' });
    }

    const { data: exists } = await supabase.from('User').select('id').eq('phone', phone).single();
    if (exists) return res.status(400).json({ message: 'Phone already in use' });

    const hashedPassword = await AuthService.hashPassword(password);
    const employeeId = require('crypto').randomUUID();

    const { data: employee, error } = await supabase
      .from('User')
      .insert([{
        id: employeeId,
        name,
        phone,
        password: hashedPassword,
        nid,
        email,
        imageUrl: req.file ? req.file.path : null,
        fatherName: fatherName || 'N/A',
        address,
        role: 'employee',
        status: 'approved',
        firstLogin: true,
        dob: dob ? new Date(dob).toISOString() : new Date('1990-01-01').toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    await CacheService.clear(`metrics_${req.user.id}_${req.user.role}`);
    res.status(201).json({ ...employee, _id: employee.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEmployees = async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });
    const { data: employees, error } = await supabase
      .from('User')
      .select('id, name, phone, email, status, role, createdAt')
      .eq('role', 'employee');

    if (error) throw error;
    res.json(employees.map(e => ({ ...e, _id: e.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });

    const { data: user } = await supabase.from('User').select('name, phone').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ message: 'Employee not found' });

    const { error } = await supabase.from('User').delete().eq('id', req.params.id).eq('role', 'employee');
    if (error) throw error;

    await LogService.warn(
      `Employee deleted by owner: ${user.name} (${user.phone})`,
      'ADMIN_DELETE_EMPLOYEE',
      null,
      { adminId: req.user.id, deletedEmployeeId: req.params.id }
    );

    res.json({ message: 'Employee removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createEmployee, getEmployees, deleteEmployee };
