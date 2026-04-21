const supabase = require('../../utils/supabase');
const LogService = require('../../services/logService');

/**
 * Request Controller
 * Handles user inquiries and administrative requests (e.g., edit requests).
 */
const requestEdit = async (req, res) => {
  try {
    const { requestedChanges } = req.body;

    const { data: updatedUser, error } = await supabase
      .from('User')
      .update({
        editRequestPending: true,
        editRequestedChanges: requestedChanges,
        editApproved: false,
        updatedAt: new Date().toISOString()
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    await LogService.info(
      `Profile edit requested by ${updatedUser.name}`,
      'USER_EDIT_REQUEST',
      updatedUser.id,
      { requestedChanges }
    );

    res.json({ message: 'Edit request submitted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { requestEdit };
