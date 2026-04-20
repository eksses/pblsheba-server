const supabase = require('../utils/supabase');
const JobApplication = require('../models/JobApplication');
const SystemLog = require('../models/SystemLog');
const { getCachedData, cacheData } = require('../utils/redis');


const getSettings = async () => {
  const cacheKey = 'system_settings';
  let settings = await getCachedData(cacheKey);
  
  if (!settings) {
    const { data } = await supabase.from('Setting').select('*').eq('id', 1).single();
    settings = data;
    if (settings) await cacheData(cacheKey, settings, 3600);
  }
  return settings;
};




const submitJobApplication = async (req, res) => {
  try {
    const settings = await getSettings();
    if (settings && !settings.jobApplicationsEnabled) {
      return res.status(403).json({ message: 'Job applications are currently closed.' });
    }

    const {
      postAppliedFor, officeNameCode, roleCode,
      nameBn, nameEn, fatherName, motherName,
      presentAddress, permanentAddress, dob, age, religion, nid,
      nationality, profession, maritalStatus, spouseName,
      mobile, email, bankName, branch, routingNo,
      mobileBankingType, mobileBankingNumber,
      education,
      nomineeName, nomineeAddress, nomineeRelationship, nomineeMobile
    } = req.body;

    const photoUrl = req.files['photo'] ? req.files['photo'][0].path : null;
    const signatureUrl = req.files['signature'] ? req.files['signature'][0].path : null;

    const applicationData = {
      postAppliedFor, officeNameCode, roleCode,
      nameBn, nameEn, fatherName, motherName,
      presentAddress, permanentAddress, dob,
      age: age ? parseInt(age) : null,
      religion, nid, nationality, profession, maritalStatus, spouseName,
      mobile, email, bankName, branch, routingNo,
      mobileBankingType, mobileBankingNumber,
      education: education ? JSON.parse(education) : [],
      nomineeName, nomineeAddress, nomineeRelationship, nomineeMobile,
      photoUrl, signatureUrl,
    };

    const application = await JobApplication.create(applicationData);

    await SystemLog.create({
      level: 'info',
      message: `New job application received from ${nameEn || nameBn} for ${postAppliedFor}`,
      action: 'JOB_APP_SUBMIT',
      metadata: { applicationId: application.id }
    });

    res.status(201).json({
      message: 'Application submitted successfully!',
      id: application.id
    });
  } catch (error) {
    console.error('Submit Job Application Error:', error);
    res.status(500).json({ message: 'Failed to submit application. Please try again.' });
  }
};




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

    await SystemLog.create({
      level: 'info',
      message: `Job application ${application.id} status updated to ${status} by ${req.user.name}`,
      action: 'JOB_APP_STATUS_UPDATE',
      userId: req.user.id,
      metadata: { applicationId: application.id, status }
    });

    res.json(application);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  submitJobApplication,
  getJobApplications,
  updateJobApplicationStatus
};
