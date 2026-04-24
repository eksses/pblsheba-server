const JobApplication = require('../../models/JobApplication');
const LogService = require('../../services/logService');
const CacheService = require('../../services/cacheService');
const supabase = require('../../utils/supabase');

/**
 * Public Career Controller
 * Handles unauthenticated job application submissions.
 */
const submitJobApplication = async (req, res) => {
  try {
    // Check if applications are enabled
    const settings = await CacheService.get('system_settings') || 
      (await supabase.from('Setting').select('*').eq('id', 1).single()).data;

    if (settings && settings.jobApplicationsEnabled === false) {
      return res.status(403).json({ message: 'Job applications are currently closed.' });
    }

    const {
      postAppliedFor, officeNameCode, roleCode,
      nameBn, nameEn, fatherName, motherName,
      presentAddress, permanentAddress, dob, age, religion, nid,
      nationality, profession, maritalStatus, spouseName,
      mobile, email,
      mobileBankingType, mobileBankingNumber,
      education,
      nomineeName, nomineeAddress, nomineeRelationship, nomineeMobile
    } = req.body;

    const photoUrl = req.files['photo'] ? req.files['photo'][0].path : null;
    const signatureUrl = req.files['signature'] ? req.files['signature'][0].path : null;

    let parsedEducation = [];
    try {
      parsedEducation = education ? (typeof education === 'string' ? JSON.parse(education) : education) : [];
    } catch (e) {
      console.error('Education parsing error:', e);
    }

    const application = await JobApplication.create({
      postAppliedFor, officeNameCode, roleCode,
      nameBn, nameEn, fatherName, motherName,
      presentAddress, permanentAddress, dob,
      age: age ? parseInt(age) : null,
      religion, nid, nationality, profession, maritalStatus, spouseName,
      mobile, email,
      mobileBankingType, mobileBankingNumber,
      education: parsedEducation,
      nomineeName, nomineeAddress, nomineeRelationship, nomineeMobile,
      photoUrl, signatureUrl,
    });

    await LogService.info(
      `New job application received from ${nameEn || nameBn} for ${postAppliedFor}`,
      'JOB_APP_SUBMIT',
      null,
      { applicationId: application.id }
    );

    res.status(201).json({
      message: 'Application submitted successfully!',
      id: application.id
    });
  } catch (error) {
    console.error('Submit Job Application Error:', error);
    res.status(500).json({ 
      message: 'Failed to submit application', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = { submitJobApplication };
