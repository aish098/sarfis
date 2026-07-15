const TutorialService = require('../services/tutorial.service');

class TutorialController {
  /**
   * GET /api/tutorial
   * Public endpoint to fetch the latest published tutorial content
   */
  static async getLatestPublished(req, res) {
    try {
      const companyId = req.companyId || null;
      const data = await TutorialService.getLatestPublished(companyId);
      if (!data) {
        return res.json({
          page_title: 'Training & Tutorial Center',
          page_description: 'Welcome to the ACCOUNTELLENCE Software training hub. Content will be available soon.',
          is_published: false,
          videos: [],
          manuals: []
        });
      }
      res.json(data);
    } catch (err) {
      console.error('Error fetching published tutorials:', err);
      res.status(500).json({ error: 'Failed to retrieve tutorial information.' });
    }
  }

  /**
   * GET /api/tutorial/draft
   * Admin endpoint to fetch current draft configurations
   */
  static async getDraft(req, res) {
    try {
      const companyId = req.companyId || null;
      const data = await TutorialService.getDraft(companyId);
      res.json(data);
    } catch (err) {
      console.error('Error fetching draft tutorials:', err);
      res.status(500).json({ error: 'Failed to retrieve draft information.' });
    }
  }

  /**
   * POST /api/tutorial
   * Admin endpoint to save draft settings (title and description)
   */
  static async saveDraft(req, res) {
    try {
      const companyId = req.companyId || null;
      const { page_title, page_description } = req.body;
      if (!page_title) {
        return res.status(400).json({ error: 'Page title is required.' });
      }

      const data = await TutorialService.saveDraft(
        companyId,
        { page_title, page_description },
        req.user.id
      );
      res.json(data);
    } catch (err) {
      console.error('Error saving draft tutorials:', err);
      res.status(500).json({ error: 'Failed to save draft information.' });
    }
  }

  /**
   * POST /api/tutorial/upload-video
   * Admin endpoint to upload and add a video
   */
  static async uploadVideo(req, res) {
    try {
      const companyId = req.companyId || null;
      const { title, category, duration_minutes } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No video file was uploaded.' });
      }
      if (!title) {
        return res.status(400).json({ error: 'Video title is required.' });
      }

      const video_file = `/uploads/${req.file.filename}`;
      const data = await TutorialService.addVideo(
        companyId,
        {
          title,
          category,
          duration_minutes: parseInt(duration_minutes) || 0,
          video_file
        },
        req.user.id
      );
      res.json(data);
    } catch (err) {
      console.error('Error uploading video:', err);
      res.status(500).json({ error: 'Failed to upload video.' });
    }
  }

  /**
   * DELETE /api/tutorial/videos/:id
   * Admin endpoint to delete a video
   */
  static async deleteVideo(req, res) {
    try {
      const companyId = req.companyId || null;
      const videoId = parseInt(req.params.id);
      if (isNaN(videoId)) {
        return res.status(400).json({ error: 'Invalid video ID.' });
      }

      const data = await TutorialService.deleteVideo(companyId, videoId);
      res.json(data);
    } catch (err) {
      console.error('Error deleting video:', err);
      res.status(500).json({ error: 'Failed to delete video.' });
    }
  }

  /**
   * POST /api/tutorial/upload-manual
   * Admin endpoint to upload a new manual version
   */
  static async uploadManual(req, res) {
    try {
      const companyId = req.companyId || null;
      const { version_number, description } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No manual file was uploaded.' });
      }
      if (!version_number) {
        return res.status(400).json({ error: 'Manual version number is required.' });
      }

      const file_path = `/uploads/${req.file.filename}`;
      const data = await TutorialService.addManualVersion(
        companyId,
        {
          version_number,
          description,
          file_path
        },
        req.user.id
      );
      res.json(data);
    } catch (err) {
      console.error('Error uploading manual:', err);
      res.status(500).json({ error: 'Failed to upload user manual.' });
    }
  }

  /**
   * PUT /api/tutorial/publish
   * Admin endpoint to publish current draft state
   */
  static async publish(req, res) {
    try {
      const companyId = req.companyId || null;
      const data = await TutorialService.publish(companyId, req.user.id);
      res.json(data);
    } catch (err) {
      console.error('Error publishing tutorials:', err);
      res.status(500).json({ error: 'Failed to publish tutorial changes.' });
    }
  }

  /**
   * POST /api/tutorial/videos/:id/watch
   * Public endpoint to track video view analytics
   */
  static async recordVideoWatch(req, res) {
    try {
      const videoId = parseInt(req.params.id);
      const { watch_seconds } = req.body;
      if (isNaN(videoId)) {
        return res.status(400).json({ error: 'Invalid video ID.' });
      }

      await TutorialService.incrementVideoWatch(videoId, parseInt(watch_seconds) || 0);
      res.json({ success: true });
    } catch (err) {
      console.error('Error tracking video watch:', err);
      res.status(500).json({ error: 'Failed to record watch analytics.' });
    }
  }

  /**
   * POST /api/tutorial/manuals/:id/download
   * Public endpoint to track manual download analytics
   */
  static async recordManualDownload(req, res) {
    try {
      const manualId = parseInt(req.params.id);
      if (isNaN(manualId)) {
        return res.status(400).json({ error: 'Invalid manual ID.' });
      }

      await TutorialService.incrementManualDownload(manualId);
      res.json({ success: true });
    } catch (err) {
      console.error('Error tracking manual download:', err);
      res.status(500).json({ error: 'Failed to record download analytics.' });
    }
  }
}

module.exports = TutorialController;
