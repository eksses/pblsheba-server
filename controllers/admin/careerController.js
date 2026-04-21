const JobApplication = require('../../models/JobApplication');
const LogService = require('../../services/logService');

/**
 * Admin Career Controller
 * Handles oversight and status management of job applications.
 */
const getJobApplications = async (req, res) => {
  try {
    const applications = await JobApplication.findAll();
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateJobApplicationStatus = async (req, res) => {
  try {
    const { status, statusNote } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const application = await JobApplication.updateStatus(req.params.id, status, statusNote);

    await LogService.info(
      `Job application ${application.id} status updated to ${status} by ${req.user.name}`,
      'JOB_APP_STATUS_UPDATE',
      req.user.id,
      { applicationId: application.id, status }
    );

    res.json(application);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getJobApplications, updateJobApplicationStatus };
