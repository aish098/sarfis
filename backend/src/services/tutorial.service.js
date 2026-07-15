const db = require('../config/db');

class TutorialService {
  /**
   * Fetch the latest published training center content, manual versions, and video lists.
   */
  static async getLatestPublished(companyId = null) {
    let query = db('training_resources').where({ is_published: true });
    if (companyId) {
      query = query.andWhere({ company_id: companyId });
    }
    const resource = await query.orderBy('published_at', 'desc').first();
    if (!resource) return null;

    const videos = await db('training_videos')
      .where({ resource_id: resource.id })
      .orderBy('sequence_order', 'asc')
      .orderBy('created_at', 'asc');

    const manuals = await db('training_manual_versions')
      .where({ resource_id: resource.id })
      .orderBy('created_at', 'desc');

    return {
      ...resource,
      videos,
      manuals
    };
  }

  /**
   * Fetch or create the current draft training configurations.
   */
  static async getDraft(companyId = null) {
    let query = db('training_resources');
    if (companyId) {
      query = query.where({ company_id: companyId });
    } else {
      query = query.whereNull('company_id');
    }
    let resource = await query.first();

    if (!resource) {
      const [newId] = await db('training_resources')
        .insert({
          company_id: companyId,
          page_title: 'Training & Tutorial Center',
          page_description: 'Welcome to the SARFIS Software training hub. Select a video category to begin learning.',
          is_published: false
        })
        .returning('id');
      
      const id = typeof newId === 'object' ? newId.id : newId;
      resource = await db('training_resources').where({ id }).first();
    }

    const videos = await db('training_videos')
      .where({ resource_id: resource.id })
      .orderBy('sequence_order', 'asc')
      .orderBy('created_at', 'asc');

    const manuals = await db('training_manual_versions')
      .where({ resource_id: resource.id })
      .orderBy('created_at', 'desc');

    return {
      ...resource,
      videos,
      manuals
    };
  }

  /**
   * Save draft configurations.
   */
  static async saveDraft(companyId = null, data, userId) {
    const draft = await this.getDraft(companyId);
    
    await db('training_resources')
      .where({ id: draft.id })
      .update({
        page_title: data.page_title,
        page_description: data.page_description,
        updated_by: userId,
        updated_at: db.fn.now()
      });

    return this.getDraft(companyId);
  }

  /**
   * Add a new video to the draft resource.
   */
  static async addVideo(companyId = null, videoData, userId) {
    const draft = await this.getDraft(companyId);

    // Get next sequence order
    const maxSeq = await db('training_videos')
      .where({ resource_id: draft.id })
      .max('sequence_order as maxVal')
      .first();
    const nextOrder = (maxSeq?.maxVal || 0) + 1;

    await db('training_videos').insert({
      resource_id: draft.id,
      title: videoData.title,
      category: videoData.category || 'Getting Started',
      video_file: videoData.video_file,
      duration_minutes: videoData.duration_minutes || 0,
      sequence_order: nextOrder
    });

    return this.getDraft(companyId);
  }

  /**
   * Delete a video.
   */
  static async deleteVideo(companyId = null, videoId) {
    const draft = await this.getDraft(companyId);
    await db('training_videos').where({ id: videoId, resource_id: draft.id }).del();
    return this.getDraft(companyId);
  }

  /**
   * Upload and add a versioned User Manual PDF.
   */
  static async addManualVersion(companyId = null, manualData, userId) {
    const draft = await this.getDraft(companyId);

    await db('training_manual_versions').insert({
      resource_id: draft.id,
      version_number: manualData.version_number,
      file_path: manualData.file_path,
      description: manualData.description || ''
    });

    return this.getDraft(companyId);
  }

  /**
   * Publish current draft changes to the public.
   */
  static async publish(companyId = null, userId) {
    const draft = await this.getDraft(companyId);

    await db('training_resources')
      .where({ id: draft.id })
      .update({
        is_published: true,
        published_by: userId,
        published_at: db.fn.now(),
        updated_by: userId,
        updated_at: db.fn.now()
      });

    return this.getLatestPublished(companyId);
  }

  /**
   * Track watch analytics for a training video.
   */
  static async incrementVideoWatch(videoId, watchSeconds) {
    await db('training_videos')
      .where({ id: videoId })
      .increment({
        views: 1,
        total_watch_seconds: watchSeconds || 0
      });
  }

  /**
   * Track manual PDF download count.
   */
  static async incrementManualDownload(manualId) {
    await db('training_manual_versions')
      .where({ id: manualId })
      .increment('downloads', 1);
  }
}

module.exports = TutorialService;
