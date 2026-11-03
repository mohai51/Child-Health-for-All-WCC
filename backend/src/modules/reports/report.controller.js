const { getCampReportData, generateCampCsv, generateCampXlsx } = require('./report.service');
const { logAuditEvent } = require('../../services/audit.service');

// Get JSON summary of camp report
async function getSummaryReport(req, res) {
  try {
    const { campId } = req.params;
    const reportData = await getCampReportData(campId);
    return res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'রিপোর্ট তৈরি করতে ব্যর্থ হয়েছে (Failed to generate report)',
      error: error.message
    });
  }
}

// Get doctor-wise performance report
async function getDoctorsReport(req, res) {
  try {
    const { campId } = req.params;
    const reportData = await getCampReportData(campId);
    return res.json({
      success: true,
      data: reportData.doctors
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'চিকিৎসক রিপোর্ট তৈরিতে ব্যর্থ হয়েছে (Failed to generate doctor report)',
      error: error.message
    });
  }
}

// Export report as CSV or XLSX
async function exportCampReport(req, res) {
  try {
    const { campId } = req.params;
    const format = (req.query.format || 'csv').toLowerCase();

    await logAuditEvent({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'CAMP_REPORT_EXPORT',
      resourceType: 'Report',
      resourceId: campId,
      result: 'SUCCESS',
      req,
      metadata: { format }
    });

    if (format === 'xlsx' || format === 'excel') {
      const buffer = await generateCampXlsx(campId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="wcc_camp_report_${campId}.xlsx"`);
      return res.send(buffer);
    } else {
      const csvBuffer = await generateCampCsv(campId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="wcc_camp_report_${campId}.csv"`);
      return res.send(csvBuffer);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'রিপোর্ট ডাউনলোড ব্যর্থ হয়েছে (Failed to export report)',
      error: error.message
    });
  }
}

module.exports = {
  getSummaryReport,
  getDoctorsReport,
  exportCampReport
};
