const supabase = require('../../utils/supabase');
const LogService = require('../../services/logService');
const AuthService = require('../../services/authService');

/**
 * Profile Controller
 * Handles user-driven identity and security updates.
 */
const updateProfile = async (req, res) => {
  try {
    const updateData = {};
    
    // Only employees/owners can update their profile picture via this route for now
    if ((req.user.role === 'employee' || req.user.role === 'owner') && req.file) {
      updateData.imageUrl = req.file.path;
    }
    
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.email) updateData.email = req.body.email;
    if (req.body.address) updateData.address = req.body.address;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    const { data: updatedUser, error } = await supabase
      .from('User')
      .update({ ...updateData, updatedAt: new Date().toISOString() })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      message: 'Profile updated successfully', 
      user: { ...updatedUser, _id: updatedUser.id } 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const hashedPassword = await AuthService.hashPassword(newPassword);

    const { data: updatedUser, error } = await supabase
      .from('User')
      .update({
        password: hashedPassword,
        firstLogin: false,
        updatedAt: new Date().toISOString()
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    await LogService.info(
      `Password changed by user: ${updatedUser.name}`,
      'USER_CHANGE_PASSWORD',
      updatedUser.id
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { updateProfile, changePassword };
