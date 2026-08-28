const videoService = require('../services/videoService');

/**
 * GET /api/videos/:lessonId/stream
 *
 * Browser -> Express -> Lesson -> videoFileId -> Drive Service -> Drive API
 * -> private mp4 bytes -> Express response -> <video> element.
 *
 * The response body is raw video bytes. No Drive URL is ever sent to the client.
 */
async function streamLessonVideo(req, res, next) {
  try {
    const rangeHeader = req.headers.range;
    const result = await videoService.getLessonVideoStream(req.params.lessonId, rangeHeader);

    const headers = {
      'Content-Type': result.contentType,
      'Accept-Ranges': 'bytes',
      // Discourage saving / sniffing. Not a DRM claim - see README limitations.
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    };

    if (result.contentLength != null) headers['Content-Length'] = result.contentLength;
    if (result.contentRange) headers['Content-Range'] = result.contentRange;

    res.writeHead(result.status, headers);

    result.stream.on('error', (err) => {
      console.error('[video] stream error:', err.message);
      res.destroy(err);
    });

    // Stop pulling bytes from Drive if the student closes the tab or seeks away.
    res.on('close', () => result.stream.destroy());

    result.stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

/** GET /api/videos/:lessonId/info - metadata only, for the architecture panel. */
async function getVideoInfo(req, res, next) {
  try {
    res.json(await videoService.getLessonVideoInfo(req.params.lessonId));
  } catch (err) {
    next(err);
  }
}

module.exports = { streamLessonVideo, getVideoInfo };
