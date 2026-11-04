const {
  searchPatientForMeasurement,
  savePatientMeasurement,
  calculateChildBMI
} = require('./measurement.service');

async function searchPatient(req, res) {
  try {
    const patientQuery = req.query.patientId || req.query.q || '';
    const campId = req.query.campId || req.params.campId || '';

    const data = await searchPatientForMeasurement({
      patientQuery,
      campId
    });

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message || 'রোগী পাওয়া যায়নি'
    });
  }
}

async function saveMeasurement(req, res) {
  try {
    const {
      patientId,
      campId,
      height,
      weight,
      bloodGroup,
      hemoglobin
    } = req.body;

    const result = await savePatientMeasurement({
      patientId,
      campId: campId || req.params.campId,
      height,
      weight,
      bloodGroup,
      hemoglobin,
      measuredByUserId: req.user?._id,
      req
    });

    return res.json({
      success: true,
      message: result.message || 'পরিমাপ সফলভাবে সংরক্ষিত হয়েছে! এবার রোগীকে ডাক্তারের কাছে যেতে পারেন।',
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'সংরক্ষণ ব্যর্থ হয়েছে'
    });
  }
}

async function calculateBmiEndpoint(req, res) {
  try {
    const { weight, height, ageYears, sex } = req.query;
    const result = calculateChildBMI(weight, height, ageYears, sex);
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

module.exports = {
  searchPatient,
  saveMeasurement,
  calculateBmiEndpoint
};

