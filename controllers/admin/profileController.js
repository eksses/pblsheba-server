const supabase = require('../../utils/supabase');
const LogService = require('../../services/logService');
const AuthService = require('../../services/authService');

/**
 * Admin Profile Controller
 * Handles administrative self-management actions (Staff/Owner profiles).
 */

const updateProfileImage = async (req, res) => {
  console.log('Update Profile Image Hit');
  console.log('Request Headers:', req.headers['content-type']);
  console.log('Request File:', req.file);
  console.log('Request Body:', req.body);

  try {
    if (!req.file) {
      console.error('Validation Failed: No image file in request.');
      return res.status(400).json({ 
        message: 'No image file provided',
        hint: 'Ensure you are sending the file in a field named "image" as multipart/form-data'
      });
    }

    const imageUrl = req.file.path;

    const { data: updatedUser, error } = await supabase
      .from('User')
      .update({ 
        imageUrl, 
        updatedAt: new Date().toISOString() 
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    await LogService.info(
      `Admin profile image updated by: ${updatedUser.name}`,
      'ADMIN_UPDATE_PHOTO',
      updatedUser.id
    );

    res.json({ 
      message: 'Profile image updated successfully', 
      imageUrl,
      user: { ...updatedUser, _id: updatedUser.id } 
    });
  } catch (error) {
    console.error('Update Profile Image Error:', error);
    res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Fetch user to verify current password
    const { data: user, error: fetchError } = await supabase
      .from('User')
      .select('password, name')
      .eq('id', req.user.id)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    if (currentPassword) {
      const isMatch = await AuthService.comparePasswords(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid current password' });
      }
    }

    const hashedPassword = await AuthService.hashPassword(newPassword);

    const { error: updateError } = await supabase
      .from('User')
      .update({
        password: hashedPassword,
        firstLogin: false,
        updatedAt: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    await LogService.warn(
      `Admin password changed for: ${user.name}`,
      'ADMIN_CHANGE_PASSWORD',
      req.user.id
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  updateProfileImage, 
  changePassword 
};
