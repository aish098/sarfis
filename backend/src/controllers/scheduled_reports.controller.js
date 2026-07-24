const ScheduledReportsService = require('../services/scheduled_reports.service');

exports.createSchedule = async (req, res) => {
  const companyId = req.companyId;
  const userId = req.user.id;
  try {
    const result = await ScheduledReportsService.createSchedule(companyId, userId, req.body);
    res.json(result);
  } catch (err) {
    console.error('createSchedule error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getSchedules = async (req, res) => {
  const companyId = req.companyId;
  try {
    const result = await ScheduledReportsService.getSchedules(companyId);
    res.json(result);
  } catch (err) {
    console.error('getSchedules error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.toggleSchedule = async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const { enabled } = req.body;
  try {
    const result = await ScheduledReportsService.toggleSchedule(companyId, parseInt(id), enabled);
    res.json(result);
  } catch (err) {
    console.error('toggleSchedule error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSchedule = async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  try {
    const result = await ScheduledReportsService.deleteSchedule(companyId, parseInt(id));
    res.json(result);
  } catch (err) {
    console.error('deleteSchedule error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.runPending = async (req, res) => {
  try {
    await ScheduledReportsService.runPendingSchedules();
    res.json({ message: 'Pending scheduled reports executed successfully.' });
  } catch (err) {
    console.error('runPending error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.downloadScheduleReport = async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  try {
    const { attachmentContent, mimeType, fileName } = await ScheduledReportsService.generateReportBuffer(companyId, parseInt(id));
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(attachmentContent);
  } catch (err) {
    console.error('downloadScheduleReport error:', err);
    res.status(500).json({ error: err.message });
  }
};
